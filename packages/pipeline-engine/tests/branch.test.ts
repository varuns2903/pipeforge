import { describe, it, expect } from 'vitest';
import { PipelineEngine } from '../src/engine.js';

describe('PipelineEngine branch', () => {
  const engine = new PipelineEngine();

  it('routes matching rows to the true output and the rest to false', async () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'branch', label: 'Adults?', config: { condition: 'row.age >= 18' } } },
        { id: '3', data: { nodeType: 'cast-type', label: 'Adults', config: { column: 'age', targetType: 'number' } } },
        { id: '4', data: { nodeType: 'cast-type', label: 'Minors', config: { column: 'age', targetType: 'number' } } },
      ],
      edges: [
        { source: '1', target: '2' },
        { source: '2', sourceHandle: 'true', target: '3' },
        { source: '2', sourceHandle: 'false', target: '4' },
      ]
    };
    const result = await engine.execute(pipeline);
    // mock: Alice(28), Bob(17), Charlie(34), David(15)
    expect((result['3'] as any[]).map((r: any) => r.name).sort()).toEqual(['Alice', 'Charlie']);
    expect((result['4'] as any[]).map((r: any) => r.name).sort()).toEqual(['Bob', 'David']);
  });

  it('sends every row down true and none down false when no condition is set', async () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'branch', label: 'Branch', config: {} } },
      ],
      edges: [{ source: '1', target: '2' }]
    };
    const validator = await import('../src/validator.js');
    const v = new validator.PipelineValidator();
    const result = v.validate(pipeline);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('requires a condition');
  });

  it('keeps every row (branch does not drop rows the way filter does)', async () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'branch', label: 'Branch', config: { condition: 'row.country === "US"' } } },
        { id: '3', data: { nodeType: 'union', label: 'Recombine', config: {} } },
      ],
      edges: [
        { source: '1', target: '2' },
        { source: '2', sourceHandle: 'true', target: '3' },
        { source: '2', sourceHandle: 'false', target: '3' },
      ]
    };
    const result = await engine.execute(pipeline);
    expect((result['3'] as any[]).length).toBe(4);
  });

  it('lets downstream nodes read only the true branch when only that side is wired', async () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'branch', label: 'Branch', config: { condition: 'row.country === "US"' } } },
        { id: '3', data: { nodeType: 'sort', label: 'Sort', config: { sortBy: 'age' } } },
      ],
      edges: [
        { source: '1', target: '2' },
        { source: '2', sourceHandle: 'true', target: '3' },
      ]
    };
    const result = await engine.execute(pipeline);
    expect((result['3'] as any[]).map((r: any) => r.name)).toEqual(['David', 'Alice']);
  });
});
