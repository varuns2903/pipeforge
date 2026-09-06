export interface Execution {
  id: string;
  pipelineId: string;
  projectId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt?: string;
  completedAt?: string;
  results?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
