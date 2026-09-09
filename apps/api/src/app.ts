import './config/env'; // must load first: populates process.env before other modules read it

import express from 'express';
import cors from 'cors';
import { WEB_URL } from './config/env';
import { authRouter } from './routes/auth.routes';
import { projectRouter } from './routes/project.routes';
import { fileRouter } from './routes/file.routes';

export const app = express();

app.use(cors({ origin: WEB_URL }));
app.use(express.json());

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/files', fileRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});
