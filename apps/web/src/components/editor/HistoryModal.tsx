import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { X, Clock, CheckCircle, AlertTriangle, Download } from 'lucide-react';
import { useParams } from 'react-router-dom';

export function HistoryModal({ onClose }: { onClose: () => void }) {
  const { projectId, pipelineId } = useParams<{ projectId: string, pipelineId: string }>();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const { data: runs, isLoading } = useQuery({
    queryKey: ['executions', pipelineId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/pipelines/${pipelineId}/executions`);
      return res.data;
    }
  });

  const { data: runDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['execution', selectedRun],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/pipelines/${pipelineId}/executions/${selectedRun}`);
      return res.data;
    },
    enabled: !!selectedRun
  });

  const renderStatus = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <span className="flex items-center gap-1.5 text-status-success"><CheckCircle size={14} /> Completed</span>;
      case 'FAILED': return <span className="flex items-center gap-1.5 text-status-error"><AlertTriangle size={14} /> Failed</span>;
      case 'RUNNING': return <span className="flex items-center gap-1.5 text-accent-500 animate-pulse"><div className="w-2 h-2 rounded-full bg-accent-500"></div> Running</span>;
      default: return <span className="text-text-tertiary">{status}</span>;
    }
  };

  const getFinalOutput = (results: any) => {
    if (!results) return null;
    // Get the last node's output, usually a csv-output or the final node executed
    const keys = Object.keys(results);
    if (keys.length === 0) return [];
    
    // Find output node if exists
    const outputKey = keys.find(k => k.includes('output')) || keys[keys.length - 1];
    return results[outputKey] || [];
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface-1 border border-border-strong rounded-xl w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="h-14 border-b border-border-strong flex items-center justify-between px-6 shrink-0 bg-surface-2">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Clock size={18} className="text-text-secondary" />
            Execution History
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar: List of runs */}
          <div className="w-1/3 border-r border-border-strong flex flex-col bg-background">
            <div className="p-4 border-b border-border-subtle bg-surface-1">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">Past Runs</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-sm text-text-tertiary">Loading runs...</div>
              ) : runs?.length === 0 ? (
                <div className="p-4 text-sm text-text-tertiary">No executions yet.</div>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {runs?.map((run: any) => (
                    <li 
                      key={run._id}
                      onClick={() => setSelectedRun(run._id)}
                      className={`p-4 hover:bg-surface-2 cursor-pointer transition-colors ${selectedRun === run._id ? 'bg-surface-2 border-l-2 border-accent-500' : 'border-l-2 border-transparent'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-text-primary">
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                        {renderStatus(run.status)}
                      </div>
                      <div className="flex items-center justify-between text-xs text-text-tertiary">
                        <span>ID: {run._id.slice(-6)}</span>
                        {run.completedAt && run.startedAt && (
                          <span>{new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()}ms</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Area: Run Details & Data Table */}
          <div className="flex-1 flex flex-col bg-surface-1">
            {!selectedRun ? (
              <div className="flex-1 flex items-center justify-center text-text-tertiary">
                Select a run to view results
              </div>
            ) : isLoadingDetail ? (
              <div className="p-6 text-text-secondary">Loading details...</div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-border-strong bg-surface-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-text-primary">Run {runDetail._id.slice(-6)}</h3>
                    {renderStatus(runDetail.status)}
                  </div>
                  
                  {runDetail.error && (
                    <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-sm mb-4">
                      <strong>Error:</strong> {runDetail.error}
                    </div>
                  )}
                </div>

                {runDetail.status === 'COMPLETED' && runDetail.results && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-background shrink-0">
                      <h4 className="text-sm font-semibold text-text-primary">Final Output Data</h4>
                      <button 
                        onClick={() => {
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getFinalOutput(runDetail.results), null, 2));
                          const dlAnchorElem = document.createElement('a');
                          dlAnchorElem.setAttribute("href", dataStr);
                          dlAnchorElem.setAttribute("download", `pipeforge_export_${runDetail._id.slice(-6)}.json`);
                          dlAnchorElem.click();
                        }}
                        className="text-xs flex items-center gap-1.5 text-accent-500 hover:text-accent-400 bg-accent-500/10 px-3 py-1.5 rounded"
                      >
                        <Download size={14} /> Export JSON
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-4 bg-background">
                      {(() => {
                        const data = getFinalOutput(runDetail.results);
                        if (!data || data.length === 0) return <div className="text-text-tertiary text-sm">No data generated.</div>;
                        
                        const columns = Object.keys(data[0]);
                        return (
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-surface-2 text-text-secondary sticky top-0 z-10 shadow-sm">
                              <tr>
                                {columns.map((col, i) => (
                                  <th key={i} className="px-4 py-2 font-medium border-b border-border-strong">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle text-text-primary">
                              {data.map((row: any, i: number) => (
                                <tr key={i} className="hover:bg-surface-1/50 transition-colors">
                                  {columns.map((col, j) => (
                                    <td key={j} className="px-4 py-2 font-mono text-xs text-text-secondary">
                                      {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
