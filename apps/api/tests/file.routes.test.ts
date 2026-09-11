import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_files';

let ownerToken: string;
let editorToken: string;
let viewerToken: string;
let intruderToken: string;
let projectId: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});

  const owner = await request(app).post('/api/auth/register').send({ email: 'file-owner@example.com', password: 'password123', name: 'Owner' });
  ownerToken = owner.body.token;

  const editor = await request(app).post('/api/auth/register').send({ email: 'file-editor@example.com', password: 'password123', name: 'Editor' });
  editorToken = editor.body.token;

  const viewer = await request(app).post('/api/auth/register').send({ email: 'file-viewer@example.com', password: 'password123', name: 'Viewer' });
  viewerToken = viewer.body.token;

  const intruder = await request(app).post('/api/auth/register').send({ email: 'file-intruder@example.com', password: 'password123', name: 'Intruder' });
  intruderToken = intruder.body.token;

  const project = await request(app).post('/api/projects').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Files Test Project' });
  projectId = project.body.id;
  await request(app).post(`/api/projects/${projectId}/members`).set('Authorization', `Bearer ${ownerToken}`).send({ email: 'file-editor@example.com', role: 'editor' });
  await request(app).post(`/api/projects/${projectId}/members`).set('Authorization', `Bearer ${ownerToken}`).send({ email: 'file-viewer@example.com', role: 'viewer' });

});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('File upload validation (project-scoped)', () => {
  it('accepts a .csv file', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files/upload`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('name,age\nAlice,28'), 'people.csv');

    expect(res.status).toBe(200);
    expect(res.body.filePath).toMatch(/^\/uploads\/.+\.csv$/);
  });

  it('rejects a disallowed file type', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files/upload`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('#!/bin/sh\necho hi'), 'payload.sh');

    expect(res.status).toBe(400);
  });

  it('sanitizes path-traversal attempts in the original filename', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files/upload`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('a,b\n1,2'), '../../etc/evil.csv');

    expect(res.status).toBe(200);
    expect(res.body.filePath).not.toMatch(/\.\./);
    expect(res.body.filePath).toMatch(/^\/uploads\/[^/]+$/);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files/upload`)
      .attach('file', Buffer.from('a,b\n1,2'), 'people.csv');

    expect(res.status).toBe(401);
  });

  it('denies a viewer from uploading', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files/upload`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .attach('file', Buffer.from('a,b\n1,2'), 'viewer-attempt.csv');
    expect(res.status).toBe(404);
  });

  it('404s uploading to a project the user is not a member of', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files/upload`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .attach('file', Buffer.from('a,b\n1,2'), 'intruder.csv');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/projects/:projectId/files', () => {
  it('shares uploaded files with every project member, not just the uploader', async () => {
    const asEditor = await request(app).get(`/api/projects/${projectId}/files`).set('Authorization', `Bearer ${editorToken}`);
    expect(asEditor.status).toBe(200);
    expect(asEditor.body.some((f: any) => f.originalName === 'people.csv')).toBe(true);

    const asViewer = await request(app).get(`/api/projects/${projectId}/files`).set('Authorization', `Bearer ${viewerToken}`);
    expect(asViewer.status).toBe(200);
    expect(asViewer.body.some((f: any) => f.originalName === 'people.csv')).toBe(true);
  });

  it('404s listing for a non-member', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/files`).set('Authorization', `Bearer ${intruderToken}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/projects/:projectId/files/:fileId', () => {
  it('lets an editor (not just the uploader) delete a shared file', async () => {
    const upload = await request(app)
      .post(`/api/projects/${projectId}/files/upload`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('a,b\n1,2'), 'to-delete.csv');
    expect(upload.status).toBe(200);

    const list = await request(app).get(`/api/projects/${projectId}/files`).set('Authorization', `Bearer ${ownerToken}`);
    const fileId = list.body.find((f: any) => f.originalName === 'to-delete.csv').id;

    const del = await request(app).delete(`/api/projects/${projectId}/files/${fileId}`).set('Authorization', `Bearer ${editorToken}`);
    expect(del.status).toBe(204);

    const listAfter = await request(app).get(`/api/projects/${projectId}/files`).set('Authorization', `Bearer ${ownerToken}`);
    expect(listAfter.body.some((f: any) => f.id === fileId)).toBe(false);
  });

  it('404s for a non-member', async () => {
    const list = await request(app).get(`/api/projects/${projectId}/files`).set('Authorization', `Bearer ${ownerToken}`);
    const fileId = list.body[0].id;

    const res = await request(app).delete(`/api/projects/${projectId}/files/${fileId}`).set('Authorization', `Bearer ${intruderToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/files (cross-project aggregate)', () => {
  it("includes files from every project the user can see, annotated with the project's name", async () => {
    const res = await request(app).get('/api/files').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((f: any) => f.originalName === 'people.csv' && f.project.name === 'Files Test Project')).toBe(true);
  });

  it("does not include files from a project the user isn't a member of", async () => {
    const res = await request(app).get('/api/files').set('Authorization', `Bearer ${intruderToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((f: any) => f.originalName === 'people.csv')).toBe(false);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/files');
    expect(res.status).toBe(401);
  });
});
