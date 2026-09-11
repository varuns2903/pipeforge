import mongoose from 'mongoose';

// A human-readable audit trail of who did what in a project — separate from
// Execution (which tracks pipeline *runs*) and from Mongo change streams
// (which we don't use). Written by the api only; nothing here is read by the
// worker.
const activityLogSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  message: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// Sorted by _id descending for cursor pagination (see utils/pagination.ts),
// scoped to one project at a time.
activityLogSchema.index({ projectId: 1, _id: -1 });

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
