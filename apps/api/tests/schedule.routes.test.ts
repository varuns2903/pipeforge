import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Project } from '../src/models/Project';
import { Pipeline } from '../src/models/Pipeline';
import { pipelineQueue } from '../src/services/queue.service';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_schedule';

let token: string;
let projectId: string;
let pipelineId: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await Project.deleteMany({});
  await Pipeline.deleteMany({});

  const regRes = await request(app).post('/api/auth/register').send({ email: 'schedule@example.com', password: 'password123', name: 'Schedule User' });
  token = regRes.body.token;

  const projectRes = await request(app).post('/api/projects').set('Authorization', `Bearer ${token}`).send({ name: 'Schedule Project' });
  projectId = projectRes.body.id;

  const pipelineRes = await request(app).post(`/api/projects/${projectId}/pipelines`).set('Authorization', `Bearer ${token}`).send({ name: 'Schedule Pipeline' });
  pipelineId = pipelineRes.body.id;
});

afterAll(async () => {
  await pipelineQueue.removeJobScheduler(pipelineId).catch(() => {});
  await pipelineQueue.close();
  await mongoose.connection.close();
});

describe('Pipeline scheduling', () => {
  it('rejects an invalid cron expression', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cronExpression: 'not a cron expression' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid cron expression/);
  });

  it('sets a valid schedule and registers a BullMQ job scheduler', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cronExpression: '0 * * * *', timezone: 'UTC' });

    expect(res.status).toBe(200);
    expect(res.body.schedule).toEqual({ cronExpression: '0 * * * *', timezone: 'UTC', enabled: true });

    const schedulers = await pipelineQueue.getJobSchedulers();
    expect(schedulers.some(s => s.key === pipelineId)).toBe(true);
  });

  it('reflects the schedule on GET', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/pipelines/${pipelineId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.schedule.enabled).toBe(true);
    expect(res.body.schedule.cronExpression).toBe('0 * * * *');
  });

  it('replaces an existing schedule instead of stacking a second one', async () => {
    await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cronExpression: '0 0 * * *' });

    const schedulers = await pipelineQueue.getJobSchedulers();
    const forThisPipeline = schedulers.filter(s => s.key === pipelineId);
    expect(forThisPipeline.length).toBe(1);
    expect(forThisPipeline[0].pattern).toBe('0 0 * * *');
  });

  it('clears the schedule and removes the BullMQ job scheduler', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/pipelines/${pipelineId}/schedule`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.schedule.enabled).toBe(false);

    const schedulers = await pipelineQueue.getJobSchedulers();
    expect(schedulers.some(s => s.key === pipelineId)).toBe(false);
  });

  it('deleting a scheduled pipeline also removes its schedule', async () => {
    await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cronExpression: '0 * * * *' });

    await request(app)
      .delete(`/api/projects/${projectId}/pipelines/${pipelineId}`)
      .set('Authorization', `Bearer ${token}`);

    const schedulers = await pipelineQueue.getJobSchedulers();
    expect(schedulers.some(s => s.key === pipelineId)).toBe(false);
  });
});
