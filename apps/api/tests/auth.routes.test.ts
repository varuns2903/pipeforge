import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';

// Use a separate database for tests
const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test';

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Auth Endpoints', () => {
  let token: string;

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.token).toBeDefined();
    token = res.body.token; // Save token for later tests
  });

  it('should not register duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Another User'
      });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email already in use');
  });

  it('should fail with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });
    
    expect(res.status).toBe(401);
  });

  it('should login and return token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  it('should access protected /me route', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('should fail accessing /me without token', async () => {
    const res = await request(app)
      .get('/api/auth/me');
    
    expect(res.status).toBe(401);
  });
});

  it('should fail with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized: Invalid token');
  });

describe('Cookie-based auth', () => {
  it('sets an httpOnly cookie on login and uses it to authenticate', async () => {
    const agent = request.agent(app); // persists cookies across requests, like a browser

    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie[0]).toMatch(/token=/);
    expect(setCookie[0]).toMatch(/HttpOnly/);

    // No Authorization header — the agent's cookie jar carries the session.
    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('test@example.com');
  });

  it('clears the cookie on logout, ending the session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'test@example.com', password: 'password123' });

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(204);

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(401);
  });
});
