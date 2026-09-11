import './tracing'; // must load before mongoose/ioredis are first imported to instrument them

import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { PipelineEngine, PipelineValidator } from '@pipeforge/pipeline-engine';
import { executionSchema, pipelineSchema, createLogger, createMailer, decryptSecret } from '@pipeforge/shared';
import { env } from './config/env';
import { resolveConnections } from './resolveConnections';
import { isFinalAttempt } from './jobAttempts';
import { shouldNotify } from './notificationGate';
import { shouldDeliverWebhook } from './webhookGate';
import { signWebhookPayload } from './webhookSignature';
import { executionsTotal, executionDuration, startMetricsServer } from './metrics';

const {
  MONGODB_URI,
  REDIS_HOST,
  REDIS_PORT,
  WORKER_CONCURRENCY,
  WEB_URL,
  CONNECTION_ENCRYPTION_KEY,
} = env;

const redisPublisher = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

const Execution = mongoose.model('Execution', executionSchema);
const Pipeline = mongoose.model('Pipeline', pipelineSchema);
// Only the fields this process actually needs from the users collection —
// deliberately not the full User schema (password hash, tokens, etc.), which
// lives in apps/api and this process has no business reading.
const UserContact = mongoose.model('User', new mongoose.Schema({ email: String, name: String }));
const logger = createLogger('worker');
const sendMail = createMailer({
  smtpHost: env.SMTP_HOST,
  smtpPort: env.SMTP_PORT,
  smtpUser: env.SMTP_USER,
  smtpPass: env.SMTP_PASS,
  mailFrom: env.MAIL_FROM,
}, logger);

async function notifyOwner(pipeline: any, ownerId: string, executionId: string, status: 'COMPLETED' | 'FAILED', errorMessage?: string) {
  if (!shouldNotify(pipeline, status)) return;

  try {
    const user = await UserContact.findById(ownerId).select('email name');
    if (!user?.email) return;

    const link = `${WEB_URL}/projects/${pipeline.projectId}/pipelines/${pipeline._id || pipeline.id}`;
    const subject = status === 'FAILED'
      ? `Pipeline "${pipeline.name}" failed`
      : `Pipeline "${pipeline.name}" completed`;
    const text = status === 'FAILED'
      ? `Your pipeline "${pipeline.name}" failed to run.\n\nError: ${errorMessage}\n\nView it: ${link}`
      : `Your pipeline "${pipeline.name}" completed successfully.\n\nView it: ${link}`;

    await sendMail({ to: user.email, subject, text });
  } catch (err) {
    // A notification failure should never fail the execution itself.
    logger.error({ err, executionId }, 'Failed to send execution notification');
  }
}

const WEBHOOK_TIMEOUT_MS = 5000;

async function deliverWebhook(pipeline: any, executionId: string, status: 'COMPLETED' | 'FAILED', errorMessage?: string) {
  if (!shouldDeliverWebhook(pipeline, status)) return;

  try {
    const secret = decryptSecret(pipeline.webhook.secretEncrypted, CONNECTION_ENCRYPTION_KEY);
    const payload = JSON.stringify({
      event: status === 'FAILED' ? 'execution.failed' : 'execution.completed',
      executionId,
      pipelineId: pipeline._id || pipeline.id,
      pipelineName: pipeline.name,
      status,
      error: errorMessage ?? null,
      timestamp: new Date().toISOString(),
    });
    const signature = signWebhookPayload(payload, secret);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(pipeline.webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PipeForge-Signature': `sha256=${signature}` },
        body: payload,
        signal: controller.signal,
      });
      if (!res.ok) {
        logger.warn({ executionId, status: res.status }, 'Webhook delivery returned a non-2xx response');
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    // Best-effort, single attempt — same reasoning as notifyOwner: a
    // misbehaving receiver should never fail the execution itself.
    logger.error({ err, executionId }, 'Failed to deliver execution webhook');
  }
}

