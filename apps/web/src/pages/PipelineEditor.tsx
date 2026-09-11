import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  useNodesState, 
  useEdgesState, 
  addEdge,
  ReactFlowProvider
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../lib/api';
import { ArrowLeft, Save, Play, Check, ShieldCheck, AlertTriangle, Clock, Calendar, Bell, Webhook as WebhookIcon, Undo2, Redo2 } from 'lucide-react';

import { CustomNode } from '../components/editor/CustomNode';
import { NodePalette } from '../components/editor/NodePalette';
import { ConfigPanel } from '../components/editor/ConfigPanel';
import { ExecutionDrawer } from '../components/editor/ExecutionDrawer';
import { HistoryModal } from '../components/editor/HistoryModal';
import { ScheduleModal } from '../components/editor/ScheduleModal';
import { NotificationsModal } from '../components/editor/NotificationsModal';
import { WebhookModal } from '../components/editor/WebhookModal';
import { DirectionContext } from '../components/editor/DirectionContext';
import { ValidationContext, type NodeValidationState } from '../components/editor/ValidationContext';
import { LayoutList, LayoutPanelLeft } from 'lucide-react';
import { getLayoutedElements } from '../components/editor/layout';
import { useHistory } from '../components/editor/useHistory';

const nodeTypes = {
  dataNode: CustomNode,
};

