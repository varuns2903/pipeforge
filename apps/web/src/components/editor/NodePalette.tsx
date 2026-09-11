import { Database, Filter, Settings, FileOutput, Calculator, Type, ArrowDownAZ, CopyMinus, GitMerge, Eraser, Shuffle, Cloud, Globe, Combine, ListOrdered, FileJson, FileSpreadsheet, GitBranch } from 'lucide-react';

const NODE_TYPES = [
  { category: 'Input', items: [
    { type: 'csv-input', label: 'CSV Upload', icon: Database },
    { type: 'json-input', label: 'JSON Upload', icon: Database },
    { type: 'excel-input', label: 'Excel Upload', icon: FileSpreadsheet },
  ]},
  { category: 'Connectors', items: [
    { type: 'postgres-input', label: 'Postgres Query', icon: Database },
    { type: 'mysql-input', label: 'MySQL Query', icon: Database },
    { type: 's3-input', label: 'S3 File', icon: Cloud },
    { type: 'api-input', label: 'API Request', icon: Globe },
  ]},
  { category: 'Transform', items: [
    { type: 'filter', label: 'Filter Rows', icon: Filter },
    { type: 'branch', label: 'Branch (If/Else)', icon: GitBranch },
    { type: 'select-columns', label: 'Select Columns', icon: Settings },
    { type: 'rename-columns', label: 'Rename Columns', icon: Type },
    { type: 'sort', label: 'Sort Data', icon: ArrowDownAZ },
    { type: 'deduplicate', label: 'Remove Duplicates', icon: CopyMinus },
    { type: 'fill-nulls', label: 'Fill Nulls', icon: Eraser },
    { type: 'cast-type', label: 'Cast Column Type', icon: Shuffle },
    { type: 'join', label: 'Join Datasets', icon: GitMerge },
    { type: 'union', label: 'Union Datasets', icon: Combine },
  ]},
  { category: 'Aggregate', items: [
    { type: 'aggregate', label: 'Group & Aggregate', icon: Calculator },
    { type: 'window', label: 'Window / Rank', icon: ListOrdered },
  ]},
  { category: 'Output', items: [
    { type: 'csv-output', label: 'Export CSV', icon: FileOutput },
    { type: 'json-output', label: 'Export JSON', icon: FileJson },
  ]}
];

export function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-surface-1/90 backdrop-blur border-r border-border-strong flex flex-col h-full z-10">
      <div className="p-4 border-b border-border-subtle">
        <h3 className="text-sm font-semibold text-text-primary tracking-wide">Node Library</h3>
        <p className="text-xs text-text-tertiary mt-1">Drag and drop to canvas</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {NODE_TYPES.map(category => (
          <div key={category.category}>
            <h4 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              {category.category}
            </h4>
            <div className="space-y-2">
              {category.items.map(item => (
                <div
                  key={item.type}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-2 border border-border-subtle hover:border-accent-500/50 hover:bg-surface-3 cursor-grab active:cursor-grabbing transition-colors"
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type, item.label)}
                >
                  <item.icon size={16} className="text-text-secondary" />
                  <span className="text-sm text-text-primary">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
