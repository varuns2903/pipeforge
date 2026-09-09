import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Terminal, X, CheckCircle, Loader, AlertTriangle } from 'lucide-react';

interface LogEntry {
  timestamp: Date;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
}

export function ExecutionDrawer({ pipelineId, onClose }: { pipelineId: string, onClose: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'>('IDLE');

  useEffect(() => {
    // Determine API URL for Socket.io
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const url = apiUrl.replace('/api', ''); // Get base domain

    // The auth token is an httpOnly cookie now — withCredentials sends it
    // automatically on the handshake instead of passing it explicitly.
    const socket: Socket = io(url, {
      withCredentials: true
    });

    socket.on('connect', () => {
      setLogs(l => [...l, { timestamp: new Date(), type: 'INFO', message: 'Connected to execution monitor...' }]);
      socket.emit('subscribe_pipeline', pipelineId);
    });

    socket.on('execution_update', (data) => {
      if (data.type === 'STATUS') {
        setStatus(data.status);
        if (data.status === 'RUNNING') {
          setLogs(l => [...l, { timestamp: new Date(), type: 'INFO', message: 'Pipeline execution started.' }]);
        } else if (data.status === 'COMPLETED') {
          setLogs(l => [...l, { timestamp: new Date(), type: 'SUCCESS', message: 'Pipeline execution completed successfully.' }]);
        } else if (data.status === 'FAILED') {
          setLogs(l => [...l, { timestamp: new Date(), type: 'ERROR', message: `Pipeline execution failed: ${data.error}` }]);
        }
      } else if (data.type === 'NODE_START') {
        setLogs(l => [...l, { timestamp: new Date(), type: 'INFO', message: `Processing node: ${data.label} (${data.nodeType})...` }]);
      } else if (data.type === 'NODE_COMPLETE') {
        setLogs(l => [...l, { timestamp: new Date(), type: 'SUCCESS', message: `Node completed in ${data.duration}ms. Output: ${data.rowCount} rows.` }]);
      } else if (data.type === 'NODE_ERROR') {
        setLogs(l => [...l, { timestamp: new Date(), type: 'ERROR', message: `Node failed: ${data.error}` }]);
      }
    });

    socket.on('disconnect', () => {
      setLogs(l => [...l, { timestamp: new Date(), type: 'ERROR', message: 'Disconnected from monitor.' }]);
    });

    return () => {
      socket.disconnect();
    };
  }, [pipelineId]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-64 bg-surface-1 border-t border-border-strong flex flex-col shadow-2xl z-40 transform transition-transform">
      <div className="h-10 border-b border-border-subtle bg-surface-2 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-text-secondary" />
          <span className="text-xs font-semibold text-text-primary tracking-wide uppercase">Execution Logs</span>
          {status === 'RUNNING' && <Loader size={12} className="animate-spin text-accent-500 ml-2" />}
          {status === 'COMPLETED' && <CheckCircle size={12} className="text-status-success ml-2" />}
          {status === 'FAILED' && <AlertTriangle size={12} className="text-status-error ml-2" />}
        </div>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
          <X size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 bg-background font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className={`mb-1.5 flex gap-3 ${log.type === 'ERROR' ? 'text-status-error' : log.type === 'SUCCESS' ? 'text-status-success' : 'text-text-secondary'}`}>
            <span className="text-text-tertiary shrink-0">
              {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
