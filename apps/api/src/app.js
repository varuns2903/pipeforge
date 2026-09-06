"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = require("./routes/auth.routes");
const project_routes_1 = require("./routes/project.routes");
const file_routes_1 = require("./routes/file.routes");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
exports.app.use('/api/auth', auth_routes_1.authRouter);
exports.app.use('/api/projects', project_routes_1.projectRouter);
exports.app.use('/api/files', file_routes_1.fileRouter);
exports.app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});
//# sourceMappingURL=app.js.map