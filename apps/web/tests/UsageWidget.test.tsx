import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../src/lib/api', () => ({
  api: { get: vi.fn() },
}));

import { api } from '../src/lib/api';
import { UsageWidget } from '../src/components/UsageWidget';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UsageWidget', () => {
  it('renders nothing before usage data has loaded', () => {
    (api.get as any).mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = renderWithClient(<UsageWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders formatted storage and execution usage once loaded', async () => {
    (api.get as any).mockResolvedValue({
      data: {
        storage: { usedBytes: 512 * 1024 * 1024, limitBytes: 1024 * 1024 * 1024 },
        executions: { active: 2, limit: 5 },
      },
    });

    renderWithClient(<UsageWidget />);

    await waitFor(() => expect(screen.getByText('512 MB / 1.0 GB')).toBeInTheDocument());
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/usage');
  });
});
