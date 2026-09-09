import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background canvas-bg relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent-600/10 via-background/80 to-background"></div>

      <div className="w-full max-w-sm z-10">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Choose a new password</h2>
        </div>

        <div className="glass-panel p-8 rounded-2xl">
          {!token ? (
            <div className="text-sm text-status-error text-center">
              This reset link is missing its token. Request a new one from the <Link to="/forgot-password" className="underline">forgot password</Link> page.
            </div>
          ) : done ? (
            <div className="text-sm text-status-success text-center">
              Password updated. Redirecting to sign in...
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-3 bg-status-error/10 border border-status-error/20 text-status-error text-sm rounded-lg text-center">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-surface-2 border border-border-strong rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-colors"
                    placeholder="••••••••"
                    required
                    minLength={8}
                    pattern="(?=.*[A-Za-z])(?=.*\d).+"
                    title="At least 8 characters, including a letter and a number"
                  />
                  <p className="text-xs text-text-tertiary mt-1.5">At least 8 characters, with a letter and a number.</p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 accent-button py-2.5 px-4 rounded-lg text-sm disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center h-[42px]"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-text-secondary">
          <Link to="/login" className="text-accent-500 hover:text-accent-400 font-medium transition-colors">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
