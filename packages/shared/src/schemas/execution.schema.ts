import mongoose from 'mongoose';

// Single source of truth for the Execution collection's shape. Both apps/api
// (creates executions, serves history) and apps/worker (updates them as jobs
// run) build their `Execution` model from this schema, so the two processes
// can never drift out of sync on what fields/validators exist.
export const executionSchema = new mongoose.Schema({
  pipelineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  pipelineSnapshot: { type: mongoose.Schema.Types.Mixed }, // { nodes: [], edges: [] }
  status: { type: String, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  startedAt: { type: Date },
  completedAt: { type: Date },
  results: { type: mongoose.Schema.Types.Mixed }, // flexible JSON schema
  error: { type: String }
}, { timestamps: true });

executionSchema.index({ pipelineId: 1, createdAt: -1 });
executionSchema.index({ projectId: 1 });
