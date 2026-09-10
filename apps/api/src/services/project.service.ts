import { Project } from '../models/Project';
import { User } from '../models/User';

export type ProjectRole = 'owner' | 'editor' | 'viewer';
const ROLE_RANK: Record<ProjectRole, number> = { viewer: 1, editor: 2, owner: 3 };

export class ProjectService {
  // Owner is implicit (not stored in `members`); a member's role is looked up
  // from the embedded array. Returns null if the user has no access at all.
  roleOf(project: any, userId: string): ProjectRole | null {
    if (project.ownerId.toString() === userId) return 'owner';
    const member = (project.members || []).find((m: any) => m.userId.toString() === userId);
    return member ? (member.role as ProjectRole) : null;
  }

  async create(name: string, ownerId: string) {
    const project = new Project({ name, ownerId });
    await project.save();
    return project;
  }

  async list(userId: string) {
    // Safety cap against unbounded scans; real cursor-based pagination is a
    // separate, larger change (needs a frontend contract change too).
    return Project.find({
      deletedAt: null,
      $or: [{ ownerId: userId }, { 'members.userId': userId }],
    }).sort({ updatedAt: -1 }).limit(200);
  }

  // `minRole` gates both existence and access in one check: a project a user
  // can't see at all and one they can see but lack permission for both come
  // back as "Project not found" — deliberately not "Forbidden", so probing a
  // project id can't be used to learn whether it exists.
  async getById(projectId: string, userId: string, minRole: ProjectRole = 'viewer') {
    const project = await Project.findOne({ _id: projectId, deletedAt: null });
    if (!project) throw new Error('Project not found');
    const role = this.roleOf(project, userId);
    if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) throw new Error('Project not found');
    return project;
  }

  // Project-level management (rename/delete/restore/members) stays
  // owner-only, so these keep the original direct ownerId filter rather than
  // going through getById's role check.
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
  // they're only reachable through this project's access check) becomes
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

  async listTrashed(ownerId: string) {
    return Project.find({ ownerId, deletedAt: { $ne: null } }).sort({ deletedAt: -1 }).limit(200);
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

  async listMembers(projectId: string, userId: string) {
    const project = await this.getById(projectId, userId, 'viewer');
    const owner = await User.findById(project.ownerId).select('email name');
    const memberUsers = await User.find({ _id: { $in: project.members.map((m: any) => m.userId) } }).select('email name');
    const byId = new Map(memberUsers.map(u => [u._id.toString(), u]));

    return [
      { userId: project.ownerId.toString(), email: owner?.email ?? null, name: owner?.name ?? null, role: 'owner' as ProjectRole },
      ...project.members.map((m: any) => {
        const u = byId.get(m.userId.toString());
        return { userId: m.userId.toString(), email: u?.email ?? null, name: u?.name ?? null, role: m.role as ProjectRole };
      }),
    ];
  }

  // Invite by email: the invitee must already have an account (no
  // email-invite flow / pending-invite state — simplest thing that lets an
  // existing team share a project). Owner-only.
  async addMember(projectId: string, ownerId: string, email: string, role: 'editor' | 'viewer') {
    const project = await Project.findOne({ _id: projectId, ownerId, deletedAt: null });
    if (!project) throw new Error('Project not found');

    const invitee = await User.findOne({ email: email.toLowerCase().trim() });
    if (!invitee) throw new Error('No user found with that email');

    const inviteeId = invitee._id.toString();
    if (inviteeId === ownerId) throw new Error('The project owner is already a member');
    if (project.members.some((m: any) => m.userId.toString() === inviteeId)) {
      throw new Error('This user is already a member of the project');
    }

    project.members.push({ userId: invitee._id, role });
    await project.save();
    return this.listMembers(projectId, ownerId);
  }

  async updateMemberRole(projectId: string, ownerId: string, memberUserId: string, role: 'editor' | 'viewer') {
    const project = await Project.findOne({ _id: projectId, ownerId, deletedAt: null });
    if (!project) throw new Error('Project not found');

    const member = project.members.find((m: any) => m.userId.toString() === memberUserId);
    if (!member) throw new Error('Member not found');

    member.role = role;
    await project.save();
    return this.listMembers(projectId, ownerId);
  }

  async removeMember(projectId: string, ownerId: string, memberUserId: string) {
    const project = await Project.findOne({ _id: projectId, ownerId, deletedAt: null });
    if (!project) throw new Error('Project not found');

    const before = project.members.length;
    const remaining = project.members.filter((m: any) => m.userId.toString() !== memberUserId);
    if (remaining.length === before) throw new Error('Member not found');
    project.members.splice(0, project.members.length, ...remaining);

    await project.save();
    return this.listMembers(projectId, ownerId);
  }
}

export const projectService = new ProjectService();
