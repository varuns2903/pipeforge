import { Project } from '../models/Project';

export class ProjectService {
  async create(name: string, ownerId: string) {
    const project = new Project({ name, ownerId });
    await project.save();
    return project;
  }

  async list(ownerId: string) {
    // Safety cap against unbounded scans; real cursor-based pagination is a
    // separate, larger change (needs a frontend contract change too).
    return Project.find({ ownerId, deletedAt: null }).sort({ updatedAt: -1 }).limit(200);
  }

  async getById(projectId: string, ownerId: string) {
    const project = await Project.findOne({ _id: projectId, ownerId, deletedAt: null });
    if (!project) throw new Error('Project not found');
    return project;
  }

  async update(projectId: string, ownerId: string, name: string) {
    const project = await Project.findOneAndUpdate(
      { _id: projectId, ownerId, deletedAt: null },
      { name },
      { new: true }
    );
    if (!project) throw new Error('Project not found');
    return project;
  }

  // Soft delete: the project (and, transitively, its pipelines/executions —
  // they're only reachable through this project's ownership check) becomes
  // invisible and inaccessible, but stays recoverable via restore().
  async delete(projectId: string, ownerId: string) {
    const project = await Project.findOneAndUpdate(
      { _id: projectId, ownerId, deletedAt: null },
      { deletedAt: new Date() },
      { new: true }
    );
    if (!project) throw new Error('Project not found');
    return project;
  }

  async restore(projectId: string, ownerId: string) {
    const project = await Project.findOneAndUpdate(
      { _id: projectId, ownerId, deletedAt: { $ne: null } },
      { deletedAt: null },
      { new: true }
    );
    if (!project) throw new Error('Deleted project not found');
    return project;
  }
}

export const projectService = new ProjectService();
