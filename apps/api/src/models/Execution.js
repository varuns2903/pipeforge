"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Execution = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const executionSchema = new mongoose_1.default.Schema({
    pipelineId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Pipeline', required: true },
    projectId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Project', required: true },
    pipelineSnapshot: { type: mongoose_1.default.Schema.Types.Mixed }, // { nodes: [], edges: [] }
    status: { type: String, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    startedAt: { type: Date },
    completedAt: { type: Date },
    results: { type: mongoose_1.default.Schema.Types.Mixed }, // flexible JSON schema
    error: { type: String }
}, { timestamps: true });
exports.Execution = mongoose_1.default.model('Execution', executionSchema);
//# sourceMappingURL=Execution.js.map