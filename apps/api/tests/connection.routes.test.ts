import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Connection } from '../src/models/Connection';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_connections';

let ownerToken: string;
let editorToken: string;
let viewerToken: string;
let intruderToken: string;
let projectId: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await Connection.deleteMany({});

  const owner = await request(app).post('/api/auth/register').send({ email: 'conn-owner@example.com', password: 'password123', name: 'Owner' });
  ownerToken = owner.body.token;

  const editor = await request(app).post('/api/auth/register').send({ email: 'conn-editor@example.com', password: 'password123', name: 'Editor' });
  editorToken = editor.body.token;

  const viewer = await request(app).post('/api/auth/register').send({ email: 'conn-viewer@example.com', password: 'password123', name: 'Viewer' });
  viewerToken = viewer.body.token;

  const intruder = await request(app).post('/api/auth/register').send({ email: 'conn-intruder@example.com', password: 'password123', name: 'Intruder' });
  intruderToken = intruder.body.token;

  const project = await request(app).post('/api/projects').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Connections Test Project' });
  projectId = project.body.id;

  await request(app).post(`/api/projects/${projectId}/members`).set('Authorization', `Bearer ${ownerToken}`).send({ email: 'conn-editor@example.com', role: 'editor' });
  await request(app).post(`/api/projects/${projectId}/members`).set('Authorization', `Bearer ${ownerToken}`).send({ email: 'conn-viewer@example.com', role: 'viewer' });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Connections CRUD (project-scoped)', () => {
  let connectionId: string;

  it('creates a postgres connection and never returns the secret', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/connections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'My Postgres',
        type: 'postgres',
        config: { host: 'db.example.com', port: 5432, database: 'app', user: 'appuser' },
        secret: { password: 'super-secret-password' },
      });

    expect(res.status).toBe(201);
    expect(res.body.config.host).toBe('db.example.com');
    expect(res.body.projectId).toBe(projectId);
    expect(JSON.stringify(res.body)).not.toMatch(/super-secret-password/);
    expect(res.body.encryptedSecret).toBeUndefined();
    connectionId = res.body.id;
  });

  it('rejects a postgres connection missing required fields', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/connections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Bad', type: 'postgres', config: {}, secret: {} });

    expect(res.status).toBe(400);
  });

  it('creates a mysql connection and never returns the secret', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/connections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'My MySQL',
        type: 'mysql',
        config: { host: 'db.example.com', port: 3306, database: 'app', user: 'appuser' },
        secret: { password: 'super-secret-password' },
      });

    expect(res.status).toBe(201);
    expect(res.body.config.host).toBe('db.example.com');
    expect(res.body.type).toBe('mysql');
    expect(JSON.stringify(res.body)).not.toMatch(/super-secret-password/);
    expect(res.body.encryptedSecret).toBeUndefined();

    // Deleted immediately — later tests in this file assume exactly one
    // (the postgres) connection exists in the project.
    await request(app)
      .delete(`/api/projects/${projectId}/connections/${res.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
  });

  it('rejects a mysql connection missing required fields', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/connections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Bad', type: 'mysql', config: {}, secret: {} });

    expect(res.status).toBe(400);
  });

  it('rejects an s3 connection missing the secret access key', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/connections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Bad S3', type: 's3', config: { bucket: 'b', region: 'us-east-1' }, secret: { accessKeyId: 'AKIA' } });

    expect(res.status).toBe(400);
  });

  it('shares the connection with every project member, not just its creator', async () => {
    const asEditor = await request(app).get(`/api/projects/${projectId}/connections`).set('Authorization', `Bearer ${editorToken}`);
    expect(asEditor.status).toBe(200);
    expect(asEditor.body.length).toBe(1);

    const asViewer = await request(app).get(`/api/projects/${projectId}/connections`).set('Authorization', `Bearer ${viewerToken}`);
    expect(asViewer.status).toBe(200);
    expect(asViewer.body.length).toBe(1);
    expect(JSON.stringify(asViewer.body)).not.toMatch(/super-secret-password/);
  });

  it('stores the secret encrypted, not as plaintext, in the database', async () => {
    const doc = await Connection.findById(connectionId);
    expect(doc?.encryptedSecret).toBeDefined();
    expect(doc?.encryptedSecret).not.toMatch(/super-secret-password/);
    expect(doc?.encryptedSecret).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/); // iv:authTag:ciphertext
  });

  it('denies a viewer from creating or deleting a connection', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/connections`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Viewer Attempt', type: 'api', config: { baseUrl: 'https://x.com' }, secret: {} });
    expect(createRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/projects/${projectId}/connections/${connectionId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(deleteRes.status).toBe(404);
  });

  it("denies a non-member from reading or deleting the project's connection", async () => {
    const getRes = await request(app)
      .get(`/api/projects/${projectId}/connections/${connectionId}`)
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(getRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/projects/${projectId}/connections/${connectionId}`)
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(deleteRes.status).toBe(404);
  });

  it('lets an editor (not just the owner) delete the connection', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/connections/${connectionId}`)
      .set('Authorization', `Bearer ${editorToken}`);
    expect(res.status).toBe(204);

    const listRes = await request(app).get(`/api/projects/${projectId}/connections`).set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.body.length).toBe(0);
  });
});
