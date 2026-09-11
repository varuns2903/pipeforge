import { describe, it, expect } from 'vitest';
import { PIPELINE_TEMPLATES } from '../src/lib/pipelineTemplates';

describe('PIPELINE_TEMPLATES', () => {
  it('includes a blank template with no nodes', () => {
    const blank = PIPELINE_TEMPLATES.find(t => t.id === 'blank');
    expect(blank).toBeDefined();
    expect(blank!.nodes).toEqual([]);
    expect(blank!.edges).toEqual([]);
  });

  it('every non-blank template starts with an input node and ends with an output node', () => {
    for (const template of PIPELINE_TEMPLATES.filter(t => t.id !== 'blank')) {
      expect(template.nodes.length).toBeGreaterThan(0);
      expect(template.nodes[0].data.nodeType).toContain('input');
      expect(template.nodes[template.nodes.length - 1].data.nodeType).toContain('output');
    }
  });

  it('every edge references node ids that actually exist in the same template', () => {
    for (const template of PIPELINE_TEMPLATES) {
      const nodeIds = new Set(template.nodes.map((n: any) => n.id));
      for (const edge of template.edges) {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    }
  });

  it('every node has a unique id within its template', () => {
    for (const template of PIPELINE_TEMPLATES) {
      const ids = template.nodes.map((n: any) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('the source csv-input node in every non-blank template reads the mock dataset', () => {
    for (const template of PIPELINE_TEMPLATES.filter(t => t.id !== 'blank')) {
      const source = template.nodes[0];
      expect(source.data.nodeType).toBe('csv-input');
      expect(source.data.config.filePath).toBe('mock');
    }
  });

  it('template ids are unique', () => {
    const ids = PIPELINE_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
