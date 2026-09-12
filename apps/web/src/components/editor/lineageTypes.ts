export interface LineageNode {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  column: string;
  synthetic?: boolean;
  truncated?: boolean;
  sources: LineageNode[];
}
