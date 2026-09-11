import { PipelineValidator } from './validator.js';
import { compileFilterCondition } from './safeFilter.js';
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client as PgClient } from 'pg';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import ExcelJS from 'exceljs';

// The engine holds every node's full output in memory for the duration of a
// run (context: ExecutionContext), so a dataset with unbounded rows can OOM
// the worker process. This caps it at the source (file reads) and at the one
// node type that can multiply row count (join), rather than attempting true
// streaming through every stateful transform (sort/aggregate/dedupe/join all
// need to see the whole dataset anyway).
const MAX_ROWS = parseInt(process.env.MAX_PIPELINE_ROWS || '200000', 10);

// Resolves a user-supplied config.filePath to an absolute path, rejecting
// anything that would escape the uploads directory (e.g. "../../.env").
function resolveUploadPath(filePath: string): string {
  const _filename = fileURLToPath(import.meta.url);
  const _dirname = path.dirname(_filename);
  // engine is built in dist/, so root is ../../../
  const repoRoot = path.resolve(_dirname, '../../../');
  const uploadsRoot = path.join(repoRoot, 'uploads');

  const relativePath = String(filePath).replace(/^\/?(uploads\/)?/, '');
  const fullPath = path.resolve(uploadsRoot, relativePath);

  if (fullPath !== uploadsRoot && !fullPath.startsWith(uploadsRoot + path.sep)) {
    throw new Error('Invalid file path: must be inside the uploads directory');
  }
  return fullPath;
}

// ExcelJS cell values aren't always primitives: a formula cell comes back as
// { formula, result }, and dates as real Date objects — normalize both to
// what the rest of the engine (and JSON serialization of results) expects.
function normalizeExcelCell(value: any): any {
  if (value && typeof value === 'object') {
    if ('result' in value) return normalizeExcelCell(value.result);
    if (value instanceof Date) return value.toISOString();
    if ('text' in value) return value.text; // rich text
  }
  return value ?? null;
}

