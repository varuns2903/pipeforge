import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Zap } from 'lucide-react';
import { api } from '../../lib/api';

interface PipelineSummary {
  id: string;
  name: string;
}

export function TriggersModal({
  projectId,
  pipelineId,
  triggerPipelineIds,
  onClose,
}: {
  projectId: string;
  pipelineId: string;
  triggerPipelineIds: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: pipelines, isLoading } = useQuery<PipelineSummary[]>({
    queryKey: ['pipelines', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/pipelines`)).data,
  });

  const [selected, setSelected] = useState<string[]>(triggerPipelineIds);
  const [error, setError] = useState('');

  useEffect(() => setSelected(triggerPipelineIds), [triggerPipelineIds]);

  const toggle = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const save = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/projects/${projectId}/pipelines/${pipelineId}/triggers`, {
        targetPipelineIds: selected,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['pipeline', pipelineId], data);
      setError('');
      onClose();
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to save triggers'),
  });

  const otherPipelines = (pipelines || []).filter((p) => p.id !== pipelineId);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface-1 border border-border-strong rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="h-14 border-b border-border-strong flex items-center justify-between px-6 shrink-0 bg-surface-2">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Zap size={18} className="text-text-secondary" />
            Triggers
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-text-secondary">
            When this pipeline completes successfully, automatically run these pipelines in the same project.
          </p>

          {error && (
            <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error text-sm rounded-lg">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="h-24 bg-surface-2 animate-pulse rounded-lg" />
          ) : otherPipelines.length === 0 ? (
            <p className="text-sm text-text-tertiary">No other pipelines in this project yet.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {otherPipelines.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-3 bg-surface-2 border border-border-strong rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggle(p.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-text-primary">{p.name}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="accent-button px-4 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {save.isPending ? 'Saving...' : 'Save Triggers'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
