import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Webhook as WebhookIcon, Trash2, Copy, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

interface WebhookConfig {
  url: string;
  secret: string;
  onFailure: boolean;
  onComplete: boolean;
}

export function WebhookModal({
  projectId,
  pipelineId,
  onClose,
}: {
  projectId: string;
  pipelineId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['pipeline-webhook', pipelineId];

  const { data: webhook, isLoading } = useQuery<WebhookConfig | null>({
    queryKey,
    queryFn: async () => (await api.get(`/projects/${projectId}/pipelines/${pipelineId}/webhook`)).data,
  });

  const [url, setUrl] = useState('');
  const [onFailure, setOnFailure] = useState(true);
  const [onComplete, setOnComplete] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!webhook) return;
    setUrl(webhook.url);
    setOnFailure(webhook.onFailure);
    setOnComplete(webhook.onComplete);
  }, [webhook]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const save = useMutation({
    mutationFn: async (regenerateSecret: boolean) => {
      const res = await api.put(`/projects/${projectId}/pipelines/${pipelineId}/webhook`, {
        url, onFailure, onComplete, regenerateSecret,
      });
      return res.data as WebhookConfig;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] });
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to save webhook'),
  });

  const remove = useMutation({
    mutationFn: async () => { await api.delete(`/projects/${projectId}/pipelines/${pipelineId}/webhook`); },
    onSuccess: () => { invalidate(); onClose(); },
  });

  const copySecret = () => {
    if (!webhook?.secret) return;
    navigator.clipboard.writeText(webhook.secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface-1 border border-border-strong rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="h-14 border-b border-border-strong flex items-center justify-between px-6 shrink-0 bg-surface-2">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <WebhookIcon size={18} className="text-text-secondary" />
            Webhook
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6"><div className="h-24 bg-surface-2 animate-pulse rounded-lg" /></div>
        ) : (
          <div className="p-6 space-y-5">
            <p className="text-sm text-text-secondary">POST a JSON payload to a URL when this pipeline finishes running.</p>

            {error && (
              <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error text-sm rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Endpoint URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                placeholder="https://your-server.example.com/webhooks/pipeforge"
              />
            </div>

            {webhook?.secret && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Signing Secret</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-xs text-text-primary font-mono truncate">
                    {webhook.secret}
                  </code>
                  <button onClick={copySecret} className="glass-button p-2 rounded-md" title="Copy secret">
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => save.mutate(true)}
                    disabled={save.isPending}
                    className="glass-button p-2 rounded-md disabled:opacity-50"
                    title="Regenerate secret"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <p className="text-xs text-text-tertiary mt-2">
                  {copied ? 'Copied!' : 'Verify deliveries with HMAC-SHA256: the "X-PipeForge-Signature" header is "sha256=" + hex HMAC of the raw body using this secret.'}
                </p>
              </div>
            )}

            <label className="flex items-center gap-3 p-3 bg-surface-2 border border-border-strong rounded-lg cursor-pointer">
              <input type="checkbox" checked={onFailure} onChange={(e) => setOnFailure(e.target.checked)} className="w-4 h-4" />
              <div>
                <div className="text-sm font-medium text-text-primary">On failure</div>
                <div className="text-xs text-text-tertiary">Recommended — trigger downstream alerting when something breaks.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-surface-2 border border-border-strong rounded-lg cursor-pointer">
              <input type="checkbox" checked={onComplete} onChange={(e) => setOnComplete(e.target.checked)} className="w-4 h-4" />
              <div>
                <div className="text-sm font-medium text-text-primary">On success</div>
                <div className="text-xs text-text-tertiary">Off by default — noisy for frequently-scheduled pipelines.</div>
              </div>
            </label>

            <div className="flex items-center justify-between pt-2">
              {webhook ? (
                <button
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                  className="text-sm text-status-error hover:text-status-error/80 flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Remove webhook
                </button>
              ) : <span />}

              <button
                onClick={() => save.mutate(false)}
                disabled={!url.trim() || save.isPending}
                className="accent-button px-4 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {save.isPending ? 'Saving...' : 'Save Webhook'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
