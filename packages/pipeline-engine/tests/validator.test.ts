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
});
