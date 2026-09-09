import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

projectSchema.index({ ownerId: 1 });

export const Project = mongoose.model('Project', projectSchema);
