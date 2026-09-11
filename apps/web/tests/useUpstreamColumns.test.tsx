import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('../src/lib/api', () => ({
  api: { get: vi.fn() },
}));

import { api } from '../src/lib/api';
import { useUpstreamColumns } from '../src/components/editor/useUpstreamColumns';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/projects/p1/pipelines/pipe1']}>
        <Routes>
          <Route path="/projects/:projectId/pipelines/:pipelineId" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useUpstreamColumns', () => {
  it('returns [] when there is no upstream edge for the node', async () => {
    (api.get as any).mockResolvedValue({ data: { items: [] } });
    const { result } = renderHook(() => useUpstreamColumns('n2', [], 'p1'), { wrapper });
    await waitFor(() => expect(result.current).toEqual([]));
  });

  it('extracts column names from the upstream node\'s output in the latest completed execution', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('/executions/exec1')) {
        return Promise.resolve({ data: { results: { n1: [{ id: 1, name: 'Alice', age: 28 }] } } });
      }
      return Promise.resolve({ data: { items: [{ _id: 'exec1', status: 'COMPLETED' }] } });
    });

    const { result } = renderHook(
      () => useUpstreamColumns('n2', [{ source: 'n1', target: 'n2' }], 'p1'),
      { wrapper }
    );

    await waitFor(() => expect(result.current).toEqual(['id', 'name', 'age']));
  });

  it('skips non-completed executions and falls back to [] if none are completed', async () => {
    (api.get as any).mockResolvedValue({ data: { items: [{ _id: 'exec1', status: 'FAILED' }] } });
    const { result } = renderHook(
      () => useUpstreamColumns('n2', [{ source: 'n1', target: 'n2' }], 'p1'),
      { wrapper }
    );
    await waitFor(() => expect(result.current).toEqual([]));
  });

  it('reads either side of a branch node\'s { true, false } output shape', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('/executions/exec1')) {
        return Promise.resolve({ data: { results: { n1: { true: [{ country: 'US' }], false: [] } } } });
      }
      return Promise.resolve({ data: { items: [{ _id: 'exec1', status: 'COMPLETED' }] } });
    });

    const { result } = renderHook(
      () => useUpstreamColumns('n2', [{ source: 'n1', target: 'n2' }], 'p1'),
      { wrapper }
    );

    await waitFor(() => expect(result.current).toEqual(['country']));
  });
});
