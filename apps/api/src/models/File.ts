import mongoose from 'mongoose';

// Tracks uploaded files per user so total storage can be checked against a
// quota — multer alone just writes to disk with no record of who owns what.
const fileSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filePath: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true }
}, { timestamps: true });

fileSchema.index({ ownerId: 1 });

export const File = mongoose.model('File', fileSchema);
