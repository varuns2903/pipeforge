import { ActivityLog } from '../models/ActivityLog';
import { logger } from '../logger';

export class ActivityLogService {
  // Fire-and-forget from the caller's perspective: a logging failure must
  // never fail the mutation it's describing, so this swallows its own errors
  // rather than throwing. Callers still `await` it to keep ordering
  // deterministic (mainly for tests), not because they act on the result.
  async log(projectId: string, userId: string, action: string, message: string, metadata?: Record<string, unknown>) {
    try {
      await ActivityLog.create({ projectId, userId, action, message, metadata });
    } catch (err) {
      logger.error({ err, projectId, action }, 'Failed to write activity log entry');
    }
  }
}

export const activityLogService = new ActivityLogService();
