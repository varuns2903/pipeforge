import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Connection } from '../src/models/Connection';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_connections';

let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await Connection.deleteMany({});

  const userA = await request(app).post('/api/auth/register').send({ email: 'conn-owner@example.com', password: 'password123', name: 'Owner' });
  tokenA = userA.body.token;

  const userB = await request(app).post('/api/auth/register').send({ email: 'conn-intruder@example.com', password: 'password123', name: 'Intruder' });
  tokenB = userB.body.token;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Connections CRUD', () => {
  let connectionId: string;

  it('creates a postgres connection and never returns the secret', async () => {
    const res = await request(app)
      .post('/api/connections')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'My Postgres',
        type: 'postgres',
        config: { host: 'db.example.com', port: 5432, database: 'app', user: 'appuser' },
        secret: { password: 'super-secret-password' },
      });

    expect(res.status).toBe(201);
    expect(res.body.config.host).toBe('db.example.com');
    expect(JSON.stringify(res.body)).not.toMatch(/super-secret-password/);
    expect(res.body.encryptedSecret).toBeUndefined();
    connectionId = res.body.id;
  });

  it('rejects a postgres connection missing required fields', async () => {
    const res = await request(app)
      .post('/api/connections')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Bad', type: 'postgres', config: {}, secret: {} });

    expect(res.status).toBe(400);
  });

  it('rejects an s3 connection missing the secret access key', async () => {
    const res = await request(app)
      .post('/api/connections')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Bad S3', type: 's3', config: { bucket: 'b', region: 'us-east-1' }, secret: { accessKeyId: 'AKIA' } });

    expect(res.status).toBe(400);
  });

  it('lists only the owner\'s connections, never the secret', async () => {
    const res = await request(app)
      .get('/api/connections')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(JSON.stringify(res.body)).not.toMatch(/super-secret-password/);
  });

  it('stores the secret encrypted, not as plaintext, in the database', async () => {
    const doc = await Connection.findById(connectionId);
    expect(doc?.encryptedSecret).toBeDefined();
    expect(doc?.encryptedSecret).not.toMatch(/super-secret-password/);
    expect(doc?.encryptedSecret).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/); // iv:authTag:ciphertext
  });

  it("denies another user from reading or deleting someone else's connection", async () => {
    const getRes = await request(app)
      .get(`/api/connections/${connectionId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(getRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/connections/${connectionId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(deleteRes.status).toBe(404);
  });

  it('lets the owner delete their connection', async () => {
    const res = await request(app)
      .delete(`/api/connections/${connectionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(204);

    const listRes = await request(app).get('/api/connections').set('Authorization', `Bearer ${tokenA}`);
    expect(listRes.body.length).toBe(0);
  });
});
