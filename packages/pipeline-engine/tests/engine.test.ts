import { describe, it, expect } from 'vitest';
import { PipelineEngine } from '../src/engine.js';

describe('PipelineEngine', () => {
  const engine = new PipelineEngine();

  it('should execute a simple filter pipeline', async () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'filter', label: 'Filter', config: { condition: 'row.age >= 18' } } },
        { id: '3', data: { nodeType: 'select-columns', label: 'Select', config: { columns: 'name, country' } } }
      ],
      edges: [
        { source: '1', target: '2' },
        { source: '2', target: '3' }
      ]
    };

    const result = await engine.execute(pipeline);
    
    // Node 1: mock data has 4 rows
    expect(result['1']).toBeDefined();
    expect(result['1']!.length).toBe(4);
    
    // Node 2: filter age >= 18 (Alice 28, Charlie 34)
    expect(result['2']).toBeDefined();
    expect(result['2']!.length).toBe(2);
    expect(result['2']![0].name).toBe('Alice');

    // Node 3: select columns name, country
    expect(result['3']).toBeDefined();
    expect(result['3']!.length).toBe(2);
    expect(Object.keys(result['3']![0])).toEqual(['name', 'country']);
  });

  it('should throw an error for invalid pipeline', async () => {
    const pipeline = { nodes: [], edges: [] }; // Invalid
    await expect(engine.execute(pipeline)).rejects.toThrow(/validation failed/);
  });

  it('should not allow csv-input to read files outside the uploads directory', async () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: '../../../.env' } } }
      ],
      edges: []
    };

    await expect(engine.execute(pipeline)).rejects.toThrow(/Invalid file path/);
  });
});
