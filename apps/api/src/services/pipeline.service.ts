import { Pipeline } from '../models/Pipeline';
import { projectService } from './project.service';

export class PipelineService {
  async create(name: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId); // verify ownership
    const pipeline = new Pipeline({ name, projectId });
    await pipeline.save();
    return pipeline;
  }

  async list(projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId);
    // Safety cap against unbounded scans; real cursor-based pagination is a
    // separate, larger change (needs a frontend contract change too).
    return Pipeline.find({ projectId, deletedAt: null }).sort({ updatedAt: -1 }).limit(200);
  }

  async getById(pipelineId: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId);
    const pipeline = await Pipeline.findOne({ _id: pipelineId, projectId, deletedAt: null });
    if (!pipeline) throw new Error('Pipeline not found');
    return pipeline;
  }

  async update(pipelineId: string, projectId: string, ownerId: string, data: { name?: string, nodes?: any[], edges?: any[] }) {
    await projectService.getById(projectId, ownerId);
    const pipeline = await Pipeline.findOneAndUpdate(
      { _id: pipelineId, projectId, deletedAt: null },
      data,
      { new: true }
    );
    if (!pipeline) throw new Error('Pipeline not found');
    return pipeline;
  }

  // Soft delete: keeps the pipeline (and its execution history) around for
  // recovery instead of destroying it outright.
  async delete(pipelineId: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId);
    const pipeline = await Pipeline.findOneAndUpdate(
      { _id: pipelineId, projectId, deletedAt: null },
      { deletedAt: new Date() },
      { new: true }
    );
    if (!pipeline) throw new Error('Pipeline not found');
    return pipeline;
  }

  async restore(pipelineId: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId);
    const pipeline = await Pipeline.findOneAndUpdate(
      { _id: pipelineId, projectId, deletedAt: { $ne: null } },
      { deletedAt: null },
      { new: true }
    );
    if (!pipeline) throw new Error('Deleted pipeline not found');
    return pipeline;
  }
}

export const pipelineService = new PipelineService();
