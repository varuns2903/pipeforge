import { encryptSecret } from '@pipeforge/shared';
import { Connection } from '../models/Connection';
import { CONNECTION_ENCRYPTION_KEY } from '../config/env';
import { projectService } from './project.service';

const ALLOWED_TYPES = ['postgres', 'mysql', 's3', 'api', 'kafka'] as const;
type ConnectionType = typeof ALLOWED_TYPES[number];

function validateConfig(type: ConnectionType, config: any, secret: any) {
  if (type === 'postgres' || type === 'mysql') {
    if (!config?.host || !config?.database || !config?.user) {
      throw new Error(`${type === 'postgres' ? 'Postgres' : 'MySQL'} connections require host, database, and user`);
    }
  } else if (type === 's3') {
    if (!config?.bucket || !config?.region) {
      throw new Error('S3 connections require bucket and region');
    }
    if (!secret?.accessKeyId || !secret?.secretAccessKey) {
      throw new Error('S3 connections require accessKeyId and secretAccessKey');
    }
  } else if (type === 'api') {
    if (!config?.baseUrl) {
      throw new Error('API connections require baseUrl');
    }
  } else if (type === 'kafka') {
    if (!config?.brokers) {
      throw new Error('Kafka connections require brokers');
    }
  } else {
    throw new Error(`Unknown connection type: ${type}`);
  }
}

export class ConnectionService {
  // Shared with any project member (any role) — like Pipeline, access is
  // entirely derived from project membership, not from who created it.
  async create(projectId: string, userId: string, name: string, type: ConnectionType, config: any, secret: any) {
    await projectService.getById(projectId, userId, 'editor');

    if (!ALLOWED_TYPES.includes(type)) {
      throw new Error(`Unknown connection type: ${type}`);
    }
    validateConfig(type, config, secret);

    const encryptedSecret = encryptSecret(JSON.stringify(secret || {}), CONNECTION_ENCRYPTION_KEY);
    const connection = new Connection({ projectId, createdBy: userId, name, type, config, encryptedSecret });
    await connection.save();
    return connection;
  }

  async list(projectId: string, userId: string) {
    await projectService.getById(projectId, userId, 'viewer');
    return Connection.find({ projectId }).sort({ name: 1 });
  }

  async getById(connectionId: string, projectId: string, userId: string, minRole: 'viewer' | 'editor' = 'viewer') {
    await projectService.getById(projectId, userId, minRole);
    const connection = await Connection.findOne({ _id: connectionId, projectId });
    if (!connection) throw new Error('Connection not found');
    return connection;
  }

  async delete(connectionId: string, projectId: string, userId: string) {
    await projectService.getById(projectId, userId, 'editor');
    const connection = await Connection.findOneAndDelete({ _id: connectionId, projectId });
    if (!connection) throw new Error('Connection not found');
    return connection;
  }
}

export const connectionService = new ConnectionService();
