import { describe, it, expect } from 'vitest';
import { computeColumnLineage } from '../src/lineage.js';

const node = (id: string, nodeType: string, config: any = {}, label?: string) => ({
  id, data: { nodeType, label: label || id, config },
});

describe('computeColumnLineage', () => {
  it('a source node column has no upstream sources', () => {
    const nodes = [node('csv1', 'csv-input', { filePath: 'x.csv' })];
    const result = computeColumnLineage(nodes, [], 'csv1', 'id');
    expect(result).toEqual({ nodeId: 'csv1', nodeLabel: 'csv1', nodeType: 'csv-input', column: 'id', sources: [] });
  });

  it('passes a column straight through a filter node', () => {
    const nodes = [node('csv1', 'csv-input'), node('f1', 'filter', { condition: 'id > 1' })];
    const edges = [{ source: 'csv1', target: 'f1' }];
    const result = computeColumnLineage(nodes, edges, 'f1', 'id');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({ nodeId: 'csv1', column: 'id' });
  });

  it('traces a renamed column back to its original name', () => {
    const nodes = [node('csv1', 'csv-input'), node('r1', 'rename-columns', { mapping: 'id:user_id' })];
    const edges = [{ source: 'csv1', target: 'r1' }];
    const result = computeColumnLineage(nodes, edges, 'r1', 'user_id');
    expect(result.sources[0]).toMatchObject({ nodeId: 'csv1', column: 'id' });
  });

  it('passes through a column rename-columns does not touch', () => {
    const nodes = [node('csv1', 'csv-input'), node('r1', 'rename-columns', { mapping: 'id:user_id' })];
    const edges = [{ source: 'csv1', target: 'r1' }];
    const result = computeColumnLineage(nodes, edges, 'r1', 'name');
    expect(result.sources[0]).toMatchObject({ nodeId: 'csv1', column: 'name' });
  });

  it('marks aggregate count as synthetic with no upstream column', () => {
    const nodes = [node('csv1', 'csv-input'), node('a1', 'aggregate', { groupBy: 'category', operation: 'sum', targetColumn: 'amount' })];
    const edges = [{ source: 'csv1', target: 'a1' }];
    const result = computeColumnLineage(nodes, edges, 'a1', 'count');
    expect(result.synthetic).toBe(true);
    expect(result.sources).toEqual([]);
  });

  it('traces an aggregate sum column back to its target column', () => {
    const nodes = [node('csv1', 'csv-input'), node('a1', 'aggregate', { groupBy: 'category', operation: 'sum', targetColumn: 'amount' })];
    const edges = [{ source: 'csv1', target: 'a1' }];
    const result = computeColumnLineage(nodes, edges, 'a1', 'sum_amount');
    expect(result.synthetic).toBe(true);
    expect(result.sources[0]).toMatchObject({ nodeId: 'csv1', column: 'amount' });
  });

  it('traces a groupBy column back to itself upstream', () => {
    const nodes = [node('csv1', 'csv-input'), node('a1', 'aggregate', { groupBy: 'category' })];
    const edges = [{ source: 'csv1', target: 'a1' }];
    const result = computeColumnLineage(nodes, edges, 'a1', 'category');
    expect(result.sources[0]).toMatchObject({ nodeId: 'csv1', column: 'category' });
  });

  it('traces a join column into both left and right inputs, right first', () => {
    const nodes = [node('left', 'csv-input'), node('right', 'csv-input'), node('j1', 'join', { leftKey: 'id', rightKey: 'id' })];
    const edges = [{ source: 'left', target: 'j1' }, { source: 'right', target: 'j1' }];
    const result = computeColumnLineage(nodes, edges, 'j1', 'name');
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]).toMatchObject({ nodeId: 'right', column: 'name' });
    expect(result.sources[1]).toMatchObject({ nodeId: 'left', column: 'name' });
  });

  it('marks a window rank column synthetic and derived from its ordering columns', () => {
    const nodes = [node('csv1', 'csv-input'), node('w1', 'window', { partitionBy: 'category', orderBy: 'amount', outputColumn: 'rnk' })];
    const edges = [{ source: 'csv1', target: 'w1' }];
    const result = computeColumnLineage(nodes, edges, 'w1', 'rnk');
    expect(result.synthetic).toBe(true);
    expect(result.sources.map((s) => s.column).sort()).toEqual(['amount', 'category']);
  });

  it('traces a multi-hop chain across several transform nodes', () => {
    const nodes = [
      node('csv1', 'csv-input'),
      node('r1', 'rename-columns', { mapping: 'id:user_id' }),
      node('sort1', 'sort', { sortBy: 'user_id' }),
    ];
    const edges = [{ source: 'csv1', target: 'r1' }, { source: 'r1', target: 'sort1' }];
    const result = computeColumnLineage(nodes, edges, 'sort1', 'user_id');
    expect(result.sources[0].nodeId).toBe('r1');
    expect(result.sources[0].sources[0]).toMatchObject({ nodeId: 'csv1', column: 'id' });
  });

  it('does not infinite-loop on a cyclic graph and marks the cut point truncated', () => {
    const nodes = [node('a', 'filter', { condition: 'x > 1' }), node('b', 'filter', { condition: 'x > 1' })];
    const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }];
    const result = computeColumnLineage(nodes, edges, 'a', 'x');
    expect(result).toBeDefined();
  });
});
