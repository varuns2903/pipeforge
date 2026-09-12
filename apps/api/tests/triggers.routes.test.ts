import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Project } from '../src/models/Project';
import { Pipeline } from '../src/models/Pipeline';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_triggers';

let ownerToken: string;
let viewerToken: string;
let intruderToken: string;
let projectId: string;
let otherProjectId: string;
let pipelineAId: string;
let pipelineBId: string;
let otherProjectPipelineId: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await Project.deleteMany({});
  await Pipeline.deleteMany({});

  const owner = await request(app).post('/api/auth/register').send({ email: 'triggers-owner@example.com', password: 'password123', name: 'Owner' });
  ownerToken = owner.body.token;

  const viewer = await request(app).post('/api/auth/register').send({ email: 'triggers-viewer@example.com', password: 'password123', name: 'Viewer' });
  viewerToken = viewer.body.token;

  const intruder = await request(app).post('/api/auth/register').send({ email: 'triggers-intruder@example.com', password: 'password123', name: 'Intruder' });
  intruderToken = intruder.body.token;

  const project = await request(app).post('/api/projects').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Triggers Project' });
  projectId = project.body.id;
  await request(app).post(`/api/projects/${projectId}/members`).set('Authorization', `Bearer ${ownerToken}`).send({ email: 'triggers-viewer@example.com', role: 'viewer' });

  const pipelineA = await request(app).post(`/api/projects/${projectId}/pipelines`).set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Pipeline A' });
  pipelineAId = pipelineA.body.id;

  const pipelineB = await request(app).post(`/api/projects/${projectId}/pipelines`).set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Pipeline B' });
  pipelineBId = pipelineB.body.id;

  const otherProject = await request(app).post('/api/projects').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Other Project' });
  otherProjectId = otherProject.body.id;
  const otherPipeline = await request(app).post(`/api/projects/${otherProjectId}/pipelines`).set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Other Project Pipeline' });
  otherProjectPipelineId = otherPipeline.body.id;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Pipeline triggers', () => {
  it('sets pipeline A to trigger pipeline B on completion', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineAId}/triggers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetPipelineIds: [pipelineBId] });

    expect(res.status).toBe(200);
    expect(res.body.triggerPipelineIds).toEqual([pipelineBId]);
  });

  it('rejects a pipeline triggering itself', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineAId}/triggers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetPipelineIds: [pipelineAId] });

    expect(res.status).toBe(400);
  });

  it('rejects a target pipeline from a different project', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineAId}/triggers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetPipelineIds: [otherProjectPipelineId] });

    expect(res.status).toBe(400);
  });

  it('rejects a target pipeline id that does not exist', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineAId}/triggers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetPipelineIds: ['64f000000000000000000000'] });

    expect(res.status).toBe(400);
  });

  it('rejects a malformed request body', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineAId}/triggers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetPipelineIds: 'not-an-array' });

    expect(res.status).toBe(400);
  });

  it('deduplicates repeated target ids', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineAId}/triggers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetPipelineIds: [pipelineBId, pipelineBId] });

    expect(res.status).toBe(200);
    expect(res.body.triggerPipelineIds).toEqual([pipelineBId]);
  });

  it('clears triggers with an empty array', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineAId}/triggers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetPipelineIds: [] });

    expect(res.status).toBe(200);
    expect(res.body.triggerPipelineIds).toEqual([]);
  });

  it('denies a viewer from setting triggers', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineAId}/triggers`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ targetPipelineIds: [pipelineBId] });

    expect(res.status).toBe(404);
  });

  it('denies a non-member from setting triggers', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineAId}/triggers`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ targetPipelineIds: [pipelineBId] });

    expect(res.status).toBe(404);
  });
});
