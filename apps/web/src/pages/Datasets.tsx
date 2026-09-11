import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Database, Trash2, FileText } from 'lucide-react';

interface FileSummary {
  id: string;
  filePath: string;
  originalName: string;
  size: number;
  createdAt: string;
  project: { id: string | null; name: string | null };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1000) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export function Datasets() {
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery<FileSummary[]>({
    queryKey: ['my-files'],
    queryFn: async () => (await api.get('/files')).data,
  });

  const deleteFile = useMutation({
    mutationFn: async (file: FileSummary) => { await api.delete(`/projects/${file.project.id}/files/${file.id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-files'] }),
    onError: (err: any) => alert(err.response?.data?.error || 'Failed to delete file (you may only have view access to its project)'),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Datasets</h1>
        <p className="text-text-secondary text-sm mt-1">Files uploaded across every project you belong to, for use as pipeline sources (csv-input / json-input).</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface-2 rounded-lg animate-pulse border border-border-subtle" />)}
        </div>
      ) : files?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border-strong rounded-xl bg-surface-1/50">
          <div className="w-12 h-12 bg-surface-2 rounded-full flex items-center justify-center mb-4 border border-border-subtle">
            <Database className="text-text-tertiary" size={24} />
          </div>
          <h3 className="text-lg font-medium text-text-primary">No datasets yet</h3>
          <p className="text-text-secondary text-sm mt-1 max-w-sm text-center">Upload a .csv or .json file from a CSV Upload / JSON Upload node in the pipeline editor.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files?.map(file => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-4 p-4 bg-surface-1 border border-border-subtle rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded bg-surface-3 flex items-center justify-center border border-border-subtle shrink-0">
                  <FileText size={16} className="text-text-secondary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{file.originalName}</div>
                  <div className="text-xs text-text-tertiary">
                    {file.project.name || 'Deleted project'} &middot; Uploaded {new Date(file.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-xs-mono text-text-secondary">{formatBytes(file.size)}</div>
              <button
                onClick={() => { if (window.confirm(`Delete "${file.originalName}"? Pipelines referencing it will fail to run.`)) deleteFile.mutate(file); }}
                disabled={deleteFile.isPending}
                className="shrink-0 p-1.5 text-text-tertiary hover:text-status-error hover:bg-status-error/10 rounded transition-all disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
