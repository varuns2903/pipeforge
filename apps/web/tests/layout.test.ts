import { describe, it, expect } from 'vitest';
import { Position } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { getLayoutedElements } from '../src/components/editor/layout';

function makeNode(id: string): Node {
  return { id, position: { x: 0, y: 0 }, data: {} };
}

describe('getLayoutedElements', () => {
  it('assigns every node a computed position, leaving edges untouched', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

    const result = getLayoutedElements(nodes, edges, 'TB');

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toBe(edges);
    for (const node of result.nodes) {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(Number.isNaN(node.position.x)).toBe(false);
      expect(Number.isNaN(node.position.y)).toBe(false);
    }
  });

  it('stacks connected nodes vertically for top-to-bottom direction', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

    const result = getLayoutedElements(nodes, edges, 'TB');
    const a = result.nodes.find(n => n.id === 'a')!;
    const b = result.nodes.find(n => n.id === 'b')!;

    expect(b.position.y).toBeGreaterThan(a.position.y);
    expect(a.sourcePosition).toBe(Position.Bottom);
    expect(a.targetPosition).toBe(Position.Top);
  });

  it('lays connected nodes out horizontally for left-to-right direction', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

    const result = getLayoutedElements(nodes, edges, 'LR');
    const a = result.nodes.find(n => n.id === 'a')!;
    const b = result.nodes.find(n => n.id === 'b')!;

    expect(b.position.x).toBeGreaterThan(a.position.x);
    expect(a.sourcePosition).toBe(Position.Right);
    expect(a.targetPosition).toBe(Position.Left);
  });

  it('handles an empty pipeline', () => {
    const result = getLayoutedElements([], []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});
