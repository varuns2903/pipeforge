"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pipelineService = exports.PipelineService = void 0;
const Pipeline_1 = require("../models/Pipeline");
const project_service_1 = require("./project.service");
class PipelineService {
    async create(name, projectId, ownerId) {
        await project_service_1.projectService.getById(projectId, ownerId); // verify ownership
        const pipeline = new Pipeline_1.Pipeline({ name, projectId });
        await pipeline.save();
        return pipeline;
    }
    async list(projectId, ownerId) {
        await project_service_1.projectService.getById(projectId, ownerId);
        return Pipeline_1.Pipeline.find({ projectId }).sort({ updatedAt: -1 });
    }
    async getById(pipelineId, projectId, ownerId) {
        await project_service_1.projectService.getById(projectId, ownerId);
        const pipeline = await Pipeline_1.Pipeline.findOne({ _id: pipelineId, projectId });
        if (!pipeline)
            throw new Error('Pipeline not found');
        return pipeline;
    }
    async update(pipelineId, projectId, ownerId, data) {
        await project_service_1.projectService.getById(projectId, ownerId);
        const pipeline = await Pipeline_1.Pipeline.findOneAndUpdate({ _id: pipelineId, projectId }, data, { new: true });
        if (!pipeline)
            throw new Error('Pipeline not found');
        return pipeline;
    }
    async delete(pipelineId, projectId, ownerId) {
        await project_service_1.projectService.getById(projectId, ownerId);
        const pipeline = await Pipeline_1.Pipeline.findOneAndDelete({ _id: pipelineId, projectId });
        if (!pipeline)
            throw new Error('Pipeline not found');
        return pipeline;
    }
}
exports.PipelineService = PipelineService;
exports.pipelineService = new PipelineService();
//# sourceMappingURL=pipeline.service.js.map