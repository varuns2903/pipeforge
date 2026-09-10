import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import { File } from '../models/File';
import { Execution } from '../models/Execution';
import { MAX_USER_STORAGE_MB, MAX_CONCURRENT_EXECUTIONS_PER_USER } from '../config/env';

export class UsageController {
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = new mongoose.Types.ObjectId(req.user.id);

      const [storageResult, activeExecutions] = await Promise.all([
        File.aggregate([
          { $match: { ownerId } },
          { $group: { _id: null, totalBytes: { $sum: '$size' } } }
        ]),
        Execution.countDocuments({ ownerId, status: { $in: ['PENDING', 'RUNNING'] } })
      ]);

      const usedBytes = storageResult[0]?.totalBytes || 0;

      res.json({
        storage: {
          usedBytes,
          limitBytes: MAX_USER_STORAGE_MB * 1024 * 1024,
        },
        executions: {
          active: activeExecutions,
          limit: MAX_CONCURRENT_EXECUTIONS_PER_USER,
        }
      });
    } catch (err) { next(err); }
  }
}

export const usageController = new UsageController();
