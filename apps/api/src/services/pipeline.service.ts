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
    return Pipeline.find({ projectId }).sort({ updatedAt: -1 }).limit(200);
  }

  async getById(pipelineId: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId);
    const pipeline = await Pipeline.findOne({ _id: pipelineId, projectId });
    if (!pipeline) throw new Error('Pipeline not found');
    return pipeline;
  }

  async update(pipelineId: string, projectId: string, ownerId: string, data: { name?: string, nodes?: any[], edges?: any[] }) {
    await projectService.getById(projectId, ownerId);
    const pipeline = await Pipeline.findOneAndUpdate(
      { _id: pipelineId, projectId },
      data,
      { new: true }
    );
    if (!pipeline) throw new Error('Pipeline not found');
    return pipeline;
  }

  async delete(pipelineId: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId);
    const pipeline = await Pipeline.findOneAndDelete({ _id: pipelineId, projectId });
    if (!pipeline) throw new Error('Pipeline not found');
    return pipeline;
  }
}

export const pipelineService = new PipelineService();
