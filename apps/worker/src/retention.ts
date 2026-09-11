import fs from 'fs';
import path from 'path';
import mongoose, { Model } from 'mongoose';
import { createLogger } from '@pipeforge/shared';

const logger = createLogger('worker');

// apps/worker/(src|dist)/retention.(ts|js) -> worker -> apps -> repo root,
// same depth in both dev (tsx, from src) and production (compiled to dist)
// — mirrors index.ts's assumption about its own location.
const uploadsDir = path.resolve(__dirname, '../../../uploads');

// Minimal, ad-hoc shape — same reasoning as index.ts's UserContact: this
// process only needs enough of File's fields to find and delete old
// records, not the full model apps/api owns. Mongoose defaults the
// collection name from the model name, so this reads/writes the exact same
// `files` collection apps/api's File model does.
const FileRecord = mongoose.model('File', new mongoose.Schema({
  filePath: String,
}, { timestamps: true }));

/**
 * Deletes finished (COMPLETED/FAILED) executions and uploaded files older
 * than their configured retention window. Never touches PENDING/RUNNING
 * executions, pipelines, connections, or projects — this is a storage/
 * history cleanup, not a data-lifecycle policy for anything still active.
 */
export async function runRetentionSweep(options: {
  executionModel: Model<any>;
  executionRetentionDays: number;
  fileRetentionDays: number;
}) {
  const executionCutoff = new Date(Date.now() - options.executionRetentionDays * 24 * 60 * 60 * 1000);
  const fileCutoff = new Date(Date.now() - options.fileRetentionDays * 24 * 60 * 60 * 1000);

  const executionResult = await options.executionModel.deleteMany({
    status: { $in: ['COMPLETED', 'FAILED'] },
    createdAt: { $lt: executionCutoff },
  });

  const oldFiles = await FileRecord.find({ createdAt: { $lt: fileCutoff } }).select('filePath');
  for (const file of oldFiles) {
    if (!file.filePath) continue;
    // path.basename strips any directory components a malformed filePath
    // might contain, so this can never unlink outside uploadsDir.
    const diskPath = path.join(uploadsDir, path.basename(file.filePath));
    // Best-effort — the File record is deleted either way below; a missing
    // or already-gone disk file shouldn't block the sweep.
    fs.promises.unlink(diskPath).catch(() => {});
  }
  const fileResult = await FileRecord.deleteMany({ createdAt: { $lt: fileCutoff } });

  logger.info(
    { executionsDeleted: executionResult.deletedCount, filesDeleted: fileResult.deletedCount },
    'Retention sweep complete'
  );

  return { executionsDeleted: executionResult.deletedCount ?? 0, filesDeleted: fileResult.deletedCount ?? 0 };
}
