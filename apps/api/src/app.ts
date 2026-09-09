import './config/env'; // must load first: populates process.env before other modules read it

import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { createLogger } from '@pipeforge/shared';
import { WEB_URL } from './config/env';
import { authRouter } from './routes/auth.routes';
import { projectRouter } from './routes/project.routes';
import { fileRouter } from './routes/file.routes';

export const logger = createLogger('api');

export const app = express();

app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/healthz' } }));
app.use(cors({ origin: WEB_URL }));
app.use(express.json());

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/files', fileRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
});
