import { describe, it, expect, vi } from 'vitest';
import { triggerDownstream, MAX_TRIGGER_DEPTH } from '../src/triggerDownstream';

function makeDeps(overrides: Partial<any> = {}) {
  return {
    pipelineModel: { findOne: vi.fn().mockResolvedValue(null) },
    projectModel: { findById: vi.fn(() => ({ select: vi.fn().mockResolvedValue(null) })) },
    executionModel: { create: vi.fn() },
    jobQueue: { add: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
}

describe('triggerDownstream', () => {
  it('does nothing when the source pipeline has no trigger targets', async () => {
    const deps = makeDeps();
    await triggerDownstream({ _id: 'a', triggerPipelineIds: [] }, 0, deps as any);
    expect(deps.pipelineModel.findOne).not.toHaveBeenCalled();
  });

  it('stops without querying when the depth limit is reached', async () => {
    const deps = makeDeps();
    await triggerDownstream({ _id: 'a', triggerPipelineIds: ['b'] }, MAX_TRIGGER_DEPTH, deps as any);
    expect(deps.pipelineModel.findOne).not.toHaveBeenCalled();
  });

  it('skips a target pipeline that no longer exists', async () => {
    const deps = makeDeps({ pipelineModel: { findOne: vi.fn().mockResolvedValue(null) } });
    await triggerDownstream({ _id: 'a', triggerPipelineIds: ['b'] }, 0, deps as any);
    expect(deps.executionModel.create).not.toHaveBeenCalled();
    expect(deps.jobQueue.add).not.toHaveBeenCalled();
  });

  it('skips a target pipeline that fails validation', async () => {
    const deps = makeDeps({
      pipelineModel: {
        findOne: vi.fn().mockResolvedValue({ _id: 'b', projectId: 'p1', nodes: [], edges: [] }),
      },
    });
    await triggerDownstream({ _id: 'a', triggerPipelineIds: ['b'] }, 0, deps as any);
    // An empty-nodes pipeline fails PipelineValidator (no nodes to run).
    expect(deps.executionModel.create).not.toHaveBeenCalled();
    expect(deps.jobQueue.add).not.toHaveBeenCalled();
  });

  it('skips a target whose project/owner cannot be resolved', async () => {
    const deps = makeDeps({
      pipelineModel: {
        findOne: vi.fn().mockResolvedValue({
          _id: 'b', projectId: 'p1',
          nodes: [{ id: 'n1', data: { nodeType: 'csv-input', label: 'CSV', config: { filePath: 'x' } } }], edges: [],
        }),
      },
      projectModel: { findById: vi.fn(() => ({ select: vi.fn().mockResolvedValue(null) })) },
    });
    await triggerDownstream({ _id: 'a', triggerPipelineIds: ['b'] }, 0, deps as any);
    expect(deps.executionModel.create).not.toHaveBeenCalled();
  });

  it('queues a triggered execution for a valid target, incrementing depth', async () => {
    const createdExecution = { _id: { toString: () => 'exec-1' } };
    const deps = makeDeps({
      pipelineModel: {
        findOne: vi.fn().mockResolvedValue({
          _id: 'b', projectId: 'p1',
          nodes: [{ id: 'n1', data: { nodeType: 'csv-input', label: 'CSV', config: { filePath: 'x' } } }], edges: [],
        }),
      },
      projectModel: { findById: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ ownerId: 'owner-1' }) })) },
      executionModel: { create: vi.fn().mockResolvedValue(createdExecution) },
    });

    await triggerDownstream({ _id: 'a', triggerPipelineIds: ['b'] }, 2, deps as any);

    expect(deps.executionModel.create).toHaveBeenCalledWith(expect.objectContaining({
      pipelineId: 'b', projectId: 'p1', ownerId: 'owner-1', status: 'PENDING',
    }));
    expect(deps.jobQueue.add).toHaveBeenCalledWith('triggered-execution', expect.objectContaining({
      executionId: 'exec-1', triggerDepth: 3,
    }), expect.any(Object));
  });

  it('continues to the next target when one target throws', async () => {
    const createdExecution = { _id: { toString: () => 'exec-2' } };
    const pipelineModel = {
      findOne: vi.fn()
        .mockRejectedValueOnce(new Error('db error'))
        .mockResolvedValueOnce({
          _id: 'c', projectId: 'p1',
          nodes: [{ id: 'n1', data: { nodeType: 'csv-input', label: 'CSV', config: { filePath: 'x' } } }], edges: [],
        }),
    };
    const deps = makeDeps({
      pipelineModel,
      projectModel: { findById: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ ownerId: 'owner-1' }) })) },
      executionModel: { create: vi.fn().mockResolvedValue(createdExecution) },
    });

    await triggerDownstream({ _id: 'a', triggerPipelineIds: ['b', 'c'] }, 0, deps as any);

    expect(pipelineModel.findOne).toHaveBeenCalledTimes(2);
    expect(deps.jobQueue.add).toHaveBeenCalledTimes(1);
  });
});
