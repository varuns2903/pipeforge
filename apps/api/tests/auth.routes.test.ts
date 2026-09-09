import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import crypto from 'crypto';
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

describe('Registration password policy', () => {
  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'shortpw@example.com', password: 'ab1', name: 'Short PW' });

    expect(res.status).toBe(400);
  });

  it('rejects a password with no digit', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nodigitpw@example.com', password: 'abcdefgh', name: 'No Digit' });

    expect(res.status).toBe(400);
  });
});

describe('Account lockout', () => {
  const email = 'lockout@example.com';

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Lockout Test' });
  });

  it('locks the account after 5 failed login attempts', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send({ email, password: 'wrongpassword' });
      expect(res.status).toBe(401);
    }

    // 6th attempt — even with the CORRECT password — should now be locked out.
    const lockedRes = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    expect(lockedRes.status).toBe(423);
  });
});

describe('Email verification', () => {
  it('registers with emailVerified: false', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'verify@example.com', password: 'password123', name: 'Verify Me' });

    expect(res.status).toBe(201);
    expect(res.body.user.emailVerified).toBe(false);
  });

  it('verifies the email with a valid token', async () => {
    // The raw token is only ever sent via email (never returned by the API),
    // so simulate "the user clicked the emailed link" by hashing a known raw
    // token the same way the service does and writing it directly to the DB.
    const rawToken = 'known-raw-verification-token';
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await User.findOneAndUpdate(
      { email: 'verify@example.com' },
      { emailVerificationTokenHash: hash, emailVerificationExpires: new Date(Date.now() + 60_000) }
    );

    const res = await request(app).post('/api/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(204);

    const user = await User.findOne({ email: 'verify@example.com' });
    expect(user?.emailVerified).toBe(true);
  });

  it('rejects an invalid or expired verification token', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'not-a-real-token' });
    expect(res.status).toBe(400);
  });
});

describe('Password reset', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({ email: 'resetme@example.com', password: 'password123', name: 'Reset Me' });
  });

  it('always returns 204 from forgot-password, whether or not the email exists', async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'resetme@example.com' });
    expect(known.status).toBe(204);

    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(204);
  });

  it('resets the password with a valid token and the old password stops working', async () => {
    const rawToken = 'known-raw-reset-token';
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await User.findOneAndUpdate(
      { email: 'resetme@example.com' },
      { passwordResetTokenHash: hash, passwordResetExpires: new Date(Date.now() + 60_000) }
    );

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'newpassword123' });
    expect(resetRes.status).toBe(204);

    const oldLogin = await request(app).post('/api/auth/login').send({ email: 'resetme@example.com', password: 'password123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ email: 'resetme@example.com', password: 'newpassword123' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an invalid or expired reset token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'not-a-real-token', password: 'newpassword123' });
    expect(res.status).toBe(400);
  });
});
