import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Project } from '../src/models/Project';
import { Pipeline } from '../src/models/Pipeline';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_projects';

let token: string;
let projectId: string;
let pipelineId: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});
  await Project.deleteMany({});
  await Pipeline.deleteMany({});

  const regRes = await request(app).post('/api/auth/register').send({ email: 'proj@example.com', password: 'password123', name: 'Proj User' });
  token = regRes.body.token;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Project & Pipeline Endpoints', () => {
  it('should create a project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Test Project' });
    
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Test Project');
    projectId = res.body.id;
  });

  it('should list projects', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('should rename a project', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Project' });
    
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Project');
  });

  it('should create a pipeline in project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/pipelines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Data Ingestion Pipeline' });
    
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Data Ingestion Pipeline');
    expect(res.body.projectId).toBe(projectId);
    pipelineId = res.body.id;
  });

  it('should list pipelines in project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/pipelines`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('should delete a pipeline', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/pipelines/${pipelineId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(204);
  });

  it('should delete a project', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(204);
  });
});
