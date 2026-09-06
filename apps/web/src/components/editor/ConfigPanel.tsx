import { useState, useEffect } from 'react';
import { Settings2, Trash2, Upload, X } from 'lucide-react';
import { Database } from 'lucide-react';
import { api } from '../../lib/api';

export function ConfigPanel({ selectedNode, setNodes, setEdges }: { selectedNode: any, setNodes: any, setEdges: any }) {
  const [config, setConfig] = useState<any>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (selectedNode) {
      setConfig(selectedNode.data.config || {});
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return null;
  }

  const updateConfig = (updates: Record<string, string>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setNodes((nds: any[]) =>
      nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, config: newConfig } } : n))
    );
  };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File upload triggered!');
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    console.log('File selected:', file.name, file.size);

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Sending to API...');
      const res = await api.post('/files/upload', formData);
      console.log('Upload success!', res.data);
      updateConfig({ filePath: res.data.filePath, originalName: res.data.originalName });
    } catch (err: any) {
      console.error('Upload failed!', err);
      alert('Failed to upload file: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside className="w-80 bg-surface-1/95 backdrop-blur border-l border-border-strong flex flex-col h-full z-10 shadow-2xl absolute right-0 top-0">
      <div className="h-14 px-4 border-b border-border-strong flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-text-primary font-medium text-sm">
          <Settings2 size={16} className="text-accent-500" />
          {selectedNode.data.label}
        </div>
        <button
          onClick={() => { setNodes((nds: any[]) => nds.filter((n) => n.id !== selectedNode.id)); setEdges((eds: any[]) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)); }}
          className="text-text-tertiary hover:text-status-error transition-colors"
          title="Delete Node"
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-5">
          {selectedNode.data.nodeType === 'csv-input' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">CSV Data Source</label>
              
              {!config.filePath || config.filePath === 'mock' ? (
                <div className="mt-2 flex justify-center rounded-lg border border-dashed border-border-strong px-6 py-6 hover:border-accent-500/50 transition-colors bg-surface-2 relative">
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-text-tertiary" aria-hidden="true" />
                    <div className="mt-4 flex text-sm leading-6 text-text-secondary justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-accent-500 focus-within:outline-none hover:text-accent-400">
                        <span>{uploading ? 'Uploading...' : 'Upload a file'}</span>
                        <input id="file-upload" name="file-upload" onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} type="file" className="sr-only" accept=".csv" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    </div>
                    <p className="text-xs leading-5 text-text-tertiary">CSV up to 50MB</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-surface-2 border border-border-strong rounded-md p-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-blue-500/10 rounded">
                      <Database size={16} className="text-blue-500" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-medium text-text-primary truncate">{config.originalName || 'data.csv'}</div>
                      <div className="text-xs text-text-tertiary truncate">{config.filePath}</div>
                    </div>
                  </div>
                  <button onClick={() => { updateConfig({ filePath: '', originalName: '' }); }} className="text-text-tertiary hover:text-status-error p-1">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="mt-4">
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Or Manual Path</label>
                <input
                  type="text"
                  value={config.filePath || ''}
                  onChange={(e) => updateConfig({ filePath: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                  placeholder="/uploads/my-file.csv or 'mock'"
                />
              </div>
            </div>
          )}

          {selectedNode.data.nodeType === 'filter' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Condition Expression</label>
              <input
                type="text"
                value={config.condition || ''}
                onChange={(e) => updateConfig({ condition: e.target.value })}
                className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                placeholder="row.age > 18"
              />
              <p className="text-xs text-text-tertiary mt-2">Use valid JavaScript expression returning boolean. (Numbers are auto-cast!)</p>
            </div>
          )}
          
                    {/* JSON INPUT */}
          {selectedNode.data.nodeType === 'json-input' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">JSON Data Source</label>
              <input
                type="text"
                value={config.filePath || ''}
                onChange={(e) => updateConfig({ filePath: e.target.value })}
                className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                placeholder="/uploads/my-file.json"
              />
              <p className="text-xs text-text-tertiary mt-2">Enter file path of uploaded JSON</p>
            </div>
          )}

          {/* RENAME COLUMNS */}
          {selectedNode.data.nodeType === 'rename-columns' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Rename Mapping</label>
              <input
                type="text"
                value={config.mapping || ''}
                onChange={(e) => updateConfig({ mapping: e.target.value })}
                className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                placeholder="oldName:newName, age:years"
              />
              <p className="text-xs text-text-tertiary mt-2">Format: old:new, old2:new2</p>
            </div>
          )}

          {/* SELECT COLUMNS */}
          {selectedNode.data.nodeType === 'select-columns' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Columns to Keep</label>
              <input
                type="text"
                value={config.columns || ''}
                onChange={(e) => updateConfig({ columns: e.target.value })}
                className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                placeholder="name, age, country"
              />
              <p className="text-xs text-text-tertiary mt-2">Comma separated list of columns to preserve.</p>
            </div>
          )}

                    {/* AGGREGATE */}
          {selectedNode.data.nodeType === 'aggregate' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Group By Column</label>
                <input
                  type="text"
                  value={config.groupBy || ''}
                  onChange={(e) => updateConfig({ groupBy: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                  placeholder="e.g. country, active"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Aggregation Type</label>
                <select
                  value={config.operation || 'count'}
                  onChange={(e) => updateConfig({ operation: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="count">Count (rows)</option>
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                </select>
              </div>

              {(config.operation === 'sum' || config.operation === 'avg') && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Target Column</label>
                  <input
                    type="text"
                    value={config.targetColumn || ''}
                    onChange={(e) => updateConfig({ targetColumn: e.target.value })}
                    className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                    placeholder="e.g. revenue"
                  />
                </div>
              )}
              
              <div className="mt-4 p-3 bg-accent-500/10 border border-accent-500/20 rounded-lg">
                <p className="text-xs text-text-secondary font-medium mb-1">Generated Output Columns:</p>
                <div className="flex gap-2 flex-wrap">
                  {(!config.groupBy ? ['group_column'] : config.groupBy.split(',').map((s: string) => s.trim()).filter(Boolean)).map((col: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-surface-3 rounded text-xs font-mono text-text-primary">{col}</span>
                  ))}
                  <span className="px-2 py-0.5 bg-surface-3 rounded text-xs font-mono text-text-primary">count</span>
                  {config.operation && config.operation !== 'count' && (
                    <span className="px-2 py-0.5 bg-surface-3 rounded text-xs font-mono text-text-primary">
                      {config.operation}_{config.targetColumn || 'target'}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-text-tertiary mt-2">
                  * A <code className="text-[10px] bg-surface-3 px-1 rounded">count</code> column is always generated automatically so you can use it in downstream filters (like SQL HAVING).
                </p>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-border-subtle">
            <h4 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Internal Metadata</h4>
            <div className="bg-surface-2 p-3 rounded-md border border-border-subtle font-mono text-[11px] text-text-tertiary overflow-x-auto">
              <div>ID: {selectedNode.id}</div>
              <div>Type: {selectedNode.type}</div>
              <div>Pos: {Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
