import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Bell } from 'lucide-react';
import { api } from '../../lib/api';

interface Notifications {
  onFailure: boolean;
  onComplete: boolean;
}

export function NotificationsModal({
  projectId,
  pipelineId,
  notifications,
  onClose,
}: {
  projectId: string;
  pipelineId: string;
  notifications: Notifications;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [onFailure, setOnFailure] = useState(notifications.onFailure);
  const [onComplete, setOnComplete] = useState(notifications.onComplete);

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/projects/${projectId}/pipelines/${pipelineId}`, {
        notifications: { onFailure, onComplete },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface-1 border border-border-strong rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="h-14 border-b border-border-strong flex items-center justify-between px-6 shrink-0 bg-surface-2">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Bell size={18} className="text-text-secondary" />
            Notifications
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-text-secondary">Email the owner when this pipeline finishes running.</p>

          <label className="flex items-center gap-3 p-3 bg-surface-2 border border-border-strong rounded-lg cursor-pointer">
            <input type="checkbox" checked={onFailure} onChange={(e) => setOnFailure(e.target.checked)} className="w-4 h-4" />
            <div>
              <div className="text-sm font-medium text-text-primary">On failure</div>
              <div className="text-xs text-text-tertiary">Recommended — get notified when something breaks.</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-surface-2 border border-border-strong rounded-lg cursor-pointer">
            <input type="checkbox" checked={onComplete} onChange={(e) => setOnComplete(e.target.checked)} className="w-4 h-4" />
            <div>
              <div className="text-sm font-medium text-text-primary">On success</div>
              <div className="text-xs text-text-tertiary">Off by default — noisy for frequently-scheduled pipelines.</div>
            </div>
          </label>

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full accent-button px-4 py-2 rounded-md text-sm disabled:opacity-50"
          >
            {save.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
