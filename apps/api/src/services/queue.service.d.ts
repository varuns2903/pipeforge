import { Queue } from 'bullmq';
export declare const pipelineQueue: Queue<any, any, string, any, any, string, import("bullmq").RedisQueueBackend>;
export declare class QueueService {
    queueExecution(executionId: string, pipelineData: any): Promise<void>;
}
export declare const queueService: QueueService;
//# sourceMappingURL=queue.service.d.ts.map