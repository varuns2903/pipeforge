import { PipelineValidator } from '@pipeforge/pipeline-engine';
import { createLogger } from '@pipeforge/shared';

const logger = createLogger('worker');

// Guards against a pipeline-to-pipeline trigger chain looping back on
// itself (A -> B -> A) — each queued trigger job increments this, and the
// chain stops rather than running forever once it's exceeded.
export const MAX_TRIGGER_DEPTH = 5;

export interface TriggerDownstreamDeps {
  pipelineModel: { findOne: (query: any) => Promise<any> };
  projectModel: { findById: (id: any) => { select: (fields: string) => Promise<any> } };
  executionModel: { create: (doc: any) => Promise<any> };
  jobQueue: { add: (name: string, data: any, opts: any) => Promise<any> };
}

/**
 * Queues a run of each pipeline that `sourcePipeline` is configured to
 * trigger on completion (see Pipeline.triggerPipelineIds). Best-effort per
 * target — one bad target (deleted, now invalid, missing project) logs a
 * warning rather than failing the source execution that already succeeded.
 * Deps are injected (not read from module-level Mongoose models/a shared
 * queue) so this is unit-testable without a database or Redis.
 */
export async function triggerDownstream(sourcePipeline: any, depth: number, deps: TriggerDownstreamDeps) {
  const targetIds: string[] = sourcePipeline.triggerPipelineIds || [];
  if (targetIds.length === 0) return;

  if (depth >= MAX_TRIGGER_DEPTH) {
    logger.warn(
      { sourcePipelineId: (sourcePipeline._id || sourcePipeline.id)?.toString(), depth },
      'Trigger chain depth limit reached; not queuing further triggered pipelines'
    );
    return;
  }

  for (const targetId of targetIds) {
    try {
      const targetPipeline = await deps.pipelineModel.findOne({ _id: targetId, deletedAt: null });
      if (!targetPipeline) {
        logger.warn({ targetId }, 'Triggered pipeline not found or deleted; skipping');
        continue;
      }

      const validation = new PipelineValidator().validate(targetPipeline);
      if (!validation.isValid) {
        logger.warn({ targetId, errors: validation.errors }, 'Triggered pipeline is invalid; skipping');
        continue;
      }

      const project = await deps.projectModel.findById(targetPipeline.projectId).select('ownerId');
      if (!project?.ownerId) {
        logger.warn({ targetId, projectId: targetPipeline.projectId }, "Triggered pipeline's project (or its owner) not found; skipping");
        continue;
      }

      const execution = await deps.executionModel.create({
        pipelineId: targetPipeline._id,
        projectId: targetPipeline.projectId,
        ownerId: project.ownerId,
        pipelineSnapshot: { nodes: targetPipeline.nodes, edges: targetPipeline.edges },
        status: 'PENDING'
      });

      await deps.jobQueue.add('triggered-execution', {
        executionId: execution._id.toString(),
        pipeline: targetPipeline,
        triggerDepth: depth + 1,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
        removeOnFail: { age: 30 * 24 * 60 * 60 }
      });

      logger.info(
        { sourcePipelineId: (sourcePipeline._id || sourcePipeline.id)?.toString(), targetId, executionId: execution._id.toString() },
        'Queued triggered execution'
      );
    } catch (err) {
      logger.error({ err, targetId }, 'Failed to queue a triggered execution');
    }
  }
}
