"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../src/app");
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../src/models/User");
const Project_1 = require("../src/models/Project");
const Pipeline_1 = require("../src/models/Pipeline");
const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_projects';
let token;
let projectId;
let pipelineId;
(0, vitest_1.beforeAll)(async () => {
    await mongoose_1.default.connect(TEST_MONGODB_URI);
    await User_1.User.deleteMany({});
    await Project_1.Project.deleteMany({});
    await Pipeline_1.Pipeline.deleteMany({});
    const regRes = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({ email: 'proj@example.com', password: 'password123', name: 'Proj User' });
    token = regRes.body.token;
});
(0, vitest_1.afterAll)(async () => {
    await mongoose_1.default.connection.close();
});
(0, vitest_1.describe)('Project & Pipeline Endpoints', () => {
    (0, vitest_1.it)('should create a project', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'My Test Project' });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.name).toBe('My Test Project');
        projectId = res.body.id;
    });
    (0, vitest_1.it)('should list projects', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .get('/api/projects')
            .set('Authorization', `Bearer ${token}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.length).toBe(1);
    });
    (0, vitest_1.it)('should rename a project', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .put(`/api/projects/${projectId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Renamed Project' });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.name).toBe('Renamed Project');
    });
    (0, vitest_1.it)('should create a pipeline in project', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post(`/api/projects/${projectId}/pipelines`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Data Ingestion Pipeline' });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.name).toBe('Data Ingestion Pipeline');
        (0, vitest_1.expect)(res.body.projectId).toBe(projectId);
        pipelineId = res.body.id;
    });
    (0, vitest_1.it)('should list pipelines in project', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .get(`/api/projects/${projectId}/pipelines`)
            .set('Authorization', `Bearer ${token}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.length).toBe(1);
    });
    (0, vitest_1.it)('should delete a pipeline', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .delete(`/api/projects/${projectId}/pipelines/${pipelineId}`)
            .set('Authorization', `Bearer ${token}`);
        (0, vitest_1.expect)(res.status).toBe(204);
    });
    (0, vitest_1.it)('should delete a project', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .delete(`/api/projects/${projectId}`)
            .set('Authorization', `Bearer ${token}`);
        (0, vitest_1.expect)(res.status).toBe(204);
    });
});
//# sourceMappingURL=project.routes.test.js.map