import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useHistory } from '../src/components/editor/useHistory';

// Wraps useHistory together with the nodes/edges state it operates on, the
// same way PipelineEditor.tsx does, so the hook can be exercised end to end
// (push -> mutate -> undo -> redo) rather than testing it in isolation.
function useHarness() {
  const [nodes, setNodes] = useState<any[]>([{ id: '1' }]);
  const [edges, setEdges] = useState<any[]>([]);
  const history = useHistory(nodes, edges, setNodes, setEdges);
  return { nodes, edges, setNodes, setEdges, ...history };
}

describe('useHistory', () => {
  it('starts with nothing to undo or redo', () => {
    const { result } = renderHook(() => useHarness());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo restores the pre-change snapshot, redo re-applies it', () => {
    const { result } = renderHook(() => useHarness());

    act(() => {
      result.current.pushHistory();
      result.current.setNodes([{ id: '1' }, { id: '2' }]);
    });
    expect(result.current.nodes).toEqual([{ id: '1' }, { id: '2' }]);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.nodes).toEqual([{ id: '1' }]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.nodes).toEqual([{ id: '1' }, { id: '2' }]);
    expect(result.current.canRedo).toBe(false);
  });

  it('a new pushHistory after an undo clears the redo stack', () => {
    const { result } = renderHook(() => useHarness());

    act(() => {
      result.current.pushHistory();
      result.current.setNodes([{ id: '1' }, { id: '2' }]);
    });
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.pushHistory();
      result.current.setNodes([{ id: '1' }, { id: '3' }]);
    });
    expect(result.current.canRedo).toBe(false);
  });

  it('undo/redo on an empty stack is a no-op', () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.undo());
    expect(result.current.nodes).toEqual([{ id: '1' }]);
    act(() => result.current.redo());
    expect(result.current.nodes).toEqual([{ id: '1' }]);
  });

  it('resetHistory clears both stacks', () => {
    const { result } = renderHook(() => useHarness());
    act(() => {
      result.current.pushHistory();
      result.current.setNodes([{ id: '1' }, { id: '2' }]);
    });
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.resetHistory());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('caps history at 50 entries', () => {
    const { result } = renderHook(() => useHarness());
    for (let i = 0; i < 60; i++) {
      act(() => {
        result.current.pushHistory();
        result.current.setNodes([{ id: String(i) }]);
      });
    }
    // Undo 50 times should be possible...
    for (let i = 0; i < 50; i++) {
      act(() => result.current.undo());
    }
    expect(result.current.canUndo).toBe(false);
    // ...but the 51st undo has nothing left, so the oldest pushes were dropped.
    act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
  });
});
