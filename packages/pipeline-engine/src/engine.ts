import { PipelineValidator } from './validator.js';
import { compileFilterCondition } from './safeFilter.js';
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface ExecutionContext {
  [nodeId: string]: any[]; // the output data of each node (array of objects)
}

export interface EngineCallbacks {
  onNodeStart?: (nodeId: string, nodeType: string, label: string) => void;
  onNodeComplete?: (nodeId: string, durationMs: number, rowCount: number) => void;
  onNodeError?: (nodeId: string, error: string) => void;
}

export class PipelineEngine {
  async execute(pipeline: any, callbacks?: EngineCallbacks): Promise<ExecutionContext> {
    const validator = new PipelineValidator();
    const validation = validator.validate(pipeline);
    
    if (!validation.isValid) {
      throw new Error(`Pipeline validation failed: ${validation.errors.join(' | ')}`);
    }

    const { nodes, edges } = pipeline;
    const context: ExecutionContext = {};
    
    // Topological Sort
    const adjList: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    const nodeMap: Record<string, any> = {};

    nodes.forEach((n: any) => {
      adjList[n.id] = [];
      inDegree[n.id] = 0;
      nodeMap[n.id] = n;
    });

    edges.forEach((edge: any) => {
      adjList[edge.source]!.push(edge.target);
      inDegree[edge.target]!++;
    });

    const queue: string[] = [];
    Object.keys(inDegree).forEach(nodeId => {
      if (inDegree[nodeId] === 0) queue.push(nodeId);
    });

    const sortedNodes: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sortedNodes.push(current);
      for (const neighbor of adjList[current] || []) {
        inDegree[neighbor]!--;
        if (inDegree[neighbor] === 0) queue.push(neighbor);
      }
    }

    // Execute in topological order
    for (const nodeId of sortedNodes) {
      const node = nodeMap[nodeId];
      const config = node.data.config || {};
      
      // One array per incoming edge (in edge order) rather than pre-flattened —
      // most node types just flatten these themselves, but `join` needs its
      // two input datasets kept separate.
      const incomingEdges = edges.filter((e: any) => e.target === nodeId);
      const inputs: any[][] = incomingEdges.map((edge: any) => context[edge.source] || []);

      try {
        const startTime = Date.now();
        if (callbacks?.onNodeStart) {
          callbacks.onNodeStart(nodeId, node.data.nodeType, node.data.label || nodeId);
        }

        const outputData = await this.executeNode(node.data.nodeType, config, inputs);
        context[nodeId] = outputData;

        const duration = Date.now() - startTime;
        if (callbacks?.onNodeComplete) {
          callbacks.onNodeComplete(nodeId, duration, outputData.length);
        }
        
      } catch (err: any) {
        if (callbacks?.onNodeError) {
          callbacks.onNodeError(nodeId, err.message);
        }
        throw new Error(`Node ${node.data.label || nodeId} failed: ${err.message}`);
      }
    }

