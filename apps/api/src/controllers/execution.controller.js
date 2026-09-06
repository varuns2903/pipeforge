"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionController = void 0;
const Execution_1 = require("../models/Execution");
exports.executionController = {
    async listExecutions(req, res) {
        try {
            const { pipelineId } = req.params;
            const executions = await Execution_1.Execution.find({ pipelineId })
                .sort({ createdAt: -1 })
                .select('-results') // don't send heavy results payload in list
                .limit(50);
            res.json(executions);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async getExecution(req, res) {
        try {
            const { executionId } = req.params;
            const execution = await Execution_1.Execution.findById(executionId);
            if (!execution)
                return res.status(404).json({ error: 'Execution not found' });
            res.json(execution);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};
//# sourceMappingURL=execution.controller.js.map