import { PipelineEngine } from '@pipeforge/pipeline-engine';
import { decryptSecret } from '@pipeforge/shared';
import { Connection } from '../models/Connection';
import { CONNECTION_ENCRYPTION_KEY } from '../config/env';
import { projectService } from './project.service';

// Mirrors apps/worker/src/resolveConnections.ts's node-type set and merge
// order (connection.config, then decrypted secret, then the node's own
// config so node-specific fields like `query` win) — kept as a small,
// deliberate duplication rather than a shared module, since this runs
// synchronously inside an API request (interactive preview) while the
// worker's version runs inside a queued job; the two call sites have
// different enough surrounding code that sharing would mostly just add
// indirection.
const CONNECTOR_NODE_TYPES = new Set(['postgres-input', 'mysql-input', 's3-input', 'api-input', 'kafka-input']);

// Small and fast on purpose — this runs on every click, not once per queued
// execution, so it stays capped regardless of MAX_PIPELINE_ROWS.
const PREVIEW_ROW_LIMIT = 20;

// Walks edges backward from `nodeId` to find every node it (transitively)
// depends on. Preview only ever runs this subgraph — not the whole pipeline
// — so previewing an early node works even if a later, unrelated node is
// still unconfigured.
function collectAncestors(nodeId: string, edges: any[]): Set<string> {
  const ancestors = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (ancestors.has(edge.target) && !ancestors.has(edge.source)) {
        ancestors.add(edge.source);
        changed = true;
      }
    }
  }
  return ancestors;
}

export class PreviewService {
  async preview(projectId: string, userId: string, nodes: any[], edges: any[], targetNodeId: string) {
    await projectService.getById(projectId, userId, 'editor');

    if (!nodes.some((n: any) => n.id === targetNodeId)) {
      throw new Error('Target node not found in the given pipeline');
    }

    const ancestorIds = collectAncestors(targetNodeId, edges);
    const subNodes = nodes.filter((n: any) => ancestorIds.has(n.id));
    const subEdges = edges.filter((e: any) => ancestorIds.has(e.source) && ancestorIds.has(e.target));

    const resolvedNodes = await Promise.all(subNodes.map(async (node: any) => {
      const nodeType = node.data?.nodeType;
      const connectionId = node.data?.config?.connectionId;
      if (!CONNECTOR_NODE_TYPES.has(nodeType) || !connectionId) return node;

      const connection = await Connection.findOne({ _id: connectionId, projectId });
      if (!connection) {
        throw new Error(`Connection referenced by node '${node.data?.label || node.id}' was not found`);
      }

      const secret = JSON.parse(decryptSecret(connection.encryptedSecret, CONNECTION_ENCRYPTION_KEY));
      return {
        ...node,
        data: {
          ...node.data,
          config: { ...connection.config, ...secret, ...node.data.config },
        },
      };
    }));

    const engine = new PipelineEngine();
    const context = await engine.execute({ nodes: resolvedNodes, edges: subEdges });
    const output = context[targetNodeId];
    const rows: any[] = Array.isArray(output) ? output : (output?.true || output?.false || []);

    return {
      rows: rows.slice(0, PREVIEW_ROW_LIMIT),
      totalRows: rows.length,
      truncated: rows.length > PREVIEW_ROW_LIMIT,
    };
  }
}

export const previewService = new PreviewService();
