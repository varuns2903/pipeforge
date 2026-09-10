import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { File } from '../src/models/File';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_usage';

let token: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await File.deleteMany({});

  const res = await request(app).post('/api/auth/register').send({ email: 'usage@example.com', password: 'password123', name: 'Usage User' });
  token = res.body.token;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('GET /api/usage', () => {
  it('starts at zero usage', async () => {
    const res = await request(app).get('/api/usage').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.storage.usedBytes).toBe(0);
    expect(res.body.storage.limitBytes).toBeGreaterThan(0);
    expect(res.body.executions.active).toBe(0);
    expect(res.body.executions.limit).toBeGreaterThan(0);
  });

  it('reflects an uploaded file\'s size', async () => {
    await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.alloc(1234, 'a'), 'usage-test.csv');

    const res = await request(app).get('/api/usage').set('Authorization', `Bearer ${token}`);
    expect(res.body.storage.usedBytes).toBe(1234);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/usage');
    expect(res.status).toBe(401);
  });
});
