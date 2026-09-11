import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PlayCircle, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface ExecutionSummary {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  pipeline: { id: string | null; name: string | null };
  project: { id: string | null; name: string | null };
}

function StatusBadge({ status }: { status: ExecutionSummary['status'] }) {
  switch (status) {
    case 'COMPLETED': return <span className="flex items-center gap-1.5 text-status-success text-sm"><CheckCircle size={14} /> Completed</span>;
    case 'FAILED': return <span className="flex items-center gap-1.5 text-status-error text-sm"><AlertTriangle size={14} /> Failed</span>;
    case 'RUNNING': return <span className="flex items-center gap-1.5 text-accent-500 text-sm animate-pulse"><div className="w-2 h-2 rounded-full bg-accent-500" /> Running</span>;
    default: return <span className="flex items-center gap-1.5 text-text-tertiary text-sm"><Clock size={14} /> Pending</span>;
  }
}

export function Executions() {
  const { data: executions, isLoading } = useQuery<ExecutionSummary[]>({
    queryKey: ['my-executions'],
    queryFn: async () => (await api.get('/executions')).data,
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Executions</h1>
        <p className="text-text-secondary text-sm mt-1">Every pipeline run you've triggered, across all your projects.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-surface-2 rounded-lg animate-pulse border border-border-subtle" />)}
        </div>
      ) : executions?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border-strong rounded-xl bg-surface-1/50">
          <div className="w-12 h-12 bg-surface-2 rounded-full flex items-center justify-center mb-4 border border-border-subtle">
            <PlayCircle className="text-text-tertiary" size={24} />
          </div>
          <h3 className="text-lg font-medium text-text-primary">No executions yet</h3>
          <p className="text-text-secondary text-sm mt-1 max-w-sm text-center">Run a pipeline to see its execution history here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {executions?.map(execution => (
            <Link
              key={execution.id}
              to={execution.project.id && execution.pipeline.id ? `/projects/${execution.project.id}/pipelines/${execution.pipeline.id}` : '#'}
              className="flex items-center justify-between gap-4 p-4 bg-surface-1 hover:bg-surface-2 border border-border-subtle hover:border-border-strong rounded-lg transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary truncate">{execution.pipeline.name || 'Deleted pipeline'}</span>
                  <span className="text-text-tertiary text-xs">in</span>
                  <span className="text-sm text-text-secondary truncate">{execution.project.name || 'Deleted project'}</span>
                </div>
                {execution.error && (
                  <p className="text-xs text-status-error mt-1 truncate">{execution.error}</p>
                )}
              </div>
              <div className="shrink-0 text-xs-mono text-text-tertiary">
                {new Date(execution.createdAt).toLocaleString()}
              </div>
              <div className="shrink-0 w-28 text-right">
                <StatusBadge status={execution.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
