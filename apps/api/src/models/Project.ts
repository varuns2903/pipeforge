import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // 'editor' can create/edit/run/delete pipelines; 'viewer' is read-only.
  // Project-level management (rename, delete, member changes) stays
  // owner-only regardless of role — see project.service.ts.
  role: { type: String, enum: ['editor', 'viewer'], required: true },
}, { _id: false });

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: { type: [memberSchema], default: [] },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

projectSchema.index({ ownerId: 1 });
projectSchema.index({ 'members.userId': 1 });

export const Project = mongoose.model('Project', projectSchema);
