import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Project } from '@pipeforge/shared';
import { Folder, Plus, Trash2 } from 'lucide-react';
import { UsageWidget } from '../components/UsageWidget';
import { TrashModal } from '../components/TrashModal';

export function Dashboard() {
  const queryClient = useQueryClient();
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    }
  });

  const createProject = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post('/projects', { name });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setNewProjectName('');
      setIsCreating(false);
    }
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Workspaces</h1>
          <p className="text-text-secondary text-sm mt-1">Manage your data engineering projects.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTrash(true)}
            className="glass-button px-4 py-2 rounded-md flex items-center gap-2 text-sm"
          >
            <Trash2 size={16} />
            Trash
          </button>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="accent-button px-4 py-2 rounded-md flex items-center gap-2 text-sm"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      </div>

      <UsageWidget />

      {showTrash && (
        <TrashModal
          title="Trashed Projects"
          trashQueryKey={['projects', 'trash']}
          trashUrl="/projects/trash"
          restoreUrl={(id) => `/projects/${id}/restore`}
          invalidateQueryKeys={[['projects']]}
          onClose={() => setShowTrash(false)}
        />
      )}

      {isCreating && (
        <div className="mb-8 glass-panel p-5 rounded-xl border border-border-strong flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="e.g. Customer ETL Pipeline"
            className="flex-1 px-4 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newProjectName.trim()) createProject.mutate(newProjectName);
              if (e.key === 'Escape') setIsCreating(false);
            }}
          />
          <button 
            onClick={() => { if(newProjectName.trim()) createProject.mutate(newProjectName) }}
            disabled={createProject.isPending}
            className="glass-button px-4 py-2 rounded-md text-sm"
          >
            Create
          </button>
          <button onClick={() => setIsCreating(false)} className="text-text-tertiary hover:text-text-primary text-sm px-2">Cancel</button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-surface-2 rounded-xl animate-pulse border border-border-subtle"></div>
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border-strong rounded-xl bg-surface-1/50">
          <div className="w-12 h-12 bg-surface-2 rounded-full flex items-center justify-center mb-4 border border-border-subtle">
            <Folder className="text-text-tertiary" size={24} />
          </div>
          <h3 className="text-lg font-medium text-text-primary">No projects found</h3>
          <p className="text-text-secondary text-sm mt-1 max-w-sm text-center mb-6">Get started by creating a new workspace to organize your pipelines and data connections.</p>
          <button onClick={() => setIsCreating(true)} className="accent-button px-4 py-2 rounded-md flex items-center gap-2 text-sm">
            <Plus size={16} /> Create Workspace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map(project => (
            <Link 
              key={project.id} 
              to={`/projects/${project.id}`}
              className="group bg-surface-1 hover:bg-surface-2 border border-border-subtle hover:border-border-strong rounded-xl p-5 transition-all duration-200 flex flex-col justify-between h-36"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-surface-3 flex items-center justify-center border border-border-subtle group-hover:bg-accent-500/20 group-hover:border-accent-500/30 transition-colors">
                    <Folder size={16} className="text-text-secondary group-hover:text-accent-400" />
                  </div>
                  <h3 className="text-base font-medium text-text-primary truncate">{project.name}</h3>
                </div>
                
                {/* Delete button (prevent link navigation) */}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    if (window.confirm('Delete this project forever?')) {
                      deleteProject.mutate(project.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-text-tertiary hover:text-status-error hover:bg-status-error/10 rounded transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="text-xs-mono text-text-tertiary flex items-center justify-between">
                <span>{project.id.slice(0, 8)}</span>
                <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
