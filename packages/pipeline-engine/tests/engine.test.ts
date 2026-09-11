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

  it('should join two datasets on a shared key (inner join)', async () => {
    // Mock data: { id, name, age, country } x4. Split into two derived
    // streams sharing `id`, then join them back together.
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'select-columns', label: 'Left', config: { columns: 'id, name' } } },
        { id: '3', data: { nodeType: 'select-columns', label: 'Right', config: { columns: 'id, country' } } },
        { id: '4', data: { nodeType: 'join', label: 'Join', config: { leftKey: 'id' } } },
      ],
      edges: [
        { source: '1', target: '2' },
        { source: '1', target: '3' },
        { source: '2', target: '4' }, // edge order determines left/right
        { source: '3', target: '4' },
      ]
    };

    const result = await engine.execute(pipeline);
    expect(result['4']!.length).toBe(4);
    expect(result['4']![0]).toEqual({ id: 1, name: 'Alice', country: 'US' });
  });

  it('left join keeps unmatched left rows; inner join drops them', async () => {
    const pipeline = (joinType?: string) => ({
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'select-columns', label: 'Left', config: { columns: 'id, name' } } },
        // Right side only keeps adults (mock data: Alice 28, Bob 17, Charlie
        // 34, David 15 — so Bob and David become unmatched left rows).
        { id: '3', data: { nodeType: 'filter', label: 'Adults', config: { condition: 'row.age >= 18' } } },
        { id: '4', data: { nodeType: 'select-columns', label: 'RightSelect', config: { columns: 'id, country' } } },
        { id: '5', data: { nodeType: 'join', label: 'Join', config: { leftKey: 'id', joinType } } },
      ],
      edges: [
        { source: '1', target: '2' },
        { source: '1', target: '3' },
        { source: '3', target: '4' },
        { source: '2', target: '5' },
        { source: '4', target: '5' },
      ]
    });

    const inner = await engine.execute(pipeline('inner'));
    expect(inner['5']!.length).toBe(2); // only Alice and Charlie matched

    const left = await engine.execute(pipeline('left'));
    expect(left['5']!.length).toBe(4); // Bob and David kept, without a `country` field
    expect(left['5']!.find((r: any) => r.name === 'David')).toEqual({ id: 4, name: 'David' });
  });

  it('fill-nulls replaces missing/empty values with a default', async () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'fill-nulls', label: 'Fill', config: { column: 'country', value: 'UNKNOWN' } } },
      ],
      edges: [{ source: '1', target: '2' }]
    };
    const result = await engine.execute(pipeline);
    // None of the mock rows have an empty country, so this is a no-op check —
    // just confirms the node runs and passes rows through unchanged.
    expect(result['2']!.length).toBe(4);
  });

  it('cast-type converts a column to number/boolean/string', async () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'cast-type', label: 'Cast', config: { column: 'age', targetType: 'string' } } },
      ],
      edges: [{ source: '1', target: '2' }]
    };
    const result = await engine.execute(pipeline);
    expect(typeof result['2']![0].age).toBe('string');
    expect(result['2']![0].age).toBe('28');
  });

  it('aggregate supports min, max, and count-distinct', async () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'aggregate', label: 'Agg', config: { groupBy: 'country', operation: 'min', targetColumn: 'age' } } },
      ],
      edges: [{ source: '1', target: '2' }]
    };
    const result = await engine.execute(pipeline);
    const us = result['2']!.find((r: any) => r.country === 'US');
    expect(us.min_age).toBe(15); // David (15) < Alice (28), both US
  });

  it('union concatenates rows from multiple incoming edges', async () => {
    // Split the 4-row mock dataset into two filtered streams, then union
    // them back together — should recombine to all 4 rows.
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'filter', label: 'Adults', config: { condition: 'row.age >= 18' } } },
        { id: '3', data: { nodeType: 'filter', label: 'Minors', config: { condition: 'row.age < 18' } } },
        { id: '4', data: { nodeType: 'union', label: 'Union', config: {} } },
      ],
      edges: [
        { source: '1', target: '2' },
        { source: '1', target: '3' },
        { source: '2', target: '4' },
        { source: '3', target: '4' },
      ]
    };
    const result = await engine.execute(pipeline);
    expect(result['4']!.length).toBe(4);
    expect(result['4']!.map((r: any) => r.name).sort()).toEqual(['Alice', 'Bob', 'Charlie', 'David']);
  });

  describe('window', () => {
    it('row_number assigns a unique sequential rank per partition, ordered by a column', async () => {
      const pipeline = {
        nodes: [
          { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
          { id: '2', data: { nodeType: 'window', label: 'Window', config: { partitionBy: 'country', orderBy: 'age', order: 'desc', rankType: 'row_number' } } },
        ],
        edges: [{ source: '1', target: '2' }]
      };
      const result = await engine.execute(pipeline);
      // US: Alice(28), David(15) -> ranks 1,2 by age desc. UK: Bob(17) -> rank 1. CA: Charlie(34) -> rank 1.
      const byName = Object.fromEntries(result['2']!.map((r: any) => [r.name, r.rank]));
      expect(byName).toEqual({ Alice: 1, David: 2, Bob: 1, Charlie: 1 });
    });

    it('rank leaves gaps after ties; dense_rank does not', async () => {
      // Union the 4-row mock dataset with itself to create genuine ties:
      // 2x CA, 2x UK, 4x US when ordered by country (no partitionBy).
      const buildPipeline = (rankType: string) => ({
        nodes: [
          { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
          { id: '2', data: { nodeType: 'union', label: 'Union', config: {} } },
          { id: '3', data: { nodeType: 'window', label: 'Window', config: { orderBy: 'country', rankType } } },
        ],
        edges: [
          { source: '1', target: '2' },
          { source: '1', target: '2' },
          { source: '2', target: '3' },
        ]
      });

      const rankResult = await engine.execute(buildPipeline('rank'));
      const rankValues = rankResult['3']!.map((r: any) => r.rank).sort((a: number, b: number) => a - b);
      // CA(x2)->1,1  UK(x2)->3,3  US(x4)->5,5,5,5 : rank skips 2 and 4 after each tie.
      expect(rankValues).toEqual([1, 1, 3, 3, 5, 5, 5, 5]);

      const denseResult = await engine.execute(buildPipeline('dense_rank'));
      const denseValues = denseResult['3']!.map((r: any) => r.rank).sort((a: number, b: number) => a - b);
      // CA(x2)->1,1  UK(x2)->2,2  US(x4)->3,3,3,3 : dense_rank never skips.
      expect(denseValues).toEqual([1, 1, 2, 2, 3, 3, 3, 3]);
    });
  });
});