    return context;
  }

  private async executeNode(type: string, config: any, inputs: any[][]): Promise<any[]> {
    // Every node type except `join` treats all its incoming edges as one
    // combined dataset (matches the pre-existing single-input behavior).
    const input = inputs.flat();

    switch (type) {
      case 'csv-input':
        if (config.filePath === 'mock' || !config.filePath) {
          return [
            { id: 1, name: 'Alice', age: 28, country: 'US' },
            { id: 2, name: 'Bob', age: 17, country: 'UK' },
            { id: 3, name: 'Charlie', age: 34, country: 'CA' },
            { id: 4, name: 'David', age: 15, country: 'US' }
          ];
        }
        
        // Handle real file reading
        return new Promise((resolve, reject) => {
          // Resolve path to the monorepo root uploads folder
          const _filename = fileURLToPath(import.meta.url);
          const _dirname = path.dirname(_filename);
          // engine is built in dist/, so root is ../../../
          const repoRoot = path.resolve(_dirname, '../../../');
          const uploadsRoot = path.join(repoRoot, 'uploads');

          // config.filePath is user-supplied; only allow files inside the uploads
          // directory and reject any attempt to escape it (e.g. "../../.env").
          const relativePath = String(config.filePath).replace(/^\/?(uploads\/)?/, '');
          const fullPath = path.resolve(uploadsRoot, relativePath);

          if (fullPath !== uploadsRoot && !fullPath.startsWith(uploadsRoot + path.sep)) {
            return reject(new Error('Invalid file path: must be inside the uploads directory'));
          }

          if (!fs.existsSync(fullPath)) {
            return reject(new Error(`File not found: ${config.filePath}`));
          }

          const results: any[] = [];
          fs.createReadStream(fullPath)
            .pipe(parse({ 
              columns: true, 
              skip_empty_lines: true, 
              cast: (value) => {
                if (value === 'true') return true;
                if (value === 'false') return false;
                if (value.trim() !== '' && !isNaN(Number(value))) return Number(value);
                return value;
              }
            }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
        });

      case 'filter': {
        if (!config.condition) return input;
        const filterFn = compileFilterCondition(config.condition);
        return input.filter((row: any) => {
          try {
            return filterFn(row);
          } catch (e) {
            return false;
          }
        });
      }

      case 'rename-columns':
        if (!config.mapping) return input;
        const mapParts = config.mapping.split(',').map((p: string) => p.trim());
        const renameMap: Record<string, string> = {};
        mapParts.forEach((p: string) => {
          const [oldCol, newCol] = p.split(':').map(s => s.trim());
          if (oldCol && newCol) renameMap[oldCol] = newCol;
        });
        
        return input.map(row => {
          const newRow = { ...row };
          for (const oldCol in renameMap) {
            if (newRow[oldCol] !== undefined) {
              const newKey = renameMap[oldCol]; if (newKey) newRow[newKey] = newRow[oldCol];
              delete newRow[oldCol];
            }
          }
          return newRow;
        });

            case 'select-columns':
        if (!config.columns) return input;
        const cols = config.columns.split(',').map((c: string) => c.trim());
        return input.map(row => {
          const newRow: any = {};
          cols.forEach((col: string) => {
            if (row[col] !== undefined) newRow[col] = row[col];
          });
          return newRow;
        });

      case 'sort':
        if (!config.sortBy) return input;
        const sortBy = config.sortBy;
        const order = config.order === 'desc' ? -1 : 1;
        
        return [...input].sort((a, b) => {
          const valA = a[sortBy];
          const valAIsNum = !isNaN(Number(valA)) && valA !== null && valA !== '';
          const valB = b[sortBy];
          const valBIsNum = !isNaN(Number(valB)) && valB !== null && valB !== '';
          
          if (valAIsNum && valBIsNum) {
            return (Number(valA) - Number(valB)) * order;
          }
          
          // String fallback
          const strA = String(valA || '');
          const strB = String(valB || '');
          return strA.localeCompare(strB) * order;
        });

      case 'deduplicate':
        if (!config.columns) return input;
        const dedupeCols = config.columns.split(',').map((c: string) => c.trim());
        const seen = new Set<string>();
        
        return input.filter(row => {
          const key = dedupeCols.map((col: string) => String(row[col])).join('|');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      case 'aggregate':
        if (!config.groupBy) return input;
        
        const groupByCols = config.groupBy.split(',').map((s: string) => s.trim()).filter(Boolean);
        const groups: Record<string, any[]> = {};
        input.forEach(row => {
          const key = groupByCols.map((col: string) => row[col] === undefined ? 'undefined' : String(row[col])).join('|');
          if (!groups[key]) groups[key] = [];
          groups[key].push(row);
        });

        const result: any[] = [];
        for (const [key, rows] of Object.entries(groups)) {
          const outRow: any = {};
          groupByCols.forEach((col: string) => {
            outRow[col] = rows[0][col]; // Preserve original type from the first row
          });
          
          // Always include count so users can do HAVING count > X on any aggregation
          outRow.count = rows.length;
          
          if (config.operation === 'sum' && config.targetColumn) {
            outRow[`sum_${config.targetColumn}`] = rows.reduce((acc, r) => acc + (Number(r[config.targetColumn]) || 0), 0);
          } else if (config.operation === 'avg' && config.targetColumn) {
            const sum = rows.reduce((acc, r) => acc + (Number(r[config.targetColumn]) || 0), 0);
            outRow[`avg_${config.targetColumn}`] = rows.length ? sum / rows.length : 0;
          } else if (config.operation === 'min' && config.targetColumn) {
            outRow[`min_${config.targetColumn}`] = rows.reduce((acc, r) => {
              const v = Number(r[config.targetColumn]);
              return acc === null || (!isNaN(v) && v < acc) ? v : acc;
            }, null as number | null);
          } else if (config.operation === 'max' && config.targetColumn) {
            outRow[`max_${config.targetColumn}`] = rows.reduce((acc, r) => {
              const v = Number(r[config.targetColumn]);
              return acc === null || (!isNaN(v) && v > acc) ? v : acc;
            }, null as number | null);
          } else if (config.operation === 'count-distinct' && config.targetColumn) {
            outRow[`count_distinct_${config.targetColumn}`] = new Set(rows.map(r => r[config.targetColumn])).size;
          }
          result.push(outRow);
        }
        return result;

      case 'join': {
        // Requires exactly two incoming edges: [left, right] in the order
        // they're connected. Unlike every other node type, join can't just
        // flatten its inputs — the two datasets are joined, not concatenated.
        const [left = [], right = []] = inputs;
        const leftKey = config.leftKey;
        const rightKey = config.rightKey || config.leftKey;
        if (!leftKey || !rightKey) return left;

        const isLeftJoin = config.joinType === 'left';
        const rightIndex = new Map<string, any[]>();
        right.forEach((row: any) => {
          const key = String(row[rightKey]);
          if (!rightIndex.has(key)) rightIndex.set(key, []);
          rightIndex.get(key)!.push(row);
        });

        const joined: any[] = [];
        for (const leftRow of left) {
          const matches = rightIndex.get(String(leftRow[leftKey])) || [];
          if (matches.length === 0) {
            if (isLeftJoin) joined.push({ ...leftRow });
            continue;
          }
          for (const rightRow of matches) {
            joined.push({ ...leftRow, ...rightRow });
          }
        }
        return joined;
      }

      case 'fill-nulls': {
        if (!config.column) return input;
        const fillValue = config.value ?? '';
        return input.map(row => {
          const value = row[config.column];
          if (value === null || value === undefined || value === '') {
            return { ...row, [config.column]: fillValue };
          }
          return row;
        });
      }

      case 'cast-type': {
        if (!config.column || !config.targetType) return input;
        const cast = (value: any): any => {
          if (value === null || value === undefined) return value;
          switch (config.targetType) {
            case 'number': {
              const n = Number(value);
              return isNaN(n) ? null : n;
            }
            case 'boolean':
              if (typeof value === 'boolean') return value;
              return ['true', '1', 'yes'].includes(String(value).toLowerCase());
            case 'string':
              return String(value);
            default:
              return value;
          }
        };
        return input.map(row => ({ ...row, [config.column]: cast(row[config.column]) }));
      }

      case 'csv-output':
        return input;

      default:
        return input;
    }
  }
}