function EditorCanvas() {
  const { projectId, pipelineId } = useParams<{ projectId: string, pipelineId: string }>();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationResult, setValidationResult] = useState<{isValid: boolean, errors: string[], warnings: string[]} | null>(null);
  // Separate from validationResult (which auto-clears after 5s for the toast
  // list) — node badges stay put until the pipeline is next validated, so
  // "which node is broken" doesn't vanish along with the toast.
  const [nodeValidation, setNodeValidation] = useState<NodeValidationState>({ nodeErrors: {}, nodeWarnings: {} });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isWebhookOpen, setIsWebhookOpen] = useState(false);
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
  const { pushHistory, undo, redo, resetHistory, canUndo, canRedo } = useHistory(nodes, edges, setNodes, setEdges);

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['pipeline', pipelineId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/pipelines/${pipelineId}`);
      return res.data;
    },
    enabled: !!pipelineId
  });

  useEffect(() => {
    if (pipeline) {
      setNodes(pipeline.nodes || []);
      setEdges(pipeline.edges || []);
      resetHistory();
      setNodeValidation({ nodeErrors: {}, nodeWarnings: {} });
    }
  }, [pipeline, setNodes, setEdges, resetHistory]);

  const onConnect = useCallback((params: Connection | Edge) => {
    pushHistory();
    setEdges((eds) => addEdge({ ...params, animated: true } as any, eds));
  }, [setEdges, pushHistory]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const typeStr = event.dataTransfer.getData('application/reactflow');
      if (!typeStr) return;
      
      const parsedData = JSON.parse(typeStr);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${parsedData.type}-${Date.now()}`,
        type: 'dataNode',
        position,
        data: { 
          label: parsedData.label,
          nodeType: parsedData.type,
          config: {} 
        },
      };

      pushHistory();
      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes, pushHistory]
  );

  // React Flow calls these for the keyboard-driven delete path (Delete/
  // Backspace with a node or edge selected) — the config panel's own trash
  // button goes through a separate direct setNodes/setEdges call and pushes
  // its own history entry (see ConfigPanel's onDelete prop below).
  const onNodesDelete = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const onEdgesDelete = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const onNodeDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't hijack Ctrl+Z/Y inside a text input/textarea — let native
      // text-field undo work there instead of undoing the whole canvas.
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTyping) return;

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        setSelectedNode(null);
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
        setSelectedNode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Auto-heal: remove any ghost edges before saving
      const validEdges = edges.filter(e => 
        nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target)
      );
      
      await api.put(`/projects/${projectId}/pipelines/${pipelineId}`, {
        nodes,
        edges: validEdges
      });
    },
    onSuccess: () => {
      setLastSaved(new Date());
    }
  });

  const handleSave = async () => {
    setIsSaving(true);
    await saveMutation.mutateAsync();
    setIsSaving(false);
  };

  const handleRun = async () => {
    await handleSave();
    // Open drawer first so WebSocket can connect
    setIsDrawerOpen(true);
    
    // Give the socket 500ms to establish connection and join the room
    // before triggering the backend execution, otherwise we miss fast events
    setTimeout(async () => {
      try {
        await api.post(`/projects/${projectId}/pipelines/${pipelineId}/run`);
      } catch (e: any) {
        alert(e.response?.data?.error || "Failed to start execution");
      }
    }, 500);
  };

    const handleLayoutToggle = () => {
    const newDirection = direction === 'TB' ? 'LR' : 'TB';
    setDirection(newDirection);

    // Auto layout with new direction
    pushHistory();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, newDirection);
    setNodes(layoutedNodes as any);
    setEdges(layoutedEdges as any);
  };

  const handleValidate = async () => {
    await handleSave(); // Save first before validate
    const res = await api.get(`/projects/${projectId}/pipelines/${pipelineId}/validate`);
    setValidationResult(res.data);
    setNodeValidation({ nodeErrors: res.data.nodeErrors || {}, nodeWarnings: res.data.nodeWarnings || {} });

    // Auto-clear the toast list after 5s — node badges (nodeValidation)
    // stay until the next validate call.
    setTimeout(() => setValidationResult(null), 5000);
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-background text-text-secondary">Loading editor...</div>;

  return ( 
    <DirectionContext.Provider value={direction}>
    <ValidationContext.Provider value={nodeValidation}>
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden text-text-primary">
      {/* Top Header */}
      <header className="h-14 bg-surface-1 border-b border-border-strong flex items-center justify-between px-4 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${projectId}`} className="text-text-tertiary hover:text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex flex-col">
            <span className="text-xs text-text-tertiary">Pipeline</span>
            <span className="text-sm font-semibold">{pipeline?.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {lastSaved && <span className="text-xs text-text-tertiary flex items-center gap-1"><Check size={12} /> Saved</span>}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { undo(); setSelectedNode(null); }}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="glass-button p-1.5 rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={() => { redo(); setSelectedNode(null); }}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="glass-button p-1.5 rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Redo2 size={14} />
            </button>
          </div>
                    <button onClick={handleLayoutToggle} className="glass-button px-3 py-1.5 rounded flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
            {direction === 'TB' ? <LayoutPanelLeft size={14} /> : <LayoutList size={14} />}
            {direction === 'TB' ? 'Horizontal' : 'Vertical'}
          </button>
          <button onClick={() => setIsHistoryOpen(true)} className="glass-button px-3 py-1.5 rounded flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
            <Clock size={14} /> History
          </button>
          <button
            onClick={() => setIsScheduleOpen(true)}
            className={`glass-button px-3 py-1.5 rounded flex items-center gap-2 text-sm hover:text-text-primary ${pipeline?.schedule?.enabled ? 'text-accent-500' : 'text-text-secondary'}`}
          >
            <Calendar size={14} /> {pipeline?.schedule?.enabled ? 'Scheduled' : 'Schedule'}
          </button>
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="glass-button px-3 py-1.5 rounded flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <Bell size={14} /> Notifications
          </button>
          <button
            onClick={() => setIsWebhookOpen(true)}
            className={`glass-button px-3 py-1.5 rounded flex items-center gap-2 text-sm hover:text-text-primary ${pipeline?.webhook?.configured ? 'text-accent-500' : 'text-text-secondary'}`}
          >
            <WebhookIcon size={14} /> Webhook
          </button>
          <button onClick={handleValidate} className="glass-button px-3 py-1.5 rounded flex items-center gap-2 text-sm text-status-warning hover:text-status-warning">
            <ShieldCheck size={14} /> Validate
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="glass-button px-3 py-1.5 rounded flex items-center gap-2 text-sm"
          >
            <Save size={14} /> {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={handleRun} className="accent-button px-3 py-1.5 rounded flex items-center gap-2 text-sm">
            <Play size={14} /> Run
          </button>
        </div>
      </header>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <NodePalette />
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          
          {/* Validation Toasts Overlay */}
          {validationResult && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-md w-full">
              {validationResult.isValid ? (
                <div className="bg-status-success/20 border border-status-success/50 text-status-success p-3 rounded-lg flex items-center gap-2 backdrop-blur-md shadow-lg">
                  <Check size={18} />
                  <span className="text-sm font-medium">Pipeline is valid and ready to run!</span>
                </div>
              ) : (
                validationResult.errors.map((err, idx) => (
                  <div key={idx} className="bg-status-error/20 border border-status-error/50 text-status-error p-3 rounded-lg flex items-start gap-2 backdrop-blur-md shadow-lg">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{err}</span>
                  </div>
                ))
              )}
              {validationResult.warnings.map((warn, idx) => (
                <div key={`w-${idx}`} className="bg-status-warning/20 border border-status-warning/50 text-status-warning p-3 rounded-lg flex items-start gap-2 backdrop-blur-md shadow-lg">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span className="text-sm font-medium">{warn}</span>
                </div>
              ))}
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onNodeDragStart={onNodeDragStart}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onSelectionChange={(params) => setSelectedNode(params.nodes[0] || null)}
            nodeTypes={nodeTypes}
            fitView
            className="canvas-bg"
            colorMode="dark"
          >
            <Background gap={24} color="rgba(255,255,255,0.04)" />
            <Controls className="!bg-surface-2 !border-border-strong !fill-text-primary" />
            <MiniMap 
              className="!bg-surface-1 !border-border-strong"
              nodeColor="#27272a"
              maskColor="rgba(0,0,0,0.5)"
            />
          </ReactFlow>
        </div>
        <ConfigPanel selectedNode={selectedNode} setNodes={setNodes} setEdges={setEdges} projectId={projectId!} onBeforeDelete={pushHistory} />
        {isDrawerOpen && <ExecutionDrawer pipelineId={pipelineId!} onClose={() => setIsDrawerOpen(false)} />}
        {isHistoryOpen && <HistoryModal onClose={() => setIsHistoryOpen(false)} />}
        {isScheduleOpen && (
          <ScheduleModal
            projectId={projectId!}
            pipelineId={pipelineId!}
            schedule={pipeline?.schedule || { cronExpression: null, timezone: null, enabled: false }}
            onClose={() => setIsScheduleOpen(false)}
          />
        )}
        {isNotificationsOpen && (
          <NotificationsModal
            projectId={projectId!}
            pipelineId={pipelineId!}
            notifications={pipeline?.notifications || { onFailure: true, onComplete: false }}
            onClose={() => setIsNotificationsOpen(false)}
          />
        )}
        {isWebhookOpen && (
          <WebhookModal
            projectId={projectId!}
            pipelineId={pipelineId!}
            onClose={() => setIsWebhookOpen(false)}
          />
        )}
      </div>
    </div>
    </ValidationContext.Provider>
    </DirectionContext.Provider>

  );
}

export function PipelineEditor() {
  return ( 
    <ReactFlowProvider>
      <EditorCanvas />
    </ReactFlowProvider>
  );
}
