"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectService = exports.ProjectService = void 0;
const Project_1 = require("../models/Project");
class ProjectService {
    async create(name, ownerId) {
        const project = new Project_1.Project({ name, ownerId });
        await project.save();
        return project;
    }
    async list(ownerId) {
        return Project_1.Project.find({ ownerId }).sort({ updatedAt: -1 });
    }
    async getById(projectId, ownerId) {
        const project = await Project_1.Project.findOne({ _id: projectId, ownerId });
        if (!project)
            throw new Error('Project not found');
        return project;
    }
    async update(projectId, ownerId, name) {
        const project = await Project_1.Project.findOneAndUpdate({ _id: projectId, ownerId }, { name }, { new: true });
        if (!project)
            throw new Error('Project not found');
        return project;
    }
    async delete(projectId, ownerId) {
        const project = await Project_1.Project.findOneAndDelete({ _id: projectId, ownerId });
        if (!project)
            throw new Error('Project not found');
        return project;
    }
}
exports.ProjectService = ProjectService;
exports.projectService = new ProjectService();
//# sourceMappingURL=project.service.js.map