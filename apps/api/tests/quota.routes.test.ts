import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Quota limits are read from env once at module load time (config/env.ts),
// so they must be set before importing the app.
const FIRST_FILE_BYTES = 50;
process.env.MAX_USER_STORAGE_MB = String(FIRST_FILE_BYTES / (1024 * 1024)); // quota == exactly one 50-byte file
process.env.MAX_CONCURRENT_EXECUTIONS_PER_USER = '1';

const { app } = await import('../src/app');
const { User } = await import('../src/models/User');
const { Project } = await import('../src/models/Project');
const { Pipeline } = await import('../src/models/Pipeline');
const { Execution } = await import('../src/models/Execution');
const { File } = await import('../src/models/File');

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_quota';

let token: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await Project.deleteMany({});
  await Pipeline.deleteMany({});
  await Execution.deleteMany({});
  await File.deleteMany({});

  const res = await request(app).post('/api/auth/register').send({ email: 'quota@example.com', password: 'password123', name: 'Quota User' });
  token = res.body.token;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Storage quota', () => {
  it('accepts an upload that exactly fills the quota', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.alloc(FIRST_FILE_BYTES, 'a'), 'exact.csv');

    expect(res.status).toBe(200);
  });

  it('rejects a further upload that would exceed the quota', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('x'), 'onemore.csv');

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/storage quota/);
  });
});

describe('Concurrent execution quota', () => {
  let projectId: string;
  let pipelineId: string;

  beforeAll(async () => {
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Quota Project' });
    projectId = projectRes.body.id;

    const pipelineRes = await request(app)
      .post(`/api/projects/${projectId}/pipelines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Quota Pipeline' });
    pipelineId = pipelineRes.body.id;

    await request(app)
      .put(`/api/projects/${projectId}/pipelines/${pipelineId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nodes: [{ id: '1', data: { nodeType: 'csv-input', label: 'In', config: { filePath: 'mock' } } }],
        edges: []
      });
  });

  it('allows one run, then rejects a second while the first is still active (limit: 1)', async () => {
    const first = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/run`)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(202);

    const second = await request(app)
      .post(`/api/projects/${projectId}/pipelines/${pipelineId}/run`)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(429);
    expect(second.body.error).toMatch(/already running/);
  });
});
