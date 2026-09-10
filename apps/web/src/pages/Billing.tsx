import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { CreditCard, Check, X, ExternalLink } from 'lucide-react';

interface PlanSummary {
  id: 'free' | 'pro';
  name: string;
  maxStorageMB: number;
  maxConcurrentExecutions: number;
}

interface PlanResponse {
  plan: 'free' | 'pro';
  subscriptionStatus: string | null;
  limits: PlanSummary;
  plans: PlanSummary[];
}

export function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutResult = searchParams.get('checkout');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PlanResponse>({
    queryKey: ['billing-plan'],
    queryFn: async () => (await api.get('/billing/plan')).data,
  });

  const checkout = useMutation({
    mutationFn: async () => (await api.post('/billing/checkout')).data as { url: string },
    onSuccess: (data) => { window.location.href = data.url; },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to start checkout'),
  });

  const portal = useMutation({
    mutationFn: async () => (await api.post('/billing/portal')).data as { url: string },
    onSuccess: (data) => { window.location.href = data.url; },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to open billing portal'),
  });

  const dismissBanner = () => {
    searchParams.delete('checkout');
    setSearchParams(searchParams, { replace: true });
  };

  if (isLoading || !data) {
    return <div className="p-8"><div className="h-8 w-48 bg-surface-2 animate-pulse rounded"></div></div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Billing</h1>
        <p className="text-text-secondary text-sm mt-1">Manage your plan and quota limits.</p>
      </div>

      {checkoutResult === 'success' && (
        <div className="mb-6 p-4 bg-status-success/10 border border-status-success/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-status-success text-sm">
            <Check size={16} /> Subscription updated. It may take a few seconds to reflect below.
          </div>
          <button onClick={dismissBanner} className="text-text-tertiary hover:text-text-primary"><X size={16} /></button>
        </div>
      )}
      {checkoutResult === 'cancel' && (
        <div className="mb-6 p-4 bg-surface-2 border border-border-subtle rounded-lg flex items-center justify-between">
          <div className="text-sm text-text-secondary">Checkout was canceled — no changes were made.</div>
          <button onClick={dismissBanner} className="text-text-tertiary hover:text-text-primary"><X size={16} /></button>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-status-error/10 border border-status-error/20 text-status-error text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.plans.map((plan) => {
          const isCurrent = plan.id === data.plan;
          return (
            <div
              key={plan.id}
              className={`glass-panel rounded-xl border p-6 flex flex-col ${isCurrent ? 'border-accent-500' : 'border-border-strong'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-text-secondary" />
                  <h2 className="text-lg font-semibold text-text-primary">{plan.name}</h2>
                </div>
                {isCurrent && (
                  <span className="px-2 py-0.5 rounded text-xs bg-accent-500/20 text-accent-400 border border-accent-500/30">
                    Current plan
                  </span>
                )}
              </div>

              <ul className="space-y-2 text-sm text-text-secondary mb-6 flex-1">
                <li className="flex items-center gap-2"><Check size={14} className="text-status-success" /> {plan.maxStorageMB.toLocaleString()} MB storage</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-status-success" /> {plan.maxConcurrentExecutions} concurrent executions</li>
              </ul>

              {plan.id === 'pro' && !isCurrent && (
                <button
                  onClick={() => { setError(null); checkout.mutate(); }}
                  disabled={checkout.isPending}
                  className="accent-button px-4 py-2 rounded-md text-sm disabled:opacity-50"
                >
                  {checkout.isPending ? 'Redirecting…' : 'Upgrade to Pro'}
                </button>
              )}
              {plan.id === 'pro' && isCurrent && (
                <button
                  onClick={() => { setError(null); portal.mutate(); }}
                  disabled={portal.isPending}
                  className="glass-button px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ExternalLink size={14} /> {portal.isPending ? 'Redirecting…' : 'Manage billing'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {data.subscriptionStatus && (
        <p className="text-xs text-text-tertiary mt-6">Subscription status: <span className="font-mono">{data.subscriptionStatus}</span></p>
      )}
    </div>
  );
}
