import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('This verification link is missing its token.');
      return;
    }
    api.post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.error || 'Verification failed.');
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background canvas-bg relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent-600/10 via-background/80 to-background"></div>

      <div className="w-full max-w-sm z-10">
        <div className="glass-panel p-8 rounded-2xl text-center">
          {status === 'verifying' && (
            <div className="text-sm text-text-secondary">Verifying your email...</div>
          )}
          {status === 'success' && (
            <div className="text-sm text-status-success">Your email has been verified.</div>
          )}
          {status === 'error' && (
            <div className="text-sm text-status-error">{error}</div>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-text-secondary">
          <Link to="/" className="text-accent-500 hover:text-accent-400 font-medium transition-colors">Go to workspace</Link>
        </p>
      </div>
    </div>
  );
}
