import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Plug, Plus, Trash2, Database, Cloud, Globe, ArrowLeft } from 'lucide-react';
import type { Project } from '@pipeforge/shared';

interface Connection {
  id: string;
  name: string;
  type: 'postgres' | 's3' | 'api';
  config: Record<string, any>;
  createdAt: string;
}

const TYPE_ICON = { postgres: Database, s3: Cloud, api: Globe };

const EMPTY_FORM = {
  name: '',
  type: 'postgres' as 'postgres' | 's3' | 'api',
  host: '', port: '5432', database: '', user: '', password: '', ssl: false,
  bucket: '', region: '', accessKeyId: '', secretAccessKey: '',
  baseUrl: '', authType: 'none' as 'none' | 'bearer' | 'header', headerName: '', token: '',
};

export function Connections() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}`)).data,
  });

  const { data: connections, isLoading } = useQuery<Connection[]>({
    queryKey: ['connections', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/connections`)).data,
  });

  const canEdit = project?.myRole !== 'viewer';

  const createConnection = useMutation({
    mutationFn: async () => {
      let config: any = {};
      let secret: any = {};
      if (form.type === 'postgres') {
        config = { host: form.host, port: Number(form.port) || 5432, database: form.database, user: form.user, ssl: form.ssl };
        secret = { password: form.password };
      } else if (form.type === 's3') {
        config = { bucket: form.bucket, region: form.region };
        secret = { accessKeyId: form.accessKeyId, secretAccessKey: form.secretAccessKey };
      } else {
        config = { baseUrl: form.baseUrl, authType: form.authType, headerName: form.headerName || undefined };
        secret = { token: form.token || undefined };
      }
      await api.post(`/projects/${projectId}/connections`, { name: form.name, type: form.type, config, secret });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', projectId] });
      setForm(EMPTY_FORM);
      setIsCreating(false);
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to create connection'),
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/projects/${projectId}/connections/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections', projectId] }),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link to={`/projects/${projectId}`} className="text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> {project?.name || 'Project'}
        </Link>
      </div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Connections</h1>
          <p className="text-text-secondary text-sm mt-1">Saved credentials for Postgres, S3, and API data sources, shared with every member of this project. Credentials are encrypted at rest and never shown again after creation.</p>
        </div>
        {canEdit && (
          <button onClick={() => setIsCreating(!isCreating)} className="accent-button px-4 py-2 rounded-md flex items-center gap-2 text-sm shrink-0">
            <Plus size={16} /> New Connection
          </button>
        )}
      </div>

      {isCreating && (
        <div className="mb-8 glass-panel p-6 rounded-xl border border-border-strong space-y-4">
          {error && <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error text-sm rounded-lg">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Name</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
              placeholder="e.g. Production Postgres" />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Type</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}
              className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500">
              <option value="postgres">Postgres</option>
              <option value="s3">S3</option>
              <option value="api">Generic API</option>
            </select>
          </div>

          {form.type === 'postgres' && (
            <div className="grid grid-cols-2 gap-4">
              <input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="Host" className="px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
              <input value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} placeholder="Port" className="px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
              <input value={form.database} onChange={e => setForm({ ...form, database: e.target.value })} placeholder="Database" className="px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
              <input value={form.user} onChange={e => setForm({ ...form, user: e.target.value })} placeholder="User" className="px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
              <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" placeholder="Password" className="px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary col-span-2" />
            </div>
          )}

          {form.type === 's3' && (
            <div className="grid grid-cols-2 gap-4">
              <input value={form.bucket} onChange={e => setForm({ ...form, bucket: e.target.value })} placeholder="Bucket" className="px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
              <input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} placeholder="Region (e.g. us-east-1)" className="px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
              <input value={form.accessKeyId} onChange={e => setForm({ ...form, accessKeyId: e.target.value })} placeholder="Access Key ID" className="px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
              <input value={form.secretAccessKey} onChange={e => setForm({ ...form, secretAccessKey: e.target.value })} type="password" placeholder="Secret Access Key" className="px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
            </div>
          )}

          {form.type === 'api' && (
            <div className="space-y-4">
              <input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} placeholder="Base URL (e.g. https://api.example.com)" className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
              <select value={form.authType} onChange={e => setForm({ ...form, authType: e.target.value as any })} className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary">
                <option value="none">No auth</option>
                <option value="bearer">Bearer token</option>
                <option value="header">Custom header</option>
              </select>
              {form.authType === 'header' && (
                <input value={form.headerName} onChange={e => setForm({ ...form, headerName: e.target.value })} placeholder="Header name (e.g. X-API-Key)" className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
              )}
              {form.authType !== 'none' && (
                <input value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} type="password" placeholder="Token / API key" className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary" />
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => createConnection.mutate()} disabled={!form.name.trim() || createConnection.isPending} className="accent-button px-4 py-2 rounded-md text-sm disabled:opacity-50">
              {createConnection.isPending ? 'Creating...' : 'Create Connection'}
            </button>
            <button onClick={() => { setIsCreating(false); setError(''); }} className="text-sm text-text-tertiary hover:text-text-primary">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-24 bg-surface-2 rounded-xl animate-pulse border border-border-subtle" />
      ) : connections?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border-strong rounded-xl bg-surface-1/50">
          <Plug className="text-text-tertiary mb-4" size={24} />
          <h3 className="text-lg font-medium text-text-primary">No connections yet</h3>
          <p className="text-text-secondary text-sm mt-1 max-w-sm text-center">Add a Postgres, S3, or API connection to use in this project's pipeline connector nodes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections?.map(conn => {
            const Icon = TYPE_ICON[conn.type];
            return (
              <div key={conn.id} className="flex items-center justify-between bg-surface-1 border border-border-subtle rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-surface-3 flex items-center justify-center border border-border-subtle">
                    <Icon size={16} className="text-text-secondary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-primary">{conn.name}</div>
                    <div className="text-xs text-text-tertiary font-mono">
                      {conn.type === 'postgres' && `${conn.config.host}:${conn.config.port}/${conn.config.database}`}
                      {conn.type === 's3' && `s3://${conn.config.bucket} (${conn.config.region})`}
                      {conn.type === 'api' && conn.config.baseUrl}
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => { if (window.confirm(`Delete connection "${conn.name}"?`)) deleteConnection.mutate(conn.id); }}
                    className="p-1.5 text-text-tertiary hover:text-status-error hover:bg-status-error/10 rounded transition-all">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
