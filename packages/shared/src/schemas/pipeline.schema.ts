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
  },
  // Outbound HTTP notification on execution complete/fail — same on/off
  // shape as `notifications` above, plus a delivery target and a signing
  // secret. The secret is encrypted at rest with CONNECTION_ENCRYPTION_KEY
  // (see packages/shared/src/crypto.ts) the same way connection credentials
  // are, and decrypted only when signing a delivery (worker) or showing it
  // back to the pipeline's own owner/editor (api).
  webhook: {
    url: { type: String },
    secretEncrypted: { type: String },
    onFailure: { type: Boolean, default: true },
    onComplete: { type: Boolean, default: false },
  },
  // Pipeline-to-pipeline chaining: when this pipeline finishes with status
  // COMPLETED (never on FAILED — a broken upstream stage shouldn't cascade),
  // the worker queues a fresh run of each of these (same project, since
  // Connections/Files are project-scoped and a cross-project trigger would
  // need its own authorization story). A hop-count cap on the queued job's
  // data (not persisted here) guards against a chain looping back on itself.
  triggerPipelineIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
}, { timestamps: true });

pipelineSchema.index({ projectId: 1 });
