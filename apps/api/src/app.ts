import './config/env'; // must load first: populates process.env before other modules read it

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import * as yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { WEB_URL } from './config/env';
import { logger } from './logger';
import { authRouter } from './routes/auth.routes';
import { projectRouter } from './routes/project.routes';
import { myFilesRouter } from './routes/myFiles.routes';
import { usageRouter } from './routes/usage.routes';
import { myExecutionsRouter } from './routes/myExecutions.routes';
import { billingRouter } from './routes/billing.routes';
import { billingController } from './controllers/billing.controller';
import { registry, httpRequestDuration, httpRequestsTotal } from './metrics';
import { apiLimiter } from './middleware/rateLimit';

export { logger };

export const app = express();

app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/healthz' } }));
// credentials: true is required for the browser to send/receive the httpOnly
// auth cookie cross-origin; the frontend must set axios's withCredentials to match.
app.use(cors({ origin: WEB_URL, credentials: true }));

// Labels by the matched route PATTERN (e.g. "/:projectId/pipelines/:pipelineId"),
// not the raw URL — using raw URLs would blow up Prometheus's cardinality with
// one time series per distinct id ever requested. `req.route` is only populated
// once Express has matched a route, so this reads it in the 'finish' handler
// rather than up front.
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : (res.statusCode === 404 ? '404' : req.path);
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });
  next();
});

// Mounted BEFORE express.json(): Stripe's webhook signature is computed over
// the exact raw request bytes, so this route needs the unparsed Buffer body
// rather than the parsed object every other route gets.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingController.webhook);

app.use(express.json());
app.use(cookieParser());

// Applies to every /api/* route registered below — deliberately excludes
// the webhook route above, which is registered (and fully handled) before
// this middleware even runs, so Stripe's own delivery/retry behavior is
// never subject to it.
app.use('/api', apiLimiter);

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// Standard Prometheus scrape target — intentionally unauthenticated (a
// scraper can't carry a user session), same as most Prometheus exporters;
// keep it off any public ingress if that matters for your deployment.
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

// Same relative path from both src/app.ts (dev, via tsx) and dist/app.js
// (built) — openapi.yaml lives one level up from both.
const openapiSpec = yaml.load(fs.readFileSync(path.join(__dirname, '../openapi.yaml'), 'utf8'));
app.get('/api/openapi.json', (req, res) => res.json(openapiSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
// Aggregate, cross-project views — GET-only. Uploading/deleting a file or
// creating/deleting a connection always happens within a specific project's
// nested routes above (projectRouter), which is where the editor+ role
// check for that mutation lives.
app.use('/api/files', myFilesRouter);
app.use('/api/usage', usageRouter);
app.use('/api/executions', myExecutionsRouter);
app.use('/api/billing', billingRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
});
