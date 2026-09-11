import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_files';

let token: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});

  const res = await request(app).post('/api/auth/register').send({ email: 'uploader@example.com', password: 'password123', name: 'Uploader' });
  token = res.body.token;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('File upload validation', () => {
  it('accepts a .csv file', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('name,age\nAlice,28'), 'people.csv');

    expect(res.status).toBe(200);
    expect(res.body.filePath).toMatch(/^\/uploads\/.+\.csv$/);
  });

  it('rejects a disallowed file type', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('#!/bin/sh\necho hi'), 'payload.sh');

    expect(res.status).toBe(400);
  });

  it('sanitizes path-traversal attempts in the original filename', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('a,b\n1,2'), '../../etc/evil.csv');

    expect(res.status).toBe(200);
    expect(res.body.filePath).not.toMatch(/\.\./);
    expect(res.body.filePath).toMatch(/^\/uploads\/[^/]+$/);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.from('a,b\n1,2'), 'people.csv');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/files', () => {
  it('lists only the current user\'s files, newest first', async () => {
    const other = await request(app).post('/api/auth/register').send({ email: 'other-uploader@example.com', password: 'password123', name: 'Other' });
    await request(app).post('/api/files/upload').set('Authorization', `Bearer ${other.body.token}`).attach('file', Buffer.from('x,y\n1,2'), 'other.csv');

    const res = await request(app).get('/api/files').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((f: any) => f.originalName !== 'other.csv')).toBe(true);
    expect(res.body.some((f: any) => f.originalName === 'people.csv')).toBe(true);
    for (let i = 1; i < res.body.length; i++) {
      expect(new Date(res.body[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(res.body[i].createdAt).getTime());
    }
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/files');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/files/:fileId', () => {
  it('deletes the current user\'s own file', async () => {
    const upload = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('a,b\n1,2'), 'to-delete.csv');

    const list = await request(app).get('/api/files').set('Authorization', `Bearer ${token}`);
    const fileId = list.body.find((f: any) => f.originalName === 'to-delete.csv').id;

    const del = await request(app).delete(`/api/files/${fileId}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const listAfter = await request(app).get('/api/files').set('Authorization', `Bearer ${token}`);
    expect(listAfter.body.some((f: any) => f.id === fileId)).toBe(false);
  });

  it('404s deleting another user\'s file', async () => {
    const other = await request(app).post('/api/auth/login').send({ email: 'other-uploader@example.com', password: 'password123' });
    const list = await request(app).get('/api/files').set('Authorization', `Bearer ${other.body.token}`);
    const otherFileId = list.body[0].id;

    const res = await request(app).delete(`/api/files/${otherFileId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
