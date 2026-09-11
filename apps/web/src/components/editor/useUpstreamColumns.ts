import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

/**
 * Best-effort column names for whatever feeds into `nodeId`, sourced from
 * the pipeline's most recent completed execution. This is a convenience for
 * autocomplete/hints, not a schema system — before the first run (or if the
 * upstream node changed since), it just returns [] and the config fields
 * fall back to plain free-text entry.
 */
export function useUpstreamColumns(nodeId: string | undefined, edges: any[], projectId: string): string[] {
  const { pipelineId } = useParams<{ pipelineId: string }>();

  const { data: executionsPage } = useQuery({
    queryKey: ['executions-recent', pipelineId],
    queryFn: async () => (await api.get(`/projects/${projectId}/pipelines/${pipelineId}/executions`, { params: { limit: 5 } })).data,
    enabled: !!pipelineId,
    staleTime: 30_000,
  });

  const latestCompletedId = executionsPage?.items?.find((e: any) => e.status === 'COMPLETED')?._id;

  const { data: executionDetail } = useQuery({
    queryKey: ['execution-detail-for-columns', latestCompletedId],
    queryFn: async () => (await api.get(`/projects/${projectId}/pipelines/${pipelineId}/executions/${latestCompletedId}`)).data,
    enabled: !!latestCompletedId,
    staleTime: 30_000,
  });

  return useMemo(() => {
    if (!nodeId || !executionDetail?.results) return [];
    const upstreamEdge = edges.find((e: any) => e.target === nodeId);
    if (!upstreamEdge) return [];
    const output = executionDetail.results[upstreamEdge.source];
    if (!output) return [];
    // A branch node's output is { true: [...], false: [...] } rather than a
    // flat row array (see packages/pipeline-engine/src/engine.ts) — either
    // side has the same columns, so either works for suggestions.
    const rows = Array.isArray(output) ? output : (output.true || output.false || []);
    if (!rows[0]) return [];
    return Object.keys(rows[0]);
  }, [nodeId, edges, executionDetail]);
}
