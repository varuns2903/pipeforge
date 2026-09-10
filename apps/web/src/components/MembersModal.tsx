import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Users, UserPlus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectMember, ProjectRole } from '@pipeforge/shared';

export function MembersModal({
  projectId,
  isOwner,
  currentUserId,
  onClose,
}: {
  projectId: string;
  isOwner: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [error, setError] = useState<string | null>(null);

  const queryKey = ['project-members', projectId];

  const { data: members, isLoading } = useQuery<ProjectMember[]>({
    queryKey,
    queryFn: async () => (await api.get(`/projects/${projectId}/members`)).data,
  });

  const invite = useMutation({
    mutationFn: async () => (await api.post(`/projects/${projectId}/members`, { email, role })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      setEmail('');
      setError(null);
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to invite member'),
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'editor' | 'viewer' }) =>
      (await api.put(`/projects/${projectId}/members/${userId}`, { role })).data,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => (await api.delete(`/projects/${projectId}/members/${userId}`)).data,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const roleBadge = (r: ProjectRole) =>
    r === 'owner' ? 'bg-accent-500/20 text-accent-400 border-accent-500/30'
      : r === 'editor' ? 'bg-surface-3 text-text-secondary border-border-subtle'
        : 'bg-surface-3 text-text-tertiary border-border-subtle';

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface-1 border border-border-strong rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="h-14 border-b border-border-strong flex items-center justify-between px-6 shrink-0 bg-surface-2">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Users size={18} className="text-text-secondary" />
            Members
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {isOwner && (
          <div className="p-4 border-b border-border-subtle space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="flex-1 px-3 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="px-2 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={() => { if (email.trim()) invite.mutate(); }}
                disabled={invite.isPending || !email.trim()}
                className="glass-button px-3 py-2 rounded-md flex items-center gap-1.5 text-sm shrink-0 disabled:opacity-50"
              >
                <UserPlus size={14} /> Invite
              </button>
            </div>
            {error && <p className="text-xs text-status-error">{error}</p>}
            <p className="text-xs text-text-tertiary">Editors can create/edit/run pipelines. Viewers are read-only. The invitee must already have an account.</p>
          </div>
        )}

        <div className="p-4 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-14 bg-surface-2 animate-pulse rounded-lg" />)}
            </div>
          ) : (
            members?.map(member => (
              <div key={member.userId} className="flex items-center justify-between gap-3 p-3 bg-surface-2 border border-border-subtle rounded-lg">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {member.name || member.email || member.userId}
                    {member.userId === currentUserId && <span className="text-text-tertiary font-normal"> (you)</span>}
                  </div>
                  {member.email && <div className="text-xs text-text-tertiary truncate">{member.email}</div>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isOwner && member.role !== 'owner' ? (
                    <select
                      value={member.role}
                      onChange={(e) => changeRole.mutate({ userId: member.userId, role: e.target.value as 'editor' | 'viewer' })}
                      disabled={changeRole.isPending}
                      className={`px-2 py-1 rounded text-xs border ${roleBadge(member.role)}`}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-0.5 rounded text-xs border capitalize ${roleBadge(member.role)}`}>{member.role}</span>
                  )}

                  {isOwner && member.role !== 'owner' && (
                    <button
                      onClick={() => removeMember.mutate(member.userId)}
                      disabled={removeMember.isPending}
                      className="p-1.5 text-text-tertiary hover:text-status-error hover:bg-status-error/10 rounded transition-all disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
