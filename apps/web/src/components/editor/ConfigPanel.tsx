import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings2, Trash2, Upload, X } from 'lucide-react';
import { Database } from 'lucide-react';
import { api } from '../../lib/api';

interface Connection {
  id: string;
  name: string;
  type: 'postgres' | 'mysql' | 's3' | 'api';
}

export function ConfigPanel({ selectedNode, setNodes, setEdges, projectId, onBeforeDelete }: { selectedNode: any, setNodes: any, setEdges: any, projectId: string, onBeforeDelete?: () => void }) {
  const [config, setConfig] = useState<any>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (selectedNode) {
      setConfig(selectedNode.data.config || {});
    }
  }, [selectedNode]);

  const isConnectorNode = ['postgres-input', 'mysql-input', 's3-input', 'api-input'].includes(selectedNode?.data?.nodeType);
  const { data: connections } = useQuery<Connection[]>({
    queryKey: ['connections', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/connections`)).data,
    enabled: isConnectorNode,
  });

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
      const res = await api.post(`/projects/${projectId}/files/upload`, formData);
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
          onClick={() => { onBeforeDelete?.(); setNodes((nds: any[]) => nds.filter((n) => n.id !== selectedNode.id)); setEdges((eds: any[]) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)); }}
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
                        <input id="file-upload" name="file-upload" onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} type="file" className="sr-only" accept=".csv,.tsv,.txt" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    </div>
                    <p className="text-xs leading-5 text-text-tertiary">CSV/TSV up to 50MB</p>
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
              <div className="mt-4">
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Delimiter</label>
                <select
                  value={config.delimiter || ','}
                  onChange={(e) => updateConfig({ delimiter: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value=",">Comma (,) — CSV</option>
                  <option value={'\t'}>Tab — TSV</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="|">Pipe (|)</option>
                </select>
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

          {/* BRANCH */}
          {selectedNode.data.nodeType === 'branch' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Condition Expression</label>
              <input
                type="text"
                value={config.condition || ''}
                onChange={(e) => updateConfig({ condition: e.target.value })}
                className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                placeholder="row.age > 18"
              />
              <p className="text-xs text-text-tertiary mt-2">Every row is kept — matching rows go out the <span className="text-status-success">true</span> connection, everything else goes out the <span className="text-status-error">false</span> connection. Connect each one to a different downstream node.</p>
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

          {/* EXCEL INPUT */}
          {selectedNode.data.nodeType === 'excel-input' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Excel Data Source</label>

              {!config.filePath ? (
                <div className="mt-2 flex justify-center rounded-lg border border-dashed border-border-strong px-6 py-6 hover:border-accent-500/50 transition-colors bg-surface-2 relative">
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-text-tertiary" aria-hidden="true" />
                    <div className="mt-4 flex text-sm leading-6 text-text-secondary justify-center">
                      <label htmlFor="excel-file-upload" className="relative cursor-pointer rounded-md font-semibold text-accent-500 focus-within:outline-none hover:text-accent-400">
                        <span>{uploading ? 'Uploading...' : 'Upload a file'}</span>
                        <input id="excel-file-upload" name="excel-file-upload" onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} type="file" className="sr-only" accept=".xlsx" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    </div>
                    <p className="text-xs leading-5 text-text-tertiary">Excel (.xlsx) up to 50MB</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-surface-2 border border-border-strong rounded-md p-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-blue-500/10 rounded">
                      <Database size={16} className="text-blue-500" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-medium text-text-primary truncate">{config.originalName || 'data.xlsx'}</div>
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
                  placeholder="/uploads/my-file.xlsx"
                />
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Sheet Name <span className="normal-case text-text-tertiary">(optional, defaults to the first sheet)</span></label>
                <input
                  type="text"
                  value={config.sheetName || ''}
                  onChange={(e) => updateConfig({ sheetName: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                  placeholder="e.g. Sheet1"
                />
              </div>
            </div>
          )}

          {/* POSTGRES INPUT */}
          {selectedNode.data.nodeType === 'postgres-input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Connection</label>
                <select
                  value={config.connectionId || ''}
                  onChange={(e) => updateConfig({ connectionId: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="" disabled>Select a Postgres connection...</option>
                  {connections?.filter(c => c.type === 'postgres').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {connections && connections.filter(c => c.type === 'postgres').length === 0 && (
                  <p className="text-xs text-status-warning mt-2">No Postgres connections yet — add one on the Connections page.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">SQL Query</label>
                <textarea
                  value={config.query || ''}
                  onChange={(e) => updateConfig({ query: e.target.value })}
                  rows={4}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                  placeholder="SELECT * FROM users"
                />
              </div>
            </div>
          )}

          {/* MYSQL INPUT */}
          {selectedNode.data.nodeType === 'mysql-input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Connection</label>
                <select
                  value={config.connectionId || ''}
                  onChange={(e) => updateConfig({ connectionId: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="" disabled>Select a MySQL connection...</option>
                  {connections?.filter(c => c.type === 'mysql').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {connections && connections.filter(c => c.type === 'mysql').length === 0 && (
                  <p className="text-xs text-status-warning mt-2">No MySQL connections yet — add one on the Connections page.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">SQL Query</label>
                <textarea
                  value={config.query || ''}
                  onChange={(e) => updateConfig({ query: e.target.value })}
                  rows={4}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                  placeholder="SELECT * FROM users"
                />
              </div>
            </div>
          )}

          {/* S3 INPUT */}
          {selectedNode.data.nodeType === 's3-input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Connection</label>
                <select
                  value={config.connectionId || ''}
                  onChange={(e) => updateConfig({ connectionId: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="" disabled>Select an S3 connection...</option>
                  {connections?.filter(c => c.type === 's3').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {connections && connections.filter(c => c.type === 's3').length === 0 && (
                  <p className="text-xs text-status-warning mt-2">No S3 connections yet — add one on the Connections page.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Object Key</label>
                <input
                  type="text"
                  value={config.key || ''}
                  onChange={(e) => updateConfig({ key: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                  placeholder="path/to/file.csv"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Format</label>
                <select
                  value={config.format || 'csv'}
                  onChange={(e) => updateConfig({ format: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>
          )}

          {/* API INPUT */}
          {selectedNode.data.nodeType === 'api-input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Connection</label>
                <select
                  value={config.connectionId || ''}
                  onChange={(e) => updateConfig({ connectionId: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="" disabled>Select an API connection...</option>
                  {connections?.filter(c => c.type === 'api').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {connections && connections.filter(c => c.type === 'api').length === 0 && (
                  <p className="text-xs text-status-warning mt-2">No API connections yet — add one on the Connections page.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Path <span className="normal-case text-text-tertiary">(appended to the connection's base URL)</span></label>
                <input
                  type="text"
                  value={config.path || ''}
                  onChange={(e) => updateConfig({ path: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                  placeholder="/v1/users"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Data Path <span className="normal-case text-text-tertiary">(optional; dot-path to the row array in the response)</span></label>
                <input
                  type="text"
                  value={config.dataPath || ''}
                  onChange={(e) => updateConfig({ dataPath: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                  placeholder="data.items"
                />
              </div>
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

          {/* SORT DATA */}
          {selectedNode.data.nodeType === 'sort' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Sort By Column</label>
                <input
                  type="text"
                  value={config.sortBy || ''}
                  onChange={(e) => updateConfig({ sortBy: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                  placeholder="e.g. age"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Order</label>
                <select
                  value={config.order || 'asc'}
                  onChange={(e) => updateConfig({ order: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="asc">Ascending (A-Z, 0-9)</option>
                  <option value="desc">Descending (Z-A, 9-0)</option>
                </select>
              </div>
            </div>
          )}

          {/* DEDUPLICATE */}
          {selectedNode.data.nodeType === 'deduplicate' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Target Columns</label>
              <input
                type="text"
                value={config.columns || ''}
                onChange={(e) => updateConfig({ columns: e.target.value })}
                className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                placeholder="email, username"
              />
              <p className="text-xs text-text-tertiary mt-2">Comma separated list. Rows with duplicate values across these columns will be removed (keeps the first occurrence).</p>
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
                  <option value="min">Min</option>
                  <option value="max">Max</option>
                  <option value="count-distinct">Count Distinct</option>
                </select>
              </div>

              {config.operation !== 'count' && (
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
                      {config.operation.replace('-', '_')}_{config.targetColumn || 'target'}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-text-tertiary mt-2">
                  * A <code className="text-[10px] bg-surface-3 px-1 rounded">count</code> column is always generated automatically so you can use it in downstream filters (like SQL HAVING).
                </p>
              </div>
            </div>
          )}

          {/* FILL NULLS */}
          {selectedNode.data.nodeType === 'fill-nulls' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Column</label>
                <input
                  type="text"
                  value={config.column || ''}
                  onChange={(e) => updateConfig({ column: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                  placeholder="e.g. country"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Fill Value</label>
                <input
                  type="text"
                  value={config.value || ''}
                  onChange={(e) => updateConfig({ value: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                  placeholder="e.g. UNKNOWN"
                />
                <p className="text-xs text-text-tertiary mt-2">Rows where this column is missing/empty get this value instead.</p>
              </div>
            </div>
          )}

          {/* CAST TYPE */}
          {selectedNode.data.nodeType === 'cast-type' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Column</label>
                <input
                  type="text"
                  value={config.column || ''}
                  onChange={(e) => updateConfig({ column: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                  placeholder="e.g. age"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Target Type</label>
                <select
                  value={config.targetType || 'string'}
                  onChange={(e) => updateConfig({ targetType: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>
            </div>
          )}

          {/* JOIN */}
          {selectedNode.data.nodeType === 'join' && (
            <div className="space-y-4">
              <div className="p-3 bg-accent-500/10 border border-accent-500/20 rounded-lg text-xs text-text-secondary">
                Connect exactly two inputs to this node — the first edge you draw is the <strong>left</strong> dataset, the second is the <strong>right</strong> dataset.
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Left Key</label>
                <input
                  type="text"
                  value={config.leftKey || ''}
                  onChange={(e) => updateConfig({ leftKey: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                  placeholder="e.g. id"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Right Key <span className="normal-case text-text-tertiary">(optional, defaults to Left Key)</span></label>
                <input
                  type="text"
                  value={config.rightKey || ''}
                  onChange={(e) => updateConfig({ rightKey: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                  placeholder="e.g. user_id"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Join Type</label>
                <select
                  value={config.joinType || 'inner'}
                  onChange={(e) => updateConfig({ joinType: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="inner">Inner (only matching rows)</option>
                  <option value="left">Left (keep all left rows)</option>
                </select>
              </div>
            </div>
          )}

          {/* UNION */}
          {selectedNode.data.nodeType === 'union' && (
            <div className="p-3 bg-accent-500/10 border border-accent-500/20 rounded-lg text-xs text-text-secondary">
              Connect two or more inputs to this node — their rows are concatenated together (same-shaped datasets in, one combined dataset out). No configuration needed.
            </div>
          )}

          {/* WINDOW */}
          {selectedNode.data.nodeType === 'window' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Partition By <span className="normal-case text-text-tertiary">(optional)</span></label>
                <input
                  type="text"
                  value={config.partitionBy || ''}
                  onChange={(e) => updateConfig({ partitionBy: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                  placeholder="e.g. country"
                />
                <p className="text-xs text-text-tertiary mt-2">Comma separated columns. Ranking restarts within each group; leave blank to rank across all rows.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Order By Column</label>
                <input
                  type="text"
                  value={config.orderBy || ''}
                  onChange={(e) => updateConfig({ orderBy: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                  placeholder="e.g. age"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Order</label>
                <select
                  value={config.order || 'asc'}
                  onChange={(e) => updateConfig({ order: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="asc">Ascending (A-Z, 0-9)</option>
                  <option value="desc">Descending (Z-A, 9-0)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Rank Type</label>
                <select
                  value={config.rankType || 'row_number'}
                  onChange={(e) => updateConfig({ rankType: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md text-sm text-text-primary focus:border-accent-500"
                >
                  <option value="row_number">Row Number (always unique)</option>
                  <option value="rank">Rank (ties share a rank, gaps after)</option>
                  <option value="dense_rank">Dense Rank (ties share a rank, no gaps)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Output Column <span className="normal-case text-text-tertiary">(optional)</span></label>
                <input
                  type="text"
                  value={config.outputColumn || ''}
                  onChange={(e) => updateConfig({ outputColumn: e.target.value })}
                  className="block w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-md font-mono text-sm text-text-primary focus:border-accent-500"
                  placeholder="rank"
                />
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
