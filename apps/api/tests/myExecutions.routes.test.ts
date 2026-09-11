import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Execution } from '../src/models/Execution';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_my_executions';

let token: string;
let userId: string;
let projectId: string;
let pipelineId: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await Execution.deleteMany({});

  const res = await request(app).post('/api/auth/register').send({ email: 'my-exec@example.com', password: 'password123', name: 'My Exec' });
  token = res.body.token;
  userId = res.body.user.id;

  const project = await request(app).post('/api/projects').set('Authorization', `Bearer ${token}`).send({ name: 'Exec List Project' });
  projectId = project.body.id;
  const pipeline = await request(app).post(`/api/projects/${projectId}/pipelines`).set('Authorization', `Bearer ${token}`).send({ name: 'Exec List Pipeline' });
  pipelineId = pipeline.body.id;

  // Seed two executions directly (bypassing the queue) — this test only
  // cares about the listing/population logic, not the run pipeline itself.
  await Execution.create({ pipelineId, projectId, ownerId: userId, status: 'COMPLETED', pipelineSnapshot: {} });
  await Execution.create({ pipelineId, projectId, ownerId: userId, status: 'FAILED', error: 'boom', pipelineSnapshot: {} });
  // Someone else's execution should never show up in this user's list.
  const otherUserId = new mongoose.Types.ObjectId();
  await Execution.create({ pipelineId, projectId, ownerId: otherUserId, status: 'COMPLETED', pipelineSnapshot: {} });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('GET /api/executions', () => {
  it('lists only the current user\'s own executions, with pipeline/project names populated', async () => {
    const res = await request(app).get('/api/executions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const execution of res.body) {
      expect(execution.pipeline).toEqual({ id: pipelineId, name: 'Exec List Pipeline' });
      expect(execution.project).toEqual({ id: projectId, name: 'Exec List Project' });
      expect(execution.results).toBeUndefined();
      expect(execution.pipelineSnapshot).toBeUndefined();
    }
    expect(res.body.map((e: any) => e.status).sort()).toEqual(['COMPLETED', 'FAILED']);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/executions');
    expect(res.status).toBe(401);
  });
});
