export interface PipelineSchedule {
  cronExpression: string | null;
  timezone: string | null;
  enabled: boolean;
}

export interface PipelineNotifications {
  onFailure: boolean;
  onComplete: boolean;
}

export interface Pipeline {
  id: string;
  projectId: string;
  name: string;
  nodes: any[];
  edges: any[];
  schedule?: PipelineSchedule;
  notifications?: PipelineNotifications;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
