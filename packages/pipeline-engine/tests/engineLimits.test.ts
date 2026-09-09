import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set before importing the engine — MAX_ROWS is read from this env var once
// at module load time, so it must be in place before the first import.
process.env.MAX_PIPELINE_ROWS = '2';

const { PipelineEngine } = await import('../src/engine.js');

const _dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(_dirname, '../../../uploads');
const csvPath = path.join(uploadsDir, '__test_engineLimits.csv');
const jsonPath = path.join(uploadsDir, '__test_engineLimits.json');
const smallJsonPath = path.join(uploadsDir, '__test_engineLimits_small.json');

describe('PipelineEngine row limits (MAX_PIPELINE_ROWS=2)', () => {
  const engine = new PipelineEngine();

  beforeAll(() => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(csvPath, 'name\nAlice\nBob\nCharlie\n'); // 3 rows > cap
    fs.writeFileSync(jsonPath, JSON.stringify([{ n: 1 }, { n: 2 }, { n: 3 }])); // 3 rows > cap
    fs.writeFileSync(smallJsonPath, JSON.stringify([{ n: 1 }, { n: 2 }])); // exactly at cap
  });

  afterAll(() => {
    for (const f of [csvPath, jsonPath, smallJsonPath]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it('rejects a csv-input file with more rows than the cap', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'In', config: { filePath: '__test_engineLimits.csv' } } }],
      edges: []
    };
    await expect(engine.execute(pipeline)).rejects.toThrow(/exceeds the maximum of 2 rows/);
  });

  it('rejects a json-input file with more rows than the cap', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'json-input', label: 'In', config: { filePath: '__test_engineLimits.json' } } }],
      edges: []
    };
    await expect(engine.execute(pipeline)).rejects.toThrow(/exceeds the maximum of 2 rows/);
  });

  it('reads a json-input file at or under the cap', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'json-input', label: 'In', config: { filePath: '__test_engineLimits_small.json' } } }],
      edges: []
    };
    const result = await engine.execute(pipeline);
    expect(result['1']).toEqual([{ n: 1 }, { n: 2 }]);
  });
});
