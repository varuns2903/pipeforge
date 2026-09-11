import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Project } from '../src/models/Project';
import { ActivityLog } from '../src/models/ActivityLog';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_activity';

let ownerToken: string;
let viewerToken: string;
let intruderToken: string;
let projectId: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await Project.deleteMany({});
  await ActivityLog.deleteMany({});

  const owner = await request(app).post('/api/auth/register').send({ email: 'activity-owner@example.com', password: 'password123', name: 'Owner' });
  ownerToken = owner.body.token;

  const viewer = await request(app).post('/api/auth/register').send({ email: 'activity-viewer@example.com', password: 'password123', name: 'Viewer' });
  viewerToken = viewer.body.token;

  const intruder = await request(app).post('/api/auth/register').send({ email: 'activity-intruder@example.com', password: 'password123', name: 'Intruder' });
  intruderToken = intruder.body.token;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Activity Log', () => {
  it('records project.created when a project is made', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Activity Test Project' });
    expect(res.status).toBe(201);
    projectId = res.body.id;

    await request(app).post(`/api/projects/${projectId}/members`).set('Authorization', `Bearer ${ownerToken}`).send({ email: 'activity-viewer@example.com', role: 'viewer' });

    const log = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(log.status).toBe(200);
    expect(log.body.items.some((e: any) => e.action === 'project.created')).toBe(true);
  });

  it('records pipeline.created, pipeline.updated, and pipeline.deleted', async () => {
    const create = await request(app)
      .post(`/api/projects/${projectId}/pipelines`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Activity Pipeline' });
    const pipelineId = create.body.id;

    await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Renamed Activity Pipeline' });

    await request(app)
      .delete(`/api/projects/${projectId}/pipelines/${pipelineId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const log = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const actions = log.body.items.map((e: any) => e.action);
    expect(actions).toContain('pipeline.created');
    expect(actions).toContain('pipeline.updated');
    expect(actions).toContain('pipeline.deleted');
  });

  it('newest entries come first and include the acting user', async () => {
    const log = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const items = log.body.items;
    expect(items.length).toBeGreaterThan(1);
    const timestamps = items.map((e: any) => new Date(e.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
    expect(items[0].user.email).toBe('activity-owner@example.com');
  });

  it('paginates with cursor + limit', async () => {
    const firstPage = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .query({ limit: 1 })
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(firstPage.body.items.length).toBe(1);
    expect(firstPage.body.nextCursor).toBeTruthy();

    const secondPage = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .query({ limit: 1, cursor: firstPage.body.nextCursor })
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(secondPage.body.items.length).toBe(1);
    expect(secondPage.body.items[0].id).not.toBe(firstPage.body.items[0].id);
  });

  it('lets a viewer read the log but blocks a non-member', async () => {
    const asViewer = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(asViewer.status).toBe(200);

    const asIntruder = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(asIntruder.status).toBe(404);
  });
});
