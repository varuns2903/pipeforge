import { Project } from '../models/Project';

export class ProjectService {
  async create(name: string, ownerId: string) {
    const project = new Project({ name, ownerId });
    await project.save();
    return project;
  }

  async list(ownerId: string) {
    return Project.find({ ownerId }).sort({ updatedAt: -1 });
  }

  async getById(projectId: string, ownerId: string) {
    const project = await Project.findOne({ _id: projectId, ownerId });
    if (!project) throw new Error('Project not found');
    return project;
  }

  async update(projectId: string, ownerId: string, name: string) {
    const project = await Project.findOneAndUpdate(
      { _id: projectId, ownerId },
      { name },
      { new: true }
    );
    if (!project) throw new Error('Project not found');
    return project;
  }

  async delete(projectId: string, ownerId: string) {
    const project = await Project.findOneAndDelete({ _id: projectId, ownerId });
    if (!project) throw new Error('Project not found');
    return project;
  }
}

export const projectService = new ProjectService();
