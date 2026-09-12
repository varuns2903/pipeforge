import { describe, it, expect } from 'vitest';
import { PipelineValidator } from '../src/validator.js';

describe('PipelineValidator', () => {
  const validator = new PipelineValidator();

  it('should validate a correct simple pipeline', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'test.csv' } } },
        { id: '2', data: { nodeType: 'csv-output', label: 'Output', config: {} } }
      ],
      edges: [
        { source: '1', target: '2' }
      ]
    };

    const result = validator.validate(pipeline);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should invalidate if pipeline is missing nodes', () => {
    const result = validator.validate({ nodes: [], edges: [] });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('at least one node');
  });

  it('should invalidate if required config is missing', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: {} } }
      ],
      edges: []
    };
    const result = validator.validate(pipeline);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('requires a filePath');
  });

  it('should invalidate a kafka-input node missing a connectionId or topic', () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'kafka-input', label: 'Orders', config: {} } }],
      edges: []
    };
    const result = validator.validate(pipeline);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Node 'Orders' (kafka-input) requires a connectionId.");
    expect(result.errors).toContain("Node 'Orders' (kafka-input) requires a topic.");
  });

  it('keys each error by the id of the node it belongs to, for UI badging', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
        { id: '2', data: { nodeType: 'filter', label: 'Bad Filter', config: {} } },
      ],
      edges: [{ source: '1', target: '2' }]
    };
    const result = validator.validate(pipeline);
    expect(result.isValid).toBe(false);
    expect(result.nodeErrors['2']).toEqual(["Node 'Bad Filter' (filter) requires a condition."]);
    expect(result.nodeErrors['1']).toBeUndefined();
  });

  it('keys warnings by node id too (e.g. a dangling node with no outgoing connection)', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
      ],
      edges: []
    };
    const result = validator.validate(pipeline);
    expect(result.nodeWarnings['1']).toEqual(["Node 'Input' has no outgoing connections."]);
  });

  it('a graph-wide error like a cycle has no single owning node', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'filter', label: 'A', config: { condition: 'true' } } },
        { id: '2', data: { nodeType: 'filter', label: 'B', config: { condition: 'true' } } },
      ],
      edges: [{ source: '1', target: '2' }, { source: '2', target: '1' }]
    };
    const result = validator.validate(pipeline);
    expect(result.errors.some(e => e.includes('Cycle detected'))).toBe(true);
    expect(result.nodeErrors['1'] || []).not.toContain(expect.stringContaining('Cycle detected'));
    expect(result.nodeErrors['2'] || []).not.toContain(expect.stringContaining('Cycle detected'));
  });

  it('should invalidate an excel-input node missing a filePath', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'excel-input', label: 'Input', config: {} } }
      ],
      edges: []
    };
    const result = validator.validate(pipeline);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('requires a filePath');
  });

  it('should detect cycles in the graph', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'transform' } },
        { id: '2', data: { nodeType: 'transform' } },
        { id: '3', data: { nodeType: 'transform' } }
      ],
      edges: [
        { source: '1', target: '2' },
        { source: '2', target: '3' },
        { source: '3', target: '1' }
      ]
    };
    const result = validator.validate(pipeline);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Cycle detected');
  });

  it('should generate warnings for disconnected nodes', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'test.csv' } } },
        { id: '2', data: { nodeType: 'transform', label: 'T', config: {} } } // disconnected
      ],
      edges: []
    };
    const result = validator.validate(pipeline);
    expect(result.warnings.some((w: string) => w.includes('T') && w.includes('incoming connections'))).toBe(true);
  });

  it('should require a join node to have a leftKey configured', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'A', config: { filePath: 'a.csv' } } },
        { id: '2', data: { nodeType: 'csv-input', label: 'B', config: { filePath: 'b.csv' } } },
        { id: '3', data: { nodeType: 'join', label: 'Join', config: {} } }
      ],
      edges: [
        { source: '1', target: '3' },
        { source: '2', target: '3' }
      ]
    };
    const result = validator.validate(pipeline);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('requires a leftKey'))).toBe(true);
  });

  it('should require a join node to have exactly 2 incoming connections', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'A', config: { filePath: 'a.csv' } } },
        { id: '3', data: { nodeType: 'join', label: 'Join', config: { leftKey: 'id' } } }
      ],
      edges: [
        { source: '1', target: '3' }
      ]
    };
    const result = validator.validate(pipeline);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('exactly 2 incoming connections'))).toBe(true);
  });

  it('should require cast-type to have a column and targetType', () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'csv-input', label: 'A', config: { filePath: 'a.csv' } } },
        { id: '2', data: { nodeType: 'cast-type', label: 'Cast', config: {} } }
      ],
      edges: [{ source: '1', target: '2' }]
    };
    const result = validator.validate(pipeline);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('requires a column'))).toBe(true);
    expect(result.errors.some((e: string) => e.includes('requires a targetType'))).toBe(true);
  });
});
