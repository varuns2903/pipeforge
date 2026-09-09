export interface PipelineSchedule {
  cronExpression: string | null;
  timezone: string | null;
  enabled: boolean;
}

export interface Pipeline {
  id: string;
  projectId: string;
  name: string;
  nodes: any[];
  edges: any[];
  schedule?: PipelineSchedule;
  createdAt: string;
  updatedAt: string;
}
