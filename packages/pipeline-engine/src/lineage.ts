export interface LineageNode {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  column: string;
  // True for a computed/synthetic column with no single upstream source
  // column (e.g. aggregate's `count`, window's rank column) — `sources`
  // may still list the columns it was *derived from* for context.
  synthetic?: boolean;
  // True once a cycle or depth limit cuts the trace short, so a
  // deliberately-invalid or pathological graph doesn't recurse forever.
  truncated?: boolean;
  sources: LineageNode[];
}

const SOURCE_NODE_TYPES = new Set([
  'csv-input', 'json-input', 'excel-input', 'postgres-input', 'mysql-input', 's3-input', 'api-input',
]);

const AGGREGATE_PREFIXES = ['sum_', 'avg_', 'min_', 'max_', 'count_distinct_'];

const MAX_LINEAGE_DEPTH = 40;

function parseRenameMapping(mapping: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!mapping) return map;
  mapping.split(',').forEach((part) => {
    const [oldCol, newCol] = part.split(':').map((s) => s.trim());
    if (oldCol && newCol) map[oldCol] = newCol;
  });
  return map;
}

/**
 * Traces one output column of one node backward through the pipeline graph
 * to the column(s) it was ultimately derived from — a static analysis of
 * node configs, not a run of the pipeline (so it works on an unsaved or
 * never-run pipeline, unlike the preview feature).
 */
export function computeColumnLineage(nodes: any[], edges: any[], targetNodeId: string, targetColumn: string): LineageNode {
  const nodeMap: Record<string, any> = {};
  nodes.forEach((n) => { nodeMap[n.id] = n; });

  const visiting = new Set<string>();

  const describe = (nodeId: string, column: string): { nodeLabel: string; nodeType: string } => {
    const node = nodeMap[nodeId];
    return {
      nodeLabel: node?.data?.label || nodeId,
      nodeType: node?.data?.nodeType || 'unknown',
    };
  };

  const trace = (nodeId: string, column: string, depth: number): LineageNode => {
    const { nodeLabel, nodeType } = describe(nodeId, column);
    const visitKey = `${nodeId}:${column}`;

    if (depth >= MAX_LINEAGE_DEPTH || visiting.has(visitKey) || !nodeMap[nodeId]) {
      return { nodeId, nodeLabel, nodeType, column, sources: [], truncated: true };
    }

    if (SOURCE_NODE_TYPES.has(nodeType)) {
      return { nodeId, nodeLabel, nodeType, column, sources: [] };
    }

    visiting.add(visitKey);
    try {
      const config = nodeMap[nodeId].data?.config || {};
      // In edge order — matches the engine's own input-gathering, where
      // `join`'s first incoming edge is treated as its left dataset.
      const incoming = edges.filter((e: any) => e.target === nodeId);

      const passthrough = (col: string) =>
        incoming.map((edge: any) => trace(edge.source, col, depth + 1));

      switch (nodeType) {
        case 'rename-columns': {
          const renameMap = parseRenameMapping(config.mapping);
          const reverseEntry = Object.entries(renameMap).find(([, newCol]) => newCol === column);
          const sourceColumn = reverseEntry ? reverseEntry[0] : column;
          return { nodeId, nodeLabel, nodeType, column, sources: passthrough(sourceColumn) };
        }

        case 'select-columns':
          return { nodeId, nodeLabel, nodeType, column, sources: passthrough(column) };

        case 'aggregate': {
          const groupByCols = (config.groupBy || '').split(',').map((s: string) => s.trim()).filter(Boolean);
          if (groupByCols.includes(column)) {
            return { nodeId, nodeLabel, nodeType, column, sources: passthrough(column) };
          }
          if (column === 'count') {
            return { nodeId, nodeLabel, nodeType, column, synthetic: true, sources: [] };
          }
          const prefix = AGGREGATE_PREFIXES.find((p) => column.startsWith(p));
          if (prefix && config.targetColumn && column === `${prefix}${config.targetColumn}`) {
            return { nodeId, nodeLabel, nodeType, column, synthetic: true, sources: passthrough(config.targetColumn) };
          }
          return { nodeId, nodeLabel, nodeType, column, sources: [] };
        }

        case 'join': {
          const [leftEdge, rightEdge] = incoming;
          const sources: LineageNode[] = [];
          // Right-hand columns win on a name collision (engine spreads
          // {...leftRow, ...rightRow}), so check it first; either side may
          // legitimately contribute the column, so both are reported.
          if (rightEdge) sources.push(trace(rightEdge.source, column, depth + 1));
          if (leftEdge) sources.push(trace(leftEdge.source, column, depth + 1));
          return { nodeId, nodeLabel, nodeType, column, sources };
        }

        case 'window': {
          const outputColumn = config.outputColumn || 'rank';
          if (column === outputColumn) {
            const contributingCols = [
              ...(config.partitionBy ? config.partitionBy.split(',').map((s: string) => s.trim()) : []),
              ...(config.orderBy ? [config.orderBy] : []),
            ].filter(Boolean);
            const sources = contributingCols.flatMap((col) => passthrough(col));
            return { nodeId, nodeLabel, nodeType, column, synthetic: true, sources };
          }
          return { nodeId, nodeLabel, nodeType, column, sources: passthrough(column) };
        }

        // filter, branch, sort, deduplicate, union, fill-nulls, cast-type,
        // and the *-output nodes all pass every column through unchanged.
        default:
          return { nodeId, nodeLabel, nodeType, column, sources: passthrough(column) };
      }
    } finally {
      visiting.delete(visitKey);
    }
  };

  return trace(targetNodeId, targetColumn, 0);
}
