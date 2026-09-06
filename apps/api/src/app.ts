import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.routes';
import { projectRouter } from './routes/project.routes';
import { fileRouter } from './routes/file.routes';

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/files', fileRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});
