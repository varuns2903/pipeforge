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
