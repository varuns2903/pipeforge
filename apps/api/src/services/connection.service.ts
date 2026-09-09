import { encryptSecret } from '@pipeforge/shared';
import { Connection } from '../models/Connection';
import { CONNECTION_ENCRYPTION_KEY } from '../config/env';

const ALLOWED_TYPES = ['postgres', 's3', 'api'] as const;
type ConnectionType = typeof ALLOWED_TYPES[number];

function validateConfig(type: ConnectionType, config: any, secret: any) {
  if (type === 'postgres') {
    if (!config?.host || !config?.database || !config?.user) {
      throw new Error('Postgres connections require host, database, and user');
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
  } else {
    throw new Error(`Unknown connection type: ${type}`);
  }
}

export class ConnectionService {
  async create(ownerId: string, name: string, type: ConnectionType, config: any, secret: any) {
    if (!ALLOWED_TYPES.includes(type)) {
      throw new Error(`Unknown connection type: ${type}`);
    }
    validateConfig(type, config, secret);

    const encryptedSecret = encryptSecret(JSON.stringify(secret || {}), CONNECTION_ENCRYPTION_KEY);
    const connection = new Connection({ ownerId, name, type, config, encryptedSecret });
    await connection.save();
    return connection;
  }

  async list(ownerId: string) {
    return Connection.find({ ownerId }).sort({ name: 1 });
  }

  async getById(connectionId: string, ownerId: string) {
    const connection = await Connection.findOne({ _id: connectionId, ownerId });
    if (!connection) throw new Error('Connection not found');
    return connection;
  }

  async delete(connectionId: string, ownerId: string) {
    const connection = await Connection.findOneAndDelete({ _id: connectionId, ownerId });
    if (!connection) throw new Error('Connection not found');
    return connection;
  }
}

export const connectionService = new ConnectionService();
