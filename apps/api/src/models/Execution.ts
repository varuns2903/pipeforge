import mongoose from 'mongoose';

const executionSchema = new mongoose.Schema({
  pipelineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  pipelineSnapshot: { type: mongoose.Schema.Types.Mixed }, // { nodes: [], edges: [] }
  status: { type: String, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  startedAt: { type: Date },
  completedAt: { type: Date },
  results: { type: mongoose.Schema.Types.Mixed }, // flexible JSON schema
  error: { type: String }
}, { timestamps: true });

export const Execution = mongoose.model('Execution', executionSchema);
