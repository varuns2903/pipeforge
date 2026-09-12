import type { LineageNode } from './lineageTypes';

// Recursive, indented tree — deep chains are rare (most pipelines are a
// handful of transforms), so no collapse/expand state is needed.
export function LineageTree({ node, depth = 0 }: { node: LineageNode; depth?: number }) {
  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 14 }} className={depth > 0 ? 'border-l border-border-subtle pl-3 mt-1' : ''}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-text-primary font-medium">{node.nodeLabel}</span>
        <span className="text-text-tertiary">·</span>
        <span className="text-text-tertiary">{node.nodeType}</span>
        <span className="text-text-tertiary">·</span>
        <code className="text-accent-500">{node.column}</code>
        {node.synthetic && (
          <span className="px-1.5 py-0.5 rounded bg-status-warning/10 text-status-warning text-[10px] uppercase tracking-wide">
            computed
          </span>
        )}
        {node.truncated && (
          <span className="px-1.5 py-0.5 rounded bg-surface-2 text-text-tertiary text-[10px] uppercase tracking-wide">
            cut off
          </span>
        )}
      </div>
      {node.sources.map((source, i) => (
        <LineageTree key={`${source.nodeId}-${source.column}-${i}`} node={source} depth={depth + 1} />
      ))}
    </div>
  );
}
