import mongoose from 'mongoose';

// Single source of truth for the Pipeline collection's shape — apps/api owns
// CRUD, apps/worker needs read access to run a scheduled execution (the
// pipeline definition at the moment the schedule fires, not at the moment it
// was created), so both build their model from this schema.
export const pipelineSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  nodes: { type: Array, default: [] },
  edges: { type: Array, default: [] },
  deletedAt: { type: Date, default: null },
  schedule: {
    cronExpression: { type: String },
    timezone: { type: String },
    // The pipeline's own _id doubles as its BullMQ job scheduler id, so
    // there's no separate key to persist — see queue.service.ts.
    enabled: { type: Boolean, default: false },
  },
  notifications: {
    // Failure defaults on (the actionable case); completion defaults off —
    // a pipeline on an hourly schedule would otherwise spam its owner.
    onFailure: { type: Boolean, default: true },
    onComplete: { type: Boolean, default: false },
  }
}, { timestamps: true });

pipelineSchema.index({ projectId: 1 });
