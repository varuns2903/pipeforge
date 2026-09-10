import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';

interface TrashedItem {
  id: string;
  name: string;
  deletedAt: string | null;
}

export function TrashModal({
  title,
  trashQueryKey,
  trashUrl,
  restoreUrl,
  invalidateQueryKeys,
  onClose,
}: {
  title: string;
  /** react-query key for the trashed-items list, so a restore can invalidate it directly. */
  trashQueryKey: unknown[];
  trashUrl: string;
  restoreUrl: (id: string) => string;
  /** Query keys to invalidate on restore, so the item reappears in its normal (non-trash) list. */
  invalidateQueryKeys: unknown[][];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery<TrashedItem[]>({
    queryKey: trashQueryKey,
    queryFn: async () => (await api.get(trashUrl)).data,
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      await api.post(restoreUrl(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trashQueryKey });
      for (const key of invalidateQueryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface-1 border border-border-strong rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="h-14 border-b border-border-strong flex items-center justify-between px-6 shrink-0 bg-surface-2">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Trash2 size={18} className="text-text-secondary" />
            {title}
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-14 bg-surface-2 animate-pulse rounded-lg" />)}
            </div>
          ) : items?.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-10">Nothing in the trash.</p>
          ) : (
            items?.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-surface-2 border border-border-subtle rounded-lg">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{item.name}</div>
                  {item.deletedAt && (
                    <div className="text-xs text-text-tertiary">Deleted {new Date(item.deletedAt).toLocaleString()}</div>
                  )}
                </div>
                <button
                  onClick={() => restore.mutate(item.id)}
                  disabled={restore.isPending}
                  className="glass-button px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs shrink-0 disabled:opacity-50"
                >
                  <RotateCcw size={14} /> Restore
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
