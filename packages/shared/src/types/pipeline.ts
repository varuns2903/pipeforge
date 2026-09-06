export interface Pipeline {
  id: string;
  projectId: string;
  name: string;
  nodes: any[];
  edges: any[];
  createdAt: string;
  updatedAt: string;
}
