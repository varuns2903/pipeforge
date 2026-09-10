import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Project, Pipeline } from '@pipeforge/shared';
import { Workflow, Plus, Trash2, ArrowLeft, Settings2, Users } from 'lucide-react';
import { TrashModal } from '../components/TrashModal';
import { MembersModal } from '../components/MembersModal';
import { useAuthStore } from '../store/authStore';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    }
  });

  const { data: pipelines, isLoading: isLoadingPipelines } = useQuery<Pipeline[]>({
    queryKey: ['pipelines', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/pipelines`);
      return res.data;
    },
    enabled: !!projectId
  });

  const createPipeline = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post(`/projects/${projectId}/pipelines`, { name });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', projectId] });
      setNewPipelineName('');
      setIsCreating(false);
    }
  });

  const deletePipeline = useMutation({
    mutationFn: async (pipelineId: string) => {
      await api.delete(`/projects/${projectId}/pipelines/${pipelineId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', projectId] });
    }
  });

  if (isLoadingProject) {
    return <div className="p-8"><div className="h-8 w-48 bg-surface-2 animate-pulse rounded"></div></div>;
  }

  if (!project) {
    return <div className="p-8 text-text-secondary">Project not found.</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link to="/" className="text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Workspaces
        </Link>
      </div>
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">{project.name}</h1>
          {project.myRole !== 'owner' && (
            <span className="px-2 py-0.5 rounded text-xs-mono bg-surface-3 text-text-secondary border border-border-subtle capitalize">{project.myRole}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMembers(true)}
            className="glass-button px-3 py-2 rounded-md flex items-center gap-2 text-sm"
          >
            <Users size={16} /> Members
          </button>
          {project.myRole === 'owner' && (
            <button
              onClick={() => setShowTrash(true)}
              className="glass-button px-3 py-2 rounded-md flex items-center gap-2 text-sm"
            >
              <Trash2 size={16} /> Trash
            </button>
          )}
          <button className="glass-button px-3 py-2 rounded-md flex items-center gap-2 text-sm">
            <Settings2 size={16} /> Settings
          </button>
          {project.myRole !== 'viewer' && (
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="accent-button px-4 py-2 rounded-md flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              New Pipeline
            </button>
          )}
        </div>
      </div>

      {showTrash && (
        <TrashModal
          title="Trashed Pipelines"
          trashQueryKey={['pipelines', projectId, 'trash']}
          trashUrl={`/projects/${projectId}/pipelines/trash`}
          restoreUrl={(id) => `/projects/${projectId}/pipelines/${id}/restore`}
          invalidateQueryKeys={[['pipelines', projectId]]}
          onClose={() => setShowTrash(false)}
        />
      )}

      {showMembers && currentUser && (
        <MembersModal
          projectId={projectId!}
          isOwner={project.myRole === 'owner'}
          currentUserId={currentUser.id}
          onClose={() => setShowMembers(false)}
        />
      )}

      {isCreating && (
        <div className="mb-8 glass-panel p-5 rounded-xl border border-border-strong flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <input
            type="text"
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            placeholder="e.g. Daily Data Dump"
            className="flex-1 px-4 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newPipelineName.trim()) createPipeline.mutate(newPipelineName);
              if (e.key === 'Escape') setIsCreating(false);
            }}
          />
          <button 
            onClick={() => { if(newPipelineName.trim()) createPipeline.mutate(newPipelineName) }}
            disabled={createPipeline.isPending}
            className="glass-button px-4 py-2 rounded-md text-sm"
          >
            Create
          </button>
          <button onClick={() => setIsCreating(false)} className="text-text-tertiary hover:text-text-primary text-sm px-2">Cancel</button>
        </div>
      )}

      <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">Pipelines</h2>
      
      {isLoadingPipelines ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-surface-2 rounded-xl animate-pulse border border-border-subtle"></div>
          ))}
        </div>
      ) : pipelines?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border-strong rounded-xl bg-surface-1/50">
          <div className="w-12 h-12 bg-surface-2 rounded-full flex items-center justify-center mb-4 border border-border-subtle">
            <Workflow className="text-text-tertiary" size={24} />
          </div>
          <h3 className="text-lg font-medium text-text-primary">No pipelines found</h3>
          <p className="text-text-secondary text-sm mt-1 max-w-sm text-center mb-6">Create a visual processing pipeline to connect nodes and transform data.</p>
          <button onClick={() => setIsCreating(true)} className="glass-button px-4 py-2 rounded-md flex items-center gap-2 text-sm">
            <Plus size={16} /> Create Pipeline
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pipelines?.map(pipeline => (
            <Link 
              key={pipeline.id} 
              to={`/projects/${project.id}/pipelines/${pipeline.id}`}
              className="group bg-surface-1 hover:bg-surface-2 border border-border-subtle hover:border-accent-500/50 rounded-xl p-5 transition-all duration-200 flex flex-col justify-between h-40"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-surface-3 flex items-center justify-center border border-border-subtle group-hover:bg-accent-500/20 group-hover:border-accent-500/30 transition-colors">
                      <Workflow size={16} className="text-text-secondary group-hover:text-accent-400" />
                    </div>
                    <h3 className="text-base font-medium text-text-primary truncate">{pipeline.name}</h3>
                  </div>
                  
                  {project.myRole !== 'viewer' && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (window.confirm('Delete this pipeline?')) {
                          deletePipeline.mutate(pipeline.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-text-tertiary hover:text-status-error hover:bg-status-error/10 rounded transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-xs-mono bg-surface-3 text-text-secondary border border-border-subtle">
                    {pipeline.nodes?.length || 0} nodes
                  </span>
                </div>
              </div>
              
              <div className="text-xs-mono text-text-tertiary flex items-center justify-between">
                <span>Updated {new Date(pipeline.updatedAt).toLocaleDateString()}</span>
                <span className="text-accent-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">Open editor &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
