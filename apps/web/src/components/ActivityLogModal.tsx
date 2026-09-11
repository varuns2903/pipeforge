import { useInfiniteQuery } from '@tanstack/react-query';
import { X, Activity } from 'lucide-react';
import { api } from '../lib/api';

interface ActivityLogEntry {
  id: string;
  action: string;
  message: string;
  metadata: Record<string, unknown> | null;
  user: { id: string; name: string | null; email: string | null } | null;
  createdAt: string;
}

export function ActivityLogModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const {
    data: pages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['activity-log', projectId],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const res = await api.get(`/projects/${projectId}/activity`, {
        params: pageParam ? { cursor: pageParam } : {},
      });
      return res.data as { items: ActivityLogEntry[]; nextCursor: string | null };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const entries = pages?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface-1 border border-border-strong rounded-xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="h-14 border-b border-border-strong flex items-center justify-between px-6 shrink-0 bg-surface-2">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Activity size={18} className="text-text-secondary" />
            Activity Log
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-sm text-text-tertiary">Loading activity...</div>
          ) : entries.length === 0 ? (
            <div className="p-6 text-sm text-text-tertiary">No activity recorded yet.</div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {entries.map((entry) => (
                <li key={entry.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-text-primary">{entry.message}</p>
                    <span className="text-xs-mono text-text-tertiary whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-1">
                    {entry.user?.name || entry.user?.email || 'A former member'}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full p-3 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
