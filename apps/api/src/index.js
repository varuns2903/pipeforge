"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const app_1 = require("./app");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const ioredis_1 = __importDefault(require("ioredis"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../../.env') });
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pipeforge';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const httpServer = (0, http_1.createServer)(app_1.app);
// Socket.io Setup
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: '*' } // Match frontend origin in prod
});
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        socket.user = decoded;
        next();
    }
    catch (err) {
        next(new Error('Authentication error'));
    }
});
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    socket.on('subscribe_pipeline', (pipelineId) => {
        socket.join(`pipeline_${pipelineId}`);
        console.log(`Socket ${socket.id} joined pipeline_${pipelineId}`);
    });
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});
// Redis Subscriber for Worker Updates
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6380', 10);
const redisSubscriber = new ioredis_1.default({ host: redisHost, port: redisPort });
redisSubscriber.subscribe('execution-updates');
redisSubscriber.on('message', (channel, message) => {
    if (channel === 'execution-updates') {
        try {
            const data = JSON.parse(message);
            if (data.pipelineId) {
                io.to(`pipeline_${data.pipelineId}`).emit('execution_update', data);
            }
        }
        catch (err) {
            console.error('Error parsing execution update:', err);
        }
    }
});
mongoose_1.default.connect(MONGODB_URI)
    .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
        console.log(`API server running on port ${PORT}`);
    });
})
    .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map