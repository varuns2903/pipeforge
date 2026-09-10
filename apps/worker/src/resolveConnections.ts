import mongoose from 'mongoose';
import { connectionSchema, decryptSecret } from '@pipeforge/shared';

const CONNECTOR_NODE_TYPES = new Set(['postgres-input', 's3-input', 'api-input']);

const Connection = mongoose.model('Connection', connectionSchema);

export interface ConnectionRecord {
  config: any;
  encryptedSecret: string;
}

async function defaultFetchConnection(connectionId: string): Promise<ConnectionRecord | null> {
  return Connection.findById(connectionId);
}

/**
 * Returns a copy of the pipeline where any connector node's `connectionId`
 * has been resolved into real, plaintext credentials merged into that
 * node's config — the engine itself never touches encrypted secrets or the
 * Connection collection (see packages/pipeline-engine/src/engine.ts).
 *
 * Deliberately does not mutate the input pipeline: callers persist the
 * *unresolved* pipeline (with connectionId, not credentials) as the
 * Execution's pipelineSnapshot, so decrypted secrets never land in the
 * database or get sent back to a browser.
 *
 * `fetchConnection` is injectable (defaults to a real Mongo lookup) so this
 * function's merging/error logic can be unit tested without a database.
 */
export async function resolveConnections(
  pipeline: any,
  encryptionKey: string,
  fetchConnection: (connectionId: string) => Promise<ConnectionRecord | null> = defaultFetchConnection
): Promise<any> {
  const nodes = await Promise.all(
    (pipeline.nodes || []).map(async (node: any) => {
      const nodeType = node.data?.nodeType;
      const connectionId = node.data?.config?.connectionId;
      if (!CONNECTOR_NODE_TYPES.has(nodeType) || !connectionId) {
        return node;
      }

      const connection = await fetchConnection(connectionId);
      if (!connection) {
        throw new Error(`Connection ${connectionId} referenced by node '${node.data?.label || node.id}' was not found`);
      }

      const secret = JSON.parse(decryptSecret(connection.encryptedSecret, encryptionKey));

      return {
        ...node,
        data: {
          ...node.data,
          config: {
            ...connection.config, // non-secret (host, bucket, baseUrl, ...)
            ...secret,            // decrypted (password, accessKeyId/secretAccessKey, token)
            ...node.data.config,  // node-specific fields (query, key, path) take precedence
          }
        }
      };
    })
  );

  return { ...pipeline, nodes };
}
