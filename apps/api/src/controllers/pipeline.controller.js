"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pipelineController = exports.PipelineController = void 0;
const pipeline_service_1 = require("../services/pipeline.service");
const pipeline_engine_1 = require("@pipeforge/pipeline-engine");
const Execution_1 = require("../models/Execution");
const queue_service_1 = require("../services/queue.service");
const mapToDTO = (doc) => ({
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    name: doc.name,
    nodes: doc.nodes,
    edges: doc.edges,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
});
class PipelineController {
    async create(req, res, next) {
        try {
            const pipeline = await pipeline_service_1.pipelineService.create(req.body.name, req.params.projectId, req.user.id);
            res.status(201).json(mapToDTO(pipeline));
        }
        catch (err) {
            if (err.message === 'Project not found')
                return res.status(404).json({ error: err.message });
            next(err);
        }
    }
    async list(req, res, next) {
        try {
            const pipelines = await pipeline_service_1.pipelineService.list(req.params.projectId, req.user.id);
            res.json(pipelines.map(mapToDTO));
        }
        catch (err) {
            if (err.message === 'Project not found')
                return res.status(404).json({ error: err.message });
            next(err);
        }
    }
    async get(req, res, next) {
        try {
            const pipeline = await pipeline_service_1.pipelineService.getById(req.params.pipelineId, req.params.projectId, req.user.id);
            res.json(mapToDTO(pipeline));
        }
        catch (err) {
            if (err.message.includes('not found'))
                return res.status(404).json({ error: err.message });
            next(err);
        }
    }
    async update(req, res, next) {
        try {
            const { name, nodes, edges } = req.body;
            const pipeline = await pipeline_service_1.pipelineService.update(req.params.pipelineId, req.params.projectId, req.user.id, { name, nodes, edges });
            res.json(mapToDTO(pipeline));
        }
        catch (err) {
            if (err.message.includes('not found'))
                return res.status(404).json({ error: err.message });
            next(err);
        }
    }
    async delete(req, res, next) {
        try {
            await pipeline_service_1.pipelineService.delete(req.params.pipelineId, req.params.projectId, req.user.id);
            res.status(204).send();
        }
        catch (err) {
            if (err.message.includes('not found'))
                return res.status(404).json({ error: err.message });
            next(err);
        }
    }
    async validate(req, res, next) {
        try {
            const pipeline = await pipeline_service_1.pipelineService.getById(req.params.pipelineId, req.params.projectId, req.user.id);
            const validator = new pipeline_engine_1.PipelineValidator();
            const result = validator.validate(pipeline);
            res.json(result);
        }
        catch (err) {
            if (err.message.includes('not found'))
                return res.status(404).json({ error: err.message });
            next(err);
        }
    }
    async run(req, res, next) {
        try {
            const pipeline = await pipeline_service_1.pipelineService.getById(req.params.pipelineId, req.params.projectId, req.user.id);
            const validator = new pipeline_engine_1.PipelineValidator();
            const validation = validator.validate(pipeline);
            if (!validation.isValid) {
                return res.status(400).json({ error: 'Pipeline is invalid', details: validation.errors });
            }
            // Create an execution record
            const execution = new Execution_1.Execution({
                pipelineId: pipeline._id,
                projectId: pipeline.projectId,
                pipelineSnapshot: {
                    nodes: pipeline.nodes,
                    edges: pipeline.edges
                },
                status: 'PENDING'
            });
            await execution.save();
            // Queue the job
            await queue_service_1.queueService.queueExecution(execution._id.toString(), pipeline);
            res.status(202).json({
                id: execution._id.toString(),
                status: execution.status
            });
        }
        catch (err) {
            if (err.message.includes('not found'))
                return res.status(404).json({ error: err.message });
            next(err);
        }
    }
}
exports.PipelineController = PipelineController;
exports.pipelineController = new PipelineController();
//# sourceMappingURL=pipeline.controller.js.map