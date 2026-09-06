"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectController = exports.ProjectController = void 0;
const project_service_1 = require("../services/project.service");
const mapToDTO = (doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    ownerId: doc.ownerId.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
});
class ProjectController {
    async create(req, res, next) {
        try {
            const project = await project_service_1.projectService.create(req.body.name, req.user.id);
            res.status(201).json(mapToDTO(project));
        }
        catch (err) {
            next(err);
        }
    }
    async list(req, res, next) {
        try {
            const projects = await project_service_1.projectService.list(req.user.id);
            res.json(projects.map(mapToDTO));
        }
        catch (err) {
            next(err);
        }
    }
    async get(req, res, next) {
        try {
            const project = await project_service_1.projectService.getById(req.params.projectId, req.user.id);
            res.json(mapToDTO(project));
        }
        catch (err) {
            if (err.message === 'Project not found')
                return res.status(404).json({ error: err.message });
            next(err);
        }
    }
    async update(req, res, next) {
        try {
            const project = await project_service_1.projectService.update(req.params.projectId, req.user.id, req.body.name);
            res.json(mapToDTO(project));
        }
        catch (err) {
            if (err.message === 'Project not found')
                return res.status(404).json({ error: err.message });
            next(err);
        }
    }
    async delete(req, res, next) {
        try {
            await project_service_1.projectService.delete(req.params.projectId, req.user.id);
            res.status(204).send();
        }
        catch (err) {
            if (err.message === 'Project not found')
                return res.status(404).json({ error: err.message });
            next(err);
        }
    }
}
exports.ProjectController = ProjectController;
exports.projectController = new ProjectController();
//# sourceMappingURL=project.controller.js.map