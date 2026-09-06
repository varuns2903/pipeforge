import mongoose from 'mongoose';

const pipelineSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  nodes: { type: Array, default: [] },
  edges: { type: Array, default: [] }
}, { timestamps: true });

export const Pipeline = mongoose.model('Pipeline', pipelineSchema);
