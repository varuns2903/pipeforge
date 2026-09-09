import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Calendar, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';

const PRESETS = [
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every day at midnight', cron: '0 0 * * *' },
  { label: 'Every Monday at 9am', cron: '0 9 * * 1' },
  { label: 'Custom', cron: '' },
];

interface Schedule {
  cronExpression: string | null;
  timezone: string | null;
  enabled: boolean;
}

export function ScheduleModal({
  projectId,
  pipelineId,
  schedule,
  onClose,
}: {
  projectId: string;
  pipelineId: string;
  schedule: Schedule;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [cronExpression, setCronExpression] = useState(schedule.cronExpression || '');
  const [timezone, setTimezone] = useState(schedule.timezone || '');
  const [error, setError] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] });

  const setSchedule = useMutation({
    mutationFn: async () => {
      await api.put(`/projects/${projectId}/pipelines/${pipelineId}/schedule`, {
        cronExpression,
        timezone: timezone || undefined,
      });
    },
    onSuccess: () => { invalidate(); onClose(); },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to save schedule'),
  });

  const clearSchedule = useMutation({
    mutationFn: async () => {
      await api.delete(`/projects/${projectId}/pipelines/${pipelineId}/schedule`);
    },
    onSuccess: () => { invalidate(); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface-1 border border-border-strong rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="h-14 border-b border-border-strong flex items-center justify-between px-6 shrink-0 bg-surface-2">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Calendar size={18} className="text-text-secondary" />
            Schedule
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error text-sm rounded-lg">
              {error}
            </div>
          )}

          {schedule.enabled && (
            <div className="p-3 bg-accent-500/10 border border-accent-500/20 rounded-lg text-sm text-text-secondary">
              Currently running on <code className="font-mono text-text-primary">{schedule.cronExpression}</code>
              {schedule.timezone && <> ({schedule.timezone})</>}.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Preset</label>
            <select
              className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
              onChange={(e) => { if (e.target.value) setCronExpression(e.target.value); }}
              defaultValue=""
            >
              <option value="" disabled>Choose a preset or enter a custom expression below</option>
              {PRESETS.map(p => (
                <option key={p.label} value={p.cron}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Cron Expression</label>
            <input
              type="text"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
              placeholder="0 * * * *"
            />
            <p className="text-xs text-text-tertiary mt-2">Standard 5-field cron syntax (minute hour day month weekday).</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Timezone <span className="normal-case text-text-tertiary">(optional, e.g. America/New_York)</span></label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
              placeholder="UTC"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {schedule.enabled ? (
              <button
                onClick={() => clearSchedule.mutate()}
                disabled={clearSchedule.isPending}
                className="text-sm text-status-error hover:text-status-error/80 flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Remove schedule
              </button>
            ) : <span />}

            <button
              onClick={() => { setError(''); setSchedule.mutate(); }}
              disabled={!cronExpression.trim() || setSchedule.isPending}
              className="accent-button px-4 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {setSchedule.isPending ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
