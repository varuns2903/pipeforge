import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PipelineEngine } from '../src/engine.js';

const _dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(_dirname, '../../../uploads');
const tsvPath = path.join(uploadsDir, '__test_csvDelimiter.tsv');
const semicolonPath = path.join(uploadsDir, '__test_csvDelimiter.txt');

describe('PipelineEngine csv-input delimiter', () => {
  const engine = new PipelineEngine();

  beforeAll(() => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(tsvPath, 'name\tage\tcountry\nAlice\t28\tUS\nBob\t17\tUK\n');
    fs.writeFileSync(semicolonPath, 'name;age;country\nAlice;28;US\n');
  });

  afterAll(() => {
    for (const f of [tsvPath, semicolonPath]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it('defaults to comma-delimited parsing when no delimiter is configured', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'In', config: { filePath: 'mock' } } }],
      edges: []
    };
    const result = await engine.execute(pipeline);
    expect(result['1']!.length).toBe(4); // mock dataset unaffected
  });

  it('parses a tab-delimited file when delimiter is set to \\t', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'In', config: { filePath: '__test_csvDelimiter.tsv', delimiter: '\t' } } }],
      edges: []
    };
    const result = await engine.execute(pipeline);
    expect(result['1']).toEqual([
      { name: 'Alice', age: 28, country: 'US' },
      { name: 'Bob', age: 17, country: 'UK' },
    ]);
  });

  it('parses a semicolon-delimited file when delimiter is set to ;', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'In', config: { filePath: '__test_csvDelimiter.txt', delimiter: ';' } } }],
      edges: []
    };
    const result = await engine.execute(pipeline);
    expect(result['1']).toEqual([{ name: 'Alice', age: 28, country: 'US' }]);
  });

  it('mis-parses a tab-delimited file into one column per row when no delimiter is configured', async () => {
    // Documents the default behavior: without an explicit delimiter, a TSV
    // file is read as a single comma-delimited column (no commas present),
    // which is why the config option exists.
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'In', config: { filePath: '__test_csvDelimiter.tsv' } } }],
      edges: []
    };
    const result = await engine.execute(pipeline);
    expect(Object.keys(result['1']![0])).toEqual(['name\tage\tcountry']);
  });
});