// A node's output is normally a flat row array. `branch` is the one
// exception — it routes rows down two named outputs ("true"/"false")
// instead of concatenating them, so its output is keyed by branch name
// instead. Downstream edges pick the right branch via their sourceHandle.
export type BranchOutput = { true: any[]; false: any[] };
export function isBranchOutput(value: any): value is BranchOutput {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export interface ExecutionContext {
  [nodeId: string]: any[] | BranchOutput;
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
      // two input datasets kept separate. When the source is a `branch` node,
      // sourceHandle ("true"/"false") picks which of its two outputs this
      // edge actually carries.
      const incomingEdges = edges.filter((e: any) => e.target === nodeId);
      const inputs: any[][] = incomingEdges.map((edge: any) => {
        const sourceOutput = context[edge.source];
        if (isBranchOutput(sourceOutput)) {
          return sourceOutput[(edge.sourceHandle as 'true' | 'false') || 'true'] || [];
        }
        return sourceOutput || [];
      });

      try {
        const startTime = Date.now();
        if (callbacks?.onNodeStart) {
          callbacks.onNodeStart(nodeId, node.data.nodeType, node.data.label || nodeId);
        }

        const outputData = await this.executeNode(node.data.nodeType, config, inputs);
        context[nodeId] = outputData;

        const duration = Date.now() - startTime;
        const rowCount = isBranchOutput(outputData)
          ? outputData.true.length + outputData.false.length
          : outputData.length;
        if (callbacks?.onNodeComplete) {
          callbacks.onNodeComplete(nodeId, duration, rowCount);
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

  private async executeNode(type: string, config: any, inputs: any[][]): Promise<any[] | BranchOutput> {
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
          let fullPath: string;
          try {
            fullPath = resolveUploadPath(config.filePath);
          } catch (err: any) {
            return reject(err);
          }

          if (!fs.existsSync(fullPath)) {
            return reject(new Error(`File not found: ${config.filePath}`));
          }

          const results: any[] = [];
          const stream = fs.createReadStream(fullPath).pipe(parse({
            columns: true,
            skip_empty_lines: true,
            delimiter: config.delimiter || ',',
            cast: (value) => {
              if (value === 'true') return true;
              if (value === 'false') return false;
              if (value.trim() !== '' && !isNaN(Number(value))) return Number(value);
              return value;
            }
          }));
          stream
            .on('data', (data) => {
              results.push(data);
              if (results.length > MAX_ROWS) {
                stream.destroy();
                reject(new Error(`Dataset exceeds the maximum of ${MAX_ROWS} rows (MAX_PIPELINE_ROWS).`));
              }
            })
            .on('close', () => {
              if (results.length <= MAX_ROWS) resolve(results);
            })
            .on('error', (err) => reject(err));
        });

      case 'json-input': {
        if (!config.filePath) {
          throw new Error('json-input requires a filePath');
        }
        const fullPath = resolveUploadPath(config.filePath);
        if (!fs.existsSync(fullPath)) {
          throw new Error(`File not found: ${config.filePath}`);
        }
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        if (rows.length > MAX_ROWS) {
          throw new Error(`Dataset exceeds the maximum of ${MAX_ROWS} rows (MAX_PIPELINE_ROWS).`);
        }
        return rows;
      }

      case 'excel-input': {
        if (!config.filePath) {
          throw new Error('excel-input requires a filePath');
        }
        const fullPath = resolveUploadPath(config.filePath);
        if (!fs.existsSync(fullPath)) {
          throw new Error(`File not found: ${config.filePath}`);
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(fullPath);
        const worksheet = config.sheetName
          ? workbook.getWorksheet(config.sheetName)
          : workbook.worksheets[Number(config.sheetIndex) || 0];
        if (!worksheet) {
          throw new Error(`Sheet not found: ${config.sheetName || `index ${config.sheetIndex || 0}`}`);
        }

        let headers: string[] = [];
        const rows: any[] = [];
        worksheet.eachRow((row, rowNumber) => {
          // row.values is 1-indexed with values[0] always undefined.
          const cells = (row.values as any[]).slice(1).map(normalizeExcelCell);
          if (rowNumber === 1) {
            headers = cells.map((c, i) => (c === null || c === '' ? `column_${i + 1}` : String(c)));
            return;
          }
          const rowObj: Record<string, any> = {};
          headers.forEach((header, i) => { rowObj[header] = cells[i] ?? null; });
          rows.push(rowObj);
        });

        if (rows.length > MAX_ROWS) {
          throw new Error(`Dataset exceeds the maximum of ${MAX_ROWS} rows (MAX_PIPELINE_ROWS).`);
        }
        return rows;
      }

      // The three connector node types below expect config to already carry
      // resolved, plaintext credentials (host/user/password, access keys,
      // API tokens) — the engine itself never touches encrypted credentials
      // or a database of saved connections. It's the caller's job (the
      // worker, which has DB access) to resolve a node's `connectionId`
      // into these fields before calling execute(). This keeps the engine
      // decoupled from Mongo/encryption entirely.

      case 'postgres-input': {
        if (!config.host || !config.database || !config.user || !config.query) {
          throw new Error('postgres-input requires host, database, user, and query');
        }
        const client = new PgClient({
          host: config.host,
          port: config.port || 5432,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
          connectionTimeoutMillis: 10_000,
        });
        await client.connect();
        try {
          const result = await client.query(config.query);
          if (result.rows.length > MAX_ROWS) {
            throw new Error(`Dataset exceeds the maximum of ${MAX_ROWS} rows (MAX_PIPELINE_ROWS).`);
          }
          return result.rows;
        } finally {
          await client.end();
        }
      }

      case 's3-input': {
        if (!config.bucket || !config.region || !config.key || !config.accessKeyId || !config.secretAccessKey) {
          throw new Error('s3-input requires bucket, region, key, accessKeyId, and secretAccessKey');
        }
        const s3 = new S3Client({
          region: config.region,
          credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        });
        const response = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: config.key }));
        if (!response.Body) throw new Error(`S3 object has no body: s3://${config.bucket}/${config.key}`);

        if (config.format === 'json') {
          const text = await response.Body.transformToString();
          const parsed = JSON.parse(text);
          const rows = Array.isArray(parsed) ? parsed : [parsed];
          if (rows.length > MAX_ROWS) {
            throw new Error(`Dataset exceeds the maximum of ${MAX_ROWS} rows (MAX_PIPELINE_ROWS).`);
          }
          return rows;
        }

        // Default: CSV, streamed through the same parser/cap as csv-input.
        return new Promise((resolve, reject) => {
          const results: any[] = [];
          const stream = (response.Body as any).pipe(parse({
            columns: true,
            skip_empty_lines: true,
            delimiter: config.delimiter || ',',
            cast: (value: string) => {
              if (value === 'true') return true;
              if (value === 'false') return false;
              if (value.trim() !== '' && !isNaN(Number(value))) return Number(value);
              return value;
            }
          }));
          stream
            .on('data', (data: any) => {
              results.push(data);
              if (results.length > MAX_ROWS) {
                stream.destroy();
                reject(new Error(`Dataset exceeds the maximum of ${MAX_ROWS} rows (MAX_PIPELINE_ROWS).`));
              }
            })
            .on('close', () => {
              if (results.length <= MAX_ROWS) resolve(results);
            })
            .on('error', (err: Error) => reject(err));
        });
      }

      case 'api-input': {
        if (!config.baseUrl) {
          throw new Error('api-input requires a baseUrl');
        }
        const url = config.path ? new URL(config.path, config.baseUrl).toString() : config.baseUrl;
        const headers: Record<string, string> = { ...(config.headers || {}) };
        if (config.authType === 'bearer' && config.token) {
          headers['Authorization'] = `Bearer ${config.token}`;
        } else if (config.authType === 'header' && config.headerName && config.token) {
          headers[config.headerName] = config.token;
        }

        const response = await fetch(url, { method: config.method || 'GET', headers });
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // Optional dot-path into the response to find the row array, e.g.
        // "data.items" for { data: { items: [...] } }.
        const extracted = config.dataPath
          ? String(config.dataPath).split('.').reduce((acc: any, key: string) => acc?.[key], data)
          : data;
        const rows = Array.isArray(extracted) ? extracted : [extracted];
        if (rows.length > MAX_ROWS) {
          throw new Error(`Dataset exceeds the maximum of ${MAX_ROWS} rows (MAX_PIPELINE_ROWS).`);
        }
        return rows;
      }

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

      case 'branch': {
        // Unlike filter (which drops non-matching rows), branch keeps every
        // row — it routes each one down exactly one of two named outputs so
        // both paths can be wired to different downstream transforms.
        if (!config.condition) return { true: input, false: [] };
        const filterFn = compileFilterCondition(config.condition);
        const trueRows: any[] = [];
        const falseRows: any[] = [];
        for (const row of input) {
          let matches = false;
          try {
            matches = !!filterFn(row);
          } catch (e) {
            matches = false;
          }
          (matches ? trueRows : falseRows).push(row);
        }
        return { true: trueRows, false: falseRows };
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
            // Duplicate keys on both sides can multiply row count well past
            // either input's size — cap it the same as a source read.
            if (joined.length > MAX_ROWS) {
              throw new Error(`Join output exceeds the maximum of ${MAX_ROWS} rows (MAX_PIPELINE_ROWS).`);
            }
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

      case 'union':
        // Every node type except `join` already treats its incoming edges as
        // one flattened dataset (see `input` above) — this node exists to
        // make "combine two same-shaped datasets" a discoverable, clearly
        // labeled operation instead of an incidental side effect of wiring
        // two edges into some other transform node.
        return input;

      case 'window': {
        if (!config.orderBy) return input;
        const partitionCols = (config.partitionBy || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        const orderCol = config.orderBy;
        const orderDir = config.order === 'desc' ? -1 : 1;
        const rankType = config.rankType || 'row_number';
        const outputColumn = config.outputColumn || 'rank';

        const compareRows = (a: any, b: any) => {
          const valA = a[orderCol];
          const valB = b[orderCol];
          const numA = Number(valA);
          const numB = Number(valB);
          if (!isNaN(numA) && !isNaN(numB) && valA !== null && valA !== '' && valB !== null && valB !== '') {
            return (numA - numB) * orderDir;
          }
          return String(valA ?? '').localeCompare(String(valB ?? '')) * orderDir;
        };

        // Partition (or one group for everything, if no partitionBy) while
        // preserving each row's position for a stable final row order.
        const partitions = new Map<string, { row: any; index: number }[]>();
        input.forEach((row, index) => {
          const key = partitionCols.map((col: string) => String(row[col])).join('|');
          if (!partitions.has(key)) partitions.set(key, []);
          partitions.get(key)!.push({ row, index });
        });

        const ranked: { row: any; index: number }[] = [];
        for (const entries of partitions.values()) {
          entries.sort((a, b) => compareRows(a.row, b.row));
          let rank = 0;
          let previousKey: string | null = null;
          entries.forEach((entry, position) => {
            const currentKey = String(entry.row[orderCol]);
            if (rankType === 'row_number') {
              rank = position + 1;
            } else if (currentKey !== previousKey) {
              // 'rank': ties share a rank, next distinct value jumps by the
              // number of tied rows (SQL RANK() semantics). 'dense_rank':
              // ties share a rank, next distinct value is always +1.
              rank = rankType === 'dense_rank' ? rank + 1 : position + 1;
            }
            previousKey = currentKey;
            ranked.push({ row: { ...entry.row, [outputColumn]: rank }, index: entry.index });
          });
        }

        return ranked.sort((a, b) => a.index - b.index).map(entry => entry.row);
      }

      case 'csv-output':
      case 'json-output':
        return input;

      default:
        return input;
    }
  }
}
