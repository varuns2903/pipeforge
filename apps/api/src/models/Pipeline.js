"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pipeline = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const pipelineSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true, trim: true },
    projectId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Project', required: true },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] }
}, { timestamps: true });
exports.Pipeline = mongoose_1.default.model('Pipeline', pipelineSchema);
//# sourceMappingURL=Pipeline.js.map