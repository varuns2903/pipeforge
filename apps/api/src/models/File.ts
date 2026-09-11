import mongoose from 'mongoose';

// Tracks uploaded files, scoped to a project so any member can use one as a
// pipeline source — mirroring Connection. `uploadedBy` is kept (not just
// informational, unlike Connection's createdBy) because storage quota is
// charged to whoever actually uploaded the bytes, not to the project, the
// same way the concurrent-execution quota is charged to whoever triggered a
// run rather than to the project — see file.routes.ts's quota check.
const fileSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filePath: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true }
}, { timestamps: true });

fileSchema.index({ projectId: 1 });
fileSchema.index({ uploadedBy: 1 });

export const File = mongoose.model('File', fileSchema);
