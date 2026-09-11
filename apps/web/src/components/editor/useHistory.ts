import { useCallback, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';

type Snapshot = { nodes: Node[]; edges: Edge[] };

// Capped so a long editing session can't grow this unboundedly in memory.
const MAX_HISTORY = 50;

/**
 * Undo/redo for the pipeline canvas. Deliberately coarse-grained: a snapshot
 * is pushed at the start of a discrete action (adding a node, connecting an
 * edge, starting a drag, deleting something) rather than on every field
 * keystroke in the config panel — per-character undo for text fields would
 * be more noise than help. `pushHistory` must be called by the caller
 * *before* the mutating state update, so it captures the pre-change state.
 */
export function useHistory(
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[]) => void,
  setEdges: (edges: Edge[]) => void,
) {
  const [history, setHistory] = useState<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });

  // Always-current refs so pushHistory (called synchronously right before a
  // mutation) captures the real pre-change state, not a stale render's
  // closure over `nodes`/`edges`.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const pushHistory = useCallback(() => {
    setHistory(prev => ({
      past: [...prev.past, { nodes: nodesRef.current, edges: edgesRef.current }].slice(-MAX_HISTORY),
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    if (history.past.length === 0) return;
    const prevSnapshot = history.past[history.past.length - 1]!;
    setHistory({
      past: history.past.slice(0, -1),
      future: [{ nodes: nodesRef.current, edges: edgesRef.current }, ...history.future],
    });
    setNodes(prevSnapshot.nodes);
    setEdges(prevSnapshot.edges);
  }, [history, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (history.future.length === 0) return;
    const nextSnapshot = history.future[0]!;
    setHistory({
      past: [...history.past, { nodes: nodesRef.current, edges: edgesRef.current }],
      future: history.future.slice(1),
    });
    setNodes(nextSnapshot.nodes);
    setEdges(nextSnapshot.edges);
  }, [history, setNodes, setEdges]);

  // Clears the stack — call when loading a different pipeline into the same
  // mounted editor, so "undo" can never jump into an unrelated pipeline's
  // nodes/edges.
  const resetHistory = useCallback(() => {
    setHistory({ past: [], future: [] });
  }, []);

  return {
    pushHistory,
    undo,
    redo,
    resetHistory,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
