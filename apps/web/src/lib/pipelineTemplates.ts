// Starter pipelines offered when creating a new one, so the first thing a
// user sees isn't a blank canvas. Every non-blank template reads the
// engine's built-in mock dataset (csv-input's config.filePath === 'mock' —
// see packages/pipeline-engine/src/engine.ts) so it runs successfully with
// zero setup; swapping the source node's file is the natural first edit.
export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
}

const node = (id: string, nodeType: string, label: string, x: number, y: number, config: any = {}) => ({
  id,
  type: 'dataNode',
  position: { x, y },
  data: { label, nodeType, config },
});

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start from an empty canvas.',
    nodes: [],
    edges: [],
  },
  {
    id: 'csv-cleanup',
    name: 'CSV Cleanup',
    description: 'Upload → fill missing values → fix column types → export.',
    nodes: [
      node('n1', 'csv-input', 'CSV Upload', 100, 100, { filePath: 'mock' }),
      node('n2', 'fill-nulls', 'Fill Missing Country', 100, 260, { column: 'country', value: 'UNKNOWN' }),
      node('n3', 'cast-type', 'Cast Age to Number', 100, 420, { column: 'age', targetType: 'number' }),
      node('n4', 'csv-output', 'Export CSV', 100, 580),
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },
  {
    id: 'dedupe-export',
    name: 'Dedupe & Export',
    description: 'Upload → remove duplicate rows → sort → export.',
    nodes: [
      node('n1', 'csv-input', 'CSV Upload', 100, 100, { filePath: 'mock' }),
      node('n2', 'deduplicate', 'Remove Duplicates', 100, 260, { columns: 'name' }),
      node('n3', 'sort', 'Sort by Age', 100, 420, { sortBy: 'age', order: 'asc' }),
      node('n4', 'csv-output', 'Export CSV', 100, 580),
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },
  {
    id: 'filter-aggregate-report',
    name: 'Filter & Aggregate Report',
    description: 'Upload → keep matching rows → group & count → export JSON.',
    nodes: [
      node('n1', 'csv-input', 'CSV Upload', 100, 100, { filePath: 'mock' }),
      node('n2', 'filter', 'Adults Only', 100, 260, { condition: 'row.age >= 18' }),
      node('n3', 'aggregate', 'Count by Country', 100, 420, { groupBy: 'country', operation: 'count' }),
      node('n4', 'json-output', 'Export JSON', 100, 580),
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },
];
