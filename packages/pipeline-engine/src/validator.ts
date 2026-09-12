export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  // Same messages as `errors`/`warnings`, but keyed by the node they're
  // about — lets a UI badge the exact broken node instead of only showing a
  // flat list. Messages with no single owning node (e.g. a graph-wide cycle)
  // appear in `errors`/`warnings` but not here.
  nodeErrors: Record<string, string[]>;
  nodeWarnings: Record<string, string[]>;
}

export class PipelineValidator {
  validate(pipeline: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      nodeErrors: {},
      nodeWarnings: {},
    };

    const addError = (node: any, message: string) => {
      result.errors.push(message);
      result.isValid = false;
      if (node?.id) {
        (result.nodeErrors[node.id] ??= []).push(message);
      }
    };

    const addWarning = (node: any, message: string) => {
      result.warnings.push(message);
      if (node?.id) {
        (result.nodeWarnings[node.id] ??= []).push(message);
      }
    };

    if (!pipeline || !pipeline.nodes || !pipeline.edges) {
      result.errors.push('Pipeline must contain nodes and edges arrays.');
      result.isValid = false;
      return result;
    }

    const { nodes, edges } = pipeline;

    if (nodes.length === 0) {
      result.errors.push('Pipeline must contain at least one node.');
      result.isValid = false;
    }

    // 1. Check for basic configurations
    nodes.forEach((node: any) => {
      const type = node.data?.nodeType;
      const config = node.data?.config || {};

      if (!type) {
        addError(node, `Node ${node.id} is missing a nodeType.`);
      }

      if (type === 'csv-input' && !config.filePath) {
        addError(node, `Node '${node.data.label}' (csv-input) requires a filePath.`);
      }

      if (type === 'excel-input' && !config.filePath) {
        addError(node, `Node '${node.data.label}' (excel-input) requires a filePath.`);
      }

      if (type === 'filter' && !config.condition) {
        addError(node, `Node '${node.data.label}' (filter) requires a condition.`);
      }

      if (type === 'branch' && !config.condition) {
        addError(node, `Node '${node.data.label}' (branch) requires a condition.`);
      }

      if (type === 'join' && !config.leftKey) {
        addError(node, `Node '${node.data.label}' (join) requires a leftKey.`);
      }

      if (type === 'window' && !config.orderBy) {
        addError(node, `Node '${node.data.label}' (window) requires an orderBy column.`);
      }

      if ((type === 'fill-nulls' || type === 'cast-type') && !config.column) {
        addError(node, `Node '${node.data.label}' (${type}) requires a column.`);
      }

      if (type === 'cast-type' && !config.targetType) {
        addError(node, `Node '${node.data.label}' (cast-type) requires a targetType.`);
      }

      if ((type === 'postgres-input' || type === 'mysql-input' || type === 's3-input' || type === 'api-input' || type === 'kafka-input') && !config.connectionId) {
        addError(node, `Node '${node.data.label}' (${type}) requires a connectionId.`);
      }

      if ((type === 'postgres-input' || type === 'mysql-input') && !config.query) {
        addError(node, `Node '${node.data.label}' (${type}) requires a query.`);
      }

      if (type === 's3-input' && !config.key) {
        addError(node, `Node '${node.data.label}' (s3-input) requires a key (object path in the bucket).`);
      }

      if (type === 'kafka-input' && !config.topic) {
        addError(node, `Node '${node.data.label}' (kafka-input) requires a topic.`);
      }
    });

    // 2. Build Adjacency List for Cycle Detection
    const adjList: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    const outDegree: Record<string, number> = {};

    nodes.forEach((n: any) => {
      adjList[n.id] = [];
      inDegree[n.id] = 0;
      outDegree[n.id] = 0;
    });

    edges.forEach((edge: any) => {
      if (adjList[edge.source] && adjList[edge.target]) {
        adjList[edge.source]!.push(edge.target);
        outDegree[edge.source]!++;
        inDegree[edge.target]!++;
      } else {
        result.errors.push(`Edge references missing node: ${edge.source} -> ${edge.target}`);
        result.isValid = false;
      }
    });

    // 3. Detect Cycles (Kahn's Algorithm)
    let visitedCount = 0;
    const queue: string[] = [];

    Object.keys(inDegree).forEach(nodeId => {
      if (inDegree[nodeId] === 0) {
        queue.push(nodeId);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      visitedCount++;

      const neighbors = adjList[current] || [];
      for (const neighbor of neighbors) {
        inDegree[neighbor]!--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (visitedCount !== nodes.length && nodes.length > 0) {
      result.errors.push('Cycle detected in the pipeline graph. Pipelines must be Directed Acyclic Graphs (DAGs).');
      result.isValid = false;
    }

    // 4. Warning: Disconnected Nodes or missing outputs/inputs. Recalculate
    // in-degree from the edges directly — Kahn's algorithm above consumed
    // the `inDegree` map as it ran.
    const origInDegree: Record<string, number> = {};
    nodes.forEach((n: any) => origInDegree[n.id] = 0);
    edges.forEach((edge: any) => {
      if (origInDegree[edge.target] !== undefined) {
        origInDegree[edge.target]!++;
      }
    });

    nodes.forEach((node: any) => {
      const type = node.data?.nodeType || '';
      const nin = origInDegree[node.id] || 0;
      const nout = outDegree[node.id] || 0;

      if (!type.includes('input') && nin === 0) {
        addWarning(node, `Node '${node.data.label}' has no incoming connections.`);
      }

      if (!type.includes('output') && nout === 0) {
        addWarning(node, `Node '${node.data.label}' has no outgoing connections.`);
      }

      if (type === 'join' && nin !== 2) {
        addError(node, `Node '${node.data.label}' (join) requires exactly 2 incoming connections (left and right), found ${nin}.`);
      }

      if (type === 'union' && nin < 2) {
        addError(node, `Node '${node.data.label}' (union) requires at least 2 incoming connections, found ${nin}.`);
      }
    });

    return result;
  }
}
