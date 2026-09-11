import { Response, NextFunction } from 'express';
import { connectionService } from '../services/connection.service';
import { activityLogService } from '../services/activityLog.service';
import { AuthRequest } from '../middleware/auth.middleware';

// Never include encryptedSecret or the raw `secret` request body field here —
// this is the one place a leak would expose every stored credential.
const mapToDTO = (doc: any) => ({
  id: doc._id.toString(),
  projectId: doc.projectId.toString(),
  name: doc.name,
  type: doc.type,
  config: doc.config,
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
});

export class ConnectionController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, type, config, secret } = req.body;
      if (!name || !type) {
        return res.status(400).json({ error: 'name and type are required' });
      }
      const connection = await connectionService.create(
        req.params.projectId as string, req.user.id, name, type, config || {}, secret || {}
      );
      await activityLogService.log(
        req.params.projectId as string, req.user.id, 'connection.created',
        `Created connection "${connection.name}" (${connection.type})`, { connectionId: connection._id.toString() }
      );
      res.status(201).json(mapToDTO(connection));
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      if (err.message.includes('require') || err.message.startsWith('Unknown connection type')) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const connections = await connectionService.list(req.params.projectId as string, req.user.id);
      res.json(connections.map(mapToDTO));
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const connection = await connectionService.getById(
        req.params.connectionId as string, req.params.projectId as string, req.user.id
      );
      res.json(mapToDTO(connection));
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const connection = await connectionService.delete(req.params.connectionId as string, req.params.projectId as string, req.user.id);
      await activityLogService.log(
        req.params.projectId as string, req.user.id, 'connection.deleted',
        `Deleted connection "${connection.name}"`, { connectionId: connection._id.toString() }
      );
      res.status(204).send();
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }
}

export const connectionController = new ConnectionController();
