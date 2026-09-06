import { Handle, Position } from '@xyflow/react';
import { useDirection } from './DirectionContext';
import { Database, Filter, Settings, FileOutput, Calculator } from 'lucide-react';

const icons: Record<string, any> = {
  'csv-input': Database,
  'json-input': Database,
  'filter': Filter,
  'select-columns': Settings,
  'csv-output': FileOutput,
  'aggregate': Calculator
};

const getCategoryColor = (type: string) => {
  if (type.includes('input')) return 'bg-blue-500';
  if (type.includes('output')) return 'bg-green-500';
  if (type.includes('aggregate')) return 'bg-purple-500';
  return 'bg-amber-500'; // Transform
};

export function CustomNode({ data, selected }: any) {
  const direction = useDirection();
  const isHorizontal = direction === 'LR';
  const Icon = icons[data.nodeType] || Settings;
  
  return (
    <div className={`relative px-4 py-3 min-w-[180px] rounded-xl bg-surface-2/90 backdrop-blur-md border ${selected ? 'border-accent-500 shadow-[0_0_15px_var(--color-accent-glow)]' : 'border-border-strong'} transition-all duration-200`}>
      {/* Input handle */}
      {!data.nodeType.includes('input') && (
        <Handle 
          type="target" 
          position={isHorizontal ? Position.Left : Position.Top} 
          className="!w-3 !h-3 !bg-surface-3 !border-2 !border-border-strong hover:!border-accent-500 transition-colors" 
        />
      )}
      
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getCategoryColor(data.nodeType)}/20 border border-${getCategoryColor(data.nodeType).replace('bg-', '')}/30`}>
          <Icon size={16} className={`text-${getCategoryColor(data.nodeType).replace('bg-', '')}`} />
        </div>
        <div>
          <div className="text-sm font-medium text-text-primary">{data.label}</div>
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider mt-0.5">{data.nodeType.split('-')[0]}</div>
        </div>
      </div>

      {/* Output handle */}
      {!data.nodeType.includes('output') && (
        <Handle 
          type="source" 
          position={isHorizontal ? Position.Right : Position.Bottom} 
          className="!w-3 !h-3 !bg-surface-3 !border-2 !border-border-strong hover:!border-accent-500 transition-colors" 
        />
      )}
    </div>
  );
}
