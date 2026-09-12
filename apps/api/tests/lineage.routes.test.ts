import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Project } from '../src/models/Project';
import { Pipeline } from '../src/models/Pipeline';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_lineage';

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

  const owner = await request(app).post('/api/auth/register').send({ email: 'lineage-owner@example.com', password: 'password123', name: 'Owner' });
  ownerToken = owner.body.token;

  const viewer = await request(app).post('/api/auth/register').send({ email: 'lineage-viewer@example.com', password: 'password123', name: 'Viewer' });
  viewerToken = viewer.body.token;

  const intruder = await request(app).post('/api/auth/register').send({ email: 'lineage-intruder@example.com', password: 'password123', name: 'Intruder' });
  intruderToken = intruder.body.token;

  const project = await request(app).post('/api/projects').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Lineage Test Project' });
  projectId = project.body.id;
  await request(app).post(`/api/projects/${projectId}/members`).set('Authorization', `Bearer ${ownerToken}`).send({ email: 'lineage-viewer@example.com', role: 'viewer' });

  const pipeline = await request(app).post(`/api/projects/${projectId}/pipelines`).set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Lineage Test Pipeline' });
  pipelineId = pipeline.body.id;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Pipeline lineage', () => {
  it('traces a renamed column back through the graph', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        nodes: [
          { id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } },
          { id: '2', data: { nodeType: 'rename-columns', label: 'Rename', config: { mapping: 'id:user_id' } } },
        ],
        edges: [{ source: '1', target: '2' }],
        targetNodeId: '2',
        column: 'user_id',
      });

    expect(res.status).toBe(200);
    expect(res.body.column).toBe('user_id');
    expect(res.body.sources[0]).toMatchObject({ nodeId: '1', column: 'id' });
  });

  it('a source node column has no upstream sources', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'Input', config: { filePath: 'mock' } } }],
        edges: [],
        targetNodeId: '1',
        column: 'id',
      });

    expect(res.status).toBe(200);
    expect(res.body.sources).toEqual([]);
  });

  it('rejects a request missing column', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ nodes: [{ id: '1', data: {} }], edges: [], targetNodeId: '1' });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown targetNodeId', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        nodes: [{ id: '1', data: { nodeType: 'csv-input', config: {} } }],
        edges: [],
        targetNodeId: 'does-not-exist',
        column: 'id',
      });

    expect(res.status).toBe(400);
  });

  it('allows a viewer to compute lineage — it is read-only static analysis', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/lineage`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        nodes: [{ id: '1', data: { nodeType: 'csv-input', config: {} } }],
        edges: [],
        targetNodeId: '1',
        column: 'id',
      });

    expect(res.status).toBe(200);
  });

  it('denies a non-member from computing lineage', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/lineage`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({
        nodes: [{ id: '1', data: { nodeType: 'csv-input', config: {} } }],
        edges: [],
        targetNodeId: '1',
        column: 'id',
      });

    expect(res.status).toBe(404);
  });
});
