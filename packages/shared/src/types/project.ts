export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  /** The requesting user's own access level on this project. */
  myRole: ProjectRole;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProjectMember {
  userId: string;
  email: string | null;
  name: string | null;
  role: ProjectRole;
}