async function startWorker() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Worker connected to MongoDB');

  const metricsServer = startMetricsServer();

  const engine = new PipelineEngine();

  const runPipeline = async (job: { id?: string; name?: string; attemptsMade: number; opts: { attempts?: number } }, executionId: string, pipeline: any) => {
    const jobId = job.id;
    // BullMQ retries a failed job up to opts.attempts times before giving
    // up; only notify once it's truly done (the last attempt), not on every
    // transient retry in between.
    const isFinal = isFinalAttempt(job);
    const trigger = job.name || 'unknown';
    const startedAt = process.hrtime.bigint();
    logger.info({ jobId, executionId }, 'Processing execution');

    await Execution.findByIdAndUpdate(executionId, {
      status: 'RUNNING',
      startedAt: new Date()
    });

    const publishUpdate = (data: any) => {
      redisPublisher.publish('execution-updates', JSON.stringify({
        executionId,
        pipelineId: pipeline._id || pipeline.id,
        ...data
      }));
    };

    publishUpdate({ type: 'STATUS', status: 'RUNNING' });

    try {
      // Resolve any connector node's connectionId into real credentials just
      // before running — the pipeline object saved as the Execution's
      // snapshot (by whichever caller created it) stays unresolved.
      const resolvedPipeline = await resolveConnections(pipeline, CONNECTION_ENCRYPTION_KEY);
      const results = await engine.execute(resolvedPipeline, {
        onNodeStart: (nodeId, type, label) => {
          publishUpdate({ type: 'NODE_START', nodeId, nodeType: type, label });
        },
        onNodeComplete: (nodeId, duration, rowCount) => {
          publishUpdate({ type: 'NODE_COMPLETE', nodeId, duration, rowCount });
        },
        onNodeError: (nodeId, error) => {
          publishUpdate({ type: 'NODE_ERROR', nodeId, error });
        }
      });

      const updated = await Execution.findByIdAndUpdate(executionId, {
        status: 'COMPLETED',
        completedAt: new Date(),
        results
      }, { new: true }).select('ownerId');

      publishUpdate({ type: 'STATUS', status: 'COMPLETED', results });
      logger.info({ jobId, executionId }, 'Execution completed successfully');
      executionsTotal.inc({ trigger, status: 'completed' });
      executionDuration.observe({ status: 'completed' }, Number(process.hrtime.bigint() - startedAt) / 1e9);
      if (updated) {
        await notifyOwner(pipeline, updated.ownerId.toString(), executionId, 'COMPLETED');
        await deliverWebhook(pipeline, executionId, 'COMPLETED');
      }
    } catch (error: any) {
      logger.error({ jobId, executionId, err: error }, 'Execution failed');
      // Recorded on every attempt, not just the final one — a transient
      // failure that BullMQ retries is still a real failed attempt worth
      // counting, distinct from isFinal's "should we notify the owner yet".
      executionsTotal.inc({ trigger, status: 'failed' });
      executionDuration.observe({ status: 'failed' }, Number(process.hrtime.bigint() - startedAt) / 1e9);
      const updated = await Execution.findByIdAndUpdate(executionId, {
        status: 'FAILED',
        completedAt: new Date(),
        error: error.message
      }, { new: true }).select('ownerId');

      publishUpdate({ type: 'STATUS', status: 'FAILED', error: error.message });
      if (updated && isFinal) {
        await notifyOwner(pipeline, updated.ownerId.toString(), executionId, 'FAILED', error.message);
        await deliverWebhook(pipeline, executionId, 'FAILED', error.message);
      }
      throw error;
    }
  };

  const worker = new Worker('pipeline-executions', async job => {
    if (job.name === 'scheduled-execution') {
      // A cron schedule fired — unlike a manual run, there's no HTTP request
      // that already created the Execution record, so do that here. Fetch
      // the pipeline fresh (not a snapshot) so edits since the schedule was
      // set are picked up automatically.
      const { pipelineId, projectId, ownerId } = job.data;
      const pipeline = await Pipeline.findOne({ _id: pipelineId, projectId, deletedAt: null });
      if (!pipeline) {
        logger.warn({ jobId: job.id, pipelineId }, 'Scheduled execution skipped: pipeline not found or deleted');
        return;
      }

      const validation = new PipelineValidator().validate(pipeline);
      if (!validation.isValid) {
        logger.warn({ jobId: job.id, pipelineId, errors: validation.errors }, 'Scheduled execution skipped: pipeline invalid');
        return;
      }

      const execution = await Execution.create({
        pipelineId: pipeline._id,
        projectId: pipeline.projectId,
        ownerId,
        pipelineSnapshot: { nodes: pipeline.nodes, edges: pipeline.edges },
        status: 'PENDING'
      });

      await runPipeline(job, execution._id.toString(), pipeline);
    } else {
      const { executionId, pipeline } = job.data;
      await runPipeline(job, executionId, pipeline);
    }
  }, {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT
    },
    concurrency: WORKER_CONCURRENCY
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job failed');
  });

  logger.info({ concurrency: WORKER_CONCURRENCY }, 'Worker started, listening for pipeline executions');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down worker gracefully');
    try {
      await worker.close(); // stops accepting new jobs, waits for active ones to finish
      await redisPublisher.quit();
      await new Promise<void>((resolve) => metricsServer.close(() => resolve()));
      await mongoose.disconnect();
      logger.info('Worker shut down cleanly');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorker().catch(err => {
  logger.error({ err }, 'Fatal error starting worker');
  process.exit(1);
});
