import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { HardDrive, Activity } from 'lucide-react';

interface Usage {
  storage: { usedBytes: number; limitBytes: number };
  executions: { active: number; limit: number };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1000) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function Bar({ ratio }: { ratio: number }) {
  const pct = Math.min(100, ratio * 100);
  const color = ratio >= 0.9 ? 'bg-status-error' : ratio >= 0.7 ? 'bg-status-warning' : 'bg-accent-500';
  return (
    <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function UsageWidget() {
  const { data: usage } = useQuery<Usage>({
    queryKey: ['usage'],
    queryFn: async () => (await api.get('/usage')).data,
    refetchInterval: 30_000,
  });

  if (!usage) return null;

  const storageRatio = usage.storage.limitBytes > 0 ? usage.storage.usedBytes / usage.storage.limitBytes : 0;
  const executionsRatio = usage.executions.limit > 0 ? usage.executions.active / usage.executions.limit : 0;

  return (
    <div className="glass-panel rounded-xl border border-border-strong p-4 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
            <HardDrive size={12} /> Storage
          </div>
          <span className="text-xs text-text-tertiary font-mono">
            {formatBytes(usage.storage.usedBytes)} / {formatBytes(usage.storage.limitBytes)}
          </span>
        </div>
        <Bar ratio={storageRatio} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
            <Activity size={12} /> Active Executions
          </div>
          <span className="text-xs text-text-tertiary font-mono">
            {usage.executions.active} / {usage.executions.limit}
          </span>
        </div>
        <Bar ratio={executionsRatio} />
      </div>
    </div>
  );
}
