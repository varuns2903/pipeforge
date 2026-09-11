import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Project } from '../src/models/Project';
import { Pipeline } from '../src/models/Pipeline';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_preview';

let ownerToken: string;
let viewerToken: string;
let intruderToken: string;
let projectId: string;
let pipelineId: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await Project.deleteMany({});
  await Pipeline.deleteMany({});

  const owner = await request(app).post('/api/auth/register').send({ email: 'preview-owner@example.com', password: 'password123', name: 'Owner' });
  ownerToken = owner.body.token;

  const viewer = await request(app).post('/api/auth/register').send({ email: 'preview-viewer@example.com', password: 'password123', name: 'Viewer' });
  viewerToken = viewer.body.token;

  const intruder = await request(app).post('/api/auth/register').send({ email: 'preview-intruder@example.com', password: 'password123', name: 'Intruder' });
  intruderToken = intruder.body.token;

  const project = await request(app).post('/api/projects').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Preview Test Project' });
  projectId = project.body.id;
  await request(app).post(`/api/projects/${projectId}/members`).set('Authorization', `Bearer ${ownerToken}`).send({ email: 'preview-viewer@example.com', role: 'viewer' });

  const pipeline = await request(app).post(`/api/projects/${projectId}/pipelines`).set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Preview Test Pipeline' });
  pipelineId = pipeline.body.id;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Pipeline preview', () => {
  it('previews a single mock csv-input node', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/preview`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } }],
        edges: [],
        targetNodeId: '1',
      });

    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(4);
    expect(res.body.totalRows).toBe(4);
    expect(res.body.truncated).toBe(false);
    expect(res.body.rows[0]).toEqual({ id: 1, name: 'Alice', age: 28, country: 'US' });
  });

  it('only runs the ancestor subgraph — an unconfigured, unrelated node does not block the preview', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/preview`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        nodes: [
          { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
          { id: '2', data: { nodeType: 'filter', label: 'Adults', config: { condition: 'row.age >= 18' } } },
          // Deliberately broken/unconfigured and NOT connected to node 1 —
          // previewing node 2 should succeed regardless.
          { id: '3', data: { nodeType: 'cast-type', label: 'Broken', config: {} } },
        ],
        edges: [{ source: '1', target: '2' }],
        targetNodeId: '2',
      });

    expect(res.status).toBe(200);
    expect(res.body.rows.map((r: any) => r.name).sort()).toEqual(['Alice', 'Charlie']);
  });

  it('caps rows at 20 and reports truncated for a larger real dataset', async () => {
    const csv = 'n\n' + Array.from({ length: 30 }, (_, i) => i).join('\n') + '\n';
    const upload = await request(app)
      .post(`/api/projects/${projectId}/files/upload`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from(csv), 'thirty-rows.csv');
    expect(upload.status).toBe(200);

    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/preview`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: upload.body.filePath } } }],
        edges: [],
        targetNodeId: '1',
      });

    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(20);
    expect(res.body.totalRows).toBe(30);
    expect(res.body.truncated).toBe(true);
  });

  it('rejects a request missing targetNodeId', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/preview`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ nodes: [], edges: [] });

    expect(res.status).toBe(400);
  });

  it('returns a clear 400 when the target node itself is misconfigured', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/preview`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        nodes: [{ id: '1', data: { nodeType: 'cast-type', label: 'Broken', config: {} } }],
        edges: [],
        targetNodeId: '1',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('requires editor (not just viewer) — preview can trigger real external calls, same as run', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/preview`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } }],
        edges: [],
        targetNodeId: '1',
      });
    expect(res.status).toBe(404);
  });

  it('denies a non-member from previewing', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/preview`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({
        nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } }],
        edges: [],
        targetNodeId: '1',
      });
    expect(res.status).toBe(404);
  });
});
