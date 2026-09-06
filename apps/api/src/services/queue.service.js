"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueService = exports.QueueService = exports.pipelineQueue = void 0;
const bullmq_1 = require("bullmq");
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6380', 10);
exports.pipelineQueue = new bullmq_1.Queue('pipeline-executions', {
    connection: {
        host: redisHost,
        port: redisPort,
    }
});
class QueueService {
    async queueExecution(executionId, pipelineData) {
        await exports.pipelineQueue.add('execute-pipeline', {
            executionId,
            pipeline: pipelineData
        });
    }
}
exports.QueueService = QueueService;
exports.queueService = new QueueService();
//# sourceMappingURL=queue.service.js.map