export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class PipelineValidator {
  validate(pipeline: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
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
        result.errors.push(`Node ${node.id} is missing a nodeType.`);
        result.isValid = false;
      }

      if (type === 'csv-input' && !config.filePath) {
        result.errors.push(`Node '${node.data.label}' (csv-input) requires a filePath.`);
        result.isValid = false;
      }

      if (type === 'excel-input' && !config.filePath) {
        result.errors.push(`Node '${node.data.label}' (excel-input) requires a filePath.`);
        result.isValid = false;
      }
      
      if (type === 'filter' && !config.condition) {
        result.errors.push(`Node '${node.data.label}' (filter) requires a condition.`);
        result.isValid = false;
      }

      if (type === 'join' && !config.leftKey) {
        result.errors.push(`Node '${node.data.label}' (join) requires a leftKey.`);
        result.isValid = false;
      }

      if (type === 'window' && !config.orderBy) {
        result.errors.push(`Node '${node.data.label}' (window) requires an orderBy column.`);
        result.isValid = false;
      }

      if ((type === 'fill-nulls' || type === 'cast-type') && !config.column) {
        result.errors.push(`Node '${node.data.label}' (${type}) requires a column.`);
        result.isValid = false;
      }

      if (type === 'cast-type' && !config.targetType) {
        result.errors.push(`Node '${node.data.label}' (cast-type) requires a targetType.`);
        result.isValid = false;
      }

      if ((type === 'postgres-input' || type === 's3-input' || type === 'api-input') && !config.connectionId) {
        result.errors.push(`Node '${node.data.label}' (${type}) requires a connectionId.`);
        result.isValid = false;
      }

      if (type === 'postgres-input' && !config.query) {
        result.errors.push(`Node '${node.data.label}' (postgres-input) requires a query.`);
        result.isValid = false;
      }

      if (type === 's3-input' && !config.key) {
        result.errors.push(`Node '${node.data.label}' (s3-input) requires a key (object path in the bucket).`);
        result.isValid = false;
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

    // 4. Warning: Disconnected Nodes or missing outputs/inputs
    nodes.forEach((node: any) => {
      const type = node.data?.nodeType || '';
      const nodeIn = inDegree[node.id] || 0;
      const nodeOut = outDegree[node.id] || 0;
      
      // Original inDegree was modified by Kahn's, let's recalculate for checks
    });
    
    // Recalculate original inDegree
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
        result.warnings.push(`Node '${node.data.label}' has no incoming connections.`);
      }
      
      if (!type.includes('output') && nout === 0) {
        result.warnings.push(`Node '${node.data.label}' has no outgoing connections.`);
      }

      if (type === 'join' && nin !== 2) {
        result.errors.push(`Node '${node.data.label}' (join) requires exactly 2 incoming connections (left and right), found ${nin}.`);
        result.isValid = false;
      }

      if (type === 'union' && nin < 2) {
        result.errors.push(`Node '${node.data.label}' (union) requires at least 2 incoming connections, found ${nin}.`);
        result.isValid = false;
      }
    });

    return result;
  }
}
