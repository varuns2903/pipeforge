import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Project } from '../src/models/Project';
import { Pipeline } from '../src/models/Pipeline';
import { Execution } from '../src/models/Execution';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_executions';

let tokenA: string;
let tokenB: string;
let projectId: string;
let pipelineId: string;
let executionId: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await Project.deleteMany({});
  await Pipeline.deleteMany({});
  await Execution.deleteMany({});

  const userA = await request(app).post('/api/auth/register').send({ email: 'owner@example.com', password: 'password123', name: 'Owner' });
  tokenA = userA.body.token;
  const ownerId = userA.body.user.id;

  const userB = await request(app).post('/api/auth/register').send({ email: 'intruder@example.com', password: 'password123', name: 'Intruder' });
  tokenB = userB.body.token;

  const projectRes = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ name: 'Owner Project' });
  projectId = projectRes.body.id;

  const pipelineRes = await request(app)
    .post(`/api/projects/${projectId}/pipelines`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ name: 'Owner Pipeline' });
  pipelineId = pipelineRes.body.id;

  const execution = await Execution.create({
    pipelineId,
    projectId,
    ownerId,
    status: 'COMPLETED',
    results: { secret: 'owner-only-data' }
  });
  executionId = execution._id.toString();
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Execution ownership (IDOR protection)', () => {
  it("denies another user from listing this pipeline's executions", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/pipelines/${pipelineId}/executions`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('denies another user from reading a specific execution by id', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/pipelines/${pipelineId}/executions/${executionId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('allows the owner to list executions', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/pipelines/${pipelineId}/executions`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('allows the owner to read the execution by id', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/pipelines/${pipelineId}/executions/${executionId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.results.secret).toBe('owner-only-data');
  });
});
