import { Handle, Position } from '@xyflow/react';
import { useDirection } from './DirectionContext';
import { useNodeValidation } from './ValidationContext';
import { Database, Filter, Settings, FileOutput, Calculator, ArrowDownAZ, CopyMinus, GitMerge, Eraser, Shuffle, Cloud, Globe, GitBranch, FileSpreadsheet, AlertCircle, AlertTriangle, Radio } from 'lucide-react';

const icons: Record<string, any> = {
  'csv-input': Database,
  'json-input': Database,
  'postgres-input': Database,
  'mysql-input': Database,
  'excel-input': FileSpreadsheet,
  's3-input': Cloud,
  'api-input': Globe,
  'kafka-input': Radio,
  'filter': Filter,
  'branch': GitBranch,
  'select-columns': Settings,
  'rename-columns': Settings,
  'sort': ArrowDownAZ,
  'deduplicate': CopyMinus,
  'csv-output': FileOutput,
  'excel-output': FileSpreadsheet,
  'aggregate': Calculator,
  'join': GitMerge,
  'fill-nulls': Eraser,
  'cast-type': Shuffle
};

const getCategoryColor = (type: string) => {
  if (type.includes('input')) return 'bg-blue-500';
  if (type.includes('output')) return 'bg-green-500';
  if (type.includes('aggregate')) return 'bg-purple-500';
  return 'bg-amber-500'; // Transform
};

export function CustomNode({ id, data, selected }: any) {
  const direction = useDirection();
  const isHorizontal = direction === 'LR';
  const Icon = icons[data.nodeType] || Settings;
  const { errors, warnings } = useNodeValidation(id);
  const hasError = errors.length > 0;
  const hasWarning = !hasError && warnings.length > 0;

  const borderClass = hasError
    ? 'border-status-error shadow-[0_0_15px_rgba(239,68,68,0.35)]'
    : selected
      ? 'border-accent-500 shadow-[0_0_15px_var(--color-accent-glow)]'
      : 'border-border-strong';

  return (
    <div className={`relative px-4 py-3 min-w-[180px] rounded-xl bg-surface-2/90 backdrop-blur-md border ${borderClass} transition-all duration-200`}>
      {(hasError || hasWarning) && (
        <div
          className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center border-2 border-background ${hasError ? 'bg-status-error' : 'bg-status-warning'}`}
          title={[...errors, ...warnings].join('\n')}
        >
          {hasError ? <AlertCircle size={12} className="text-white" /> : <AlertTriangle size={11} className="text-white" />}
        </div>
      )}
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

      {/* Output handle(s) */}
      {data.nodeType === 'branch' ? (
        <>
          <Handle
            type="source"
            id="true"
            position={isHorizontal ? Position.Right : Position.Bottom}
            style={isHorizontal ? { top: '35%' } : { left: '30%' }}
            className="!w-3 !h-3 !bg-status-success/30 !border-2 !border-status-success hover:!border-accent-500 transition-colors"
          />
          <div className={`absolute text-[9px] text-status-success font-medium ${isHorizontal ? 'right-[-22px] top-[28%]' : 'bottom-[-18px] left-[22%]'}`}>true</div>
          <Handle
            type="source"
            id="false"
            position={isHorizontal ? Position.Right : Position.Bottom}
            style={isHorizontal ? { top: '65%' } : { left: '70%' }}
            className="!w-3 !h-3 !bg-status-error/30 !border-2 !border-status-error hover:!border-accent-500 transition-colors"
          />
          <div className={`absolute text-[9px] text-status-error font-medium ${isHorizontal ? 'right-[-26px] top-[62%]' : 'bottom-[-18px] left-[62%]'}`}>false</div>
        </>
      ) : (
        !data.nodeType.includes('output') && (
          <Handle
            type="source"
            position={isHorizontal ? Position.Right : Position.Bottom}
            className="!w-3 !h-3 !bg-surface-3 !border-2 !border-border-strong hover:!border-accent-500 transition-colors"
          />
        )
      )}
    </div>
  );
}
