import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import { File } from '../models/File';
import { Execution } from '../models/Execution';
import { User } from '../models/User';
import { getPlanLimits } from '../config/plans';

export class UsageController {
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = new mongoose.Types.ObjectId(req.user.id);

      const [storageResult, activeExecutions, user] = await Promise.all([
        // Storage is charged to whoever uploaded the bytes, not the project
        // they were uploaded into — see models/File.ts.
        File.aggregate([
          { $match: { uploadedBy: userId } },
          { $group: { _id: null, totalBytes: { $sum: '$size' } } }
        ]),
        Execution.countDocuments({ ownerId: userId, status: { $in: ['PENDING', 'RUNNING'] } }),
        User.findById(req.user.id).select('plan')
      ]);

      const usedBytes = storageResult[0]?.totalBytes || 0;
      const limits = getPlanLimits(user?.plan);

      res.json({
        plan: user?.plan || 'free',
        storage: {
          usedBytes,
          limitBytes: limits.maxStorageMB * 1024 * 1024,
        },
        executions: {
          active: activeExecutions,
          limit: limits.maxConcurrentExecutions,
        }
      });
    } catch (err) { next(err); }
  }
}

export const usageController = new UsageController();
