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
// Use a separate database for tests
const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test';
(0, vitest_1.beforeAll)(async () => {
    await mongoose_1.default.connect(TEST_MONGODB_URI);
    await User_1.User.deleteMany({});
});
(0, vitest_1.afterAll)(async () => {
    await mongoose_1.default.connection.close();
});
(0, vitest_1.describe)('Auth Endpoints', () => {
    let token;
    (0, vitest_1.it)('should register a new user', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/auth/register')
            .send({
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User'
        });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.user.email).toBe('test@example.com');
        (0, vitest_1.expect)(res.body.token).toBeDefined();
        token = res.body.token; // Save token for later tests
    });
    (0, vitest_1.it)('should not register duplicate email', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/auth/register')
            .send({
            email: 'test@example.com',
            password: 'password123',
            name: 'Another User'
        });
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.error).toBe('Email already in use');
    });
    (0, vitest_1.it)('should fail with invalid credentials', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/auth/login')
            .send({
            email: 'test@example.com',
            password: 'wrongpassword'
        });
        (0, vitest_1.expect)(res.status).toBe(401);
    });
    (0, vitest_1.it)('should login and return token', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/auth/login')
            .send({
            email: 'test@example.com',
            password: 'password123'
        });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.token).toBeDefined();
        token = res.body.token;
    });
    (0, vitest_1.it)('should access protected /me route', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.user.email).toBe('test@example.com');
    });
    (0, vitest_1.it)('should fail accessing /me without token', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .get('/api/auth/me');
        (0, vitest_1.expect)(res.status).toBe(401);
    });
});
(0, vitest_1.it)('should fail with invalid token', async () => {
    const res = await (0, supertest_1.default)(app_1.app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');
    (0, vitest_1.expect)(res.status).toBe(401);
    (0, vitest_1.expect)(res.body.error).toBe('Unauthorized: Invalid token');
});
//# sourceMappingURL=auth.routes.test.js.map