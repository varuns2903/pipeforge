"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectRouter = void 0;
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const project_controller_1 = require("../controllers/project.controller");
const pipeline_controller_1 = require("../controllers/pipeline.controller");
const execution_controller_1 = require("../controllers/execution.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const express_validator_2 = require("express-validator");
exports.projectRouter = (0, express_1.Router)();
const validate = (req, res, next) => {
    const errors = (0, express_validator_2.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};
const nameValidation = [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required').trim()
];
exports.projectRouter.use(auth_middleware_1.requireAuth);
// Project Routes
exports.projectRouter.post('/', nameValidation, validate, project_controller_1.projectController.create);
exports.projectRouter.get('/', project_controller_1.projectController.list);
exports.projectRouter.get('/:projectId', project_controller_1.projectController.get);
exports.projectRouter.put('/:projectId', nameValidation, validate, project_controller_1.projectController.update);
exports.projectRouter.delete('/:projectId', project_controller_1.projectController.delete);
// Pipeline Routes (nested)
exports.projectRouter.post('/:projectId/pipelines', nameValidation, validate, pipeline_controller_1.pipelineController.create);
exports.projectRouter.get('/:projectId/pipelines', pipeline_controller_1.pipelineController.list);
exports.projectRouter.get('/:projectId/pipelines/:pipelineId', pipeline_controller_1.pipelineController.get);
exports.projectRouter.get('/:projectId/pipelines/:pipelineId/validate', pipeline_controller_1.pipelineController.validate);
exports.projectRouter.post('/:projectId/pipelines/:pipelineId/run', pipeline_controller_1.pipelineController.run);
exports.projectRouter.get('/:projectId/pipelines/:pipelineId/executions', execution_controller_1.executionController.listExecutions);
exports.projectRouter.get('/:projectId/pipelines/:pipelineId/executions/:executionId', execution_controller_1.executionController.getExecution);
exports.projectRouter.put('/:projectId/pipelines/:pipelineId', pipeline_controller_1.pipelineController.update);
exports.projectRouter.delete('/:projectId/pipelines/:pipelineId', pipeline_controller_1.pipelineController.delete);
//# sourceMappingURL=project.routes.js.map