import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } finally {
      // Always show the same confirmation, whether or not the email exists —
      // matches the API's behavior, so we don't leak which emails are registered.
      setIsLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background canvas-bg relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent-600/10 via-background/80 to-background"></div>

      <div className="w-full max-w-sm z-10">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Reset your password</h2>
          <p className="text-sm text-text-tertiary mt-2">We'll email you a link to reset it.</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl">
          {submitted ? (
            <div className="text-sm text-text-secondary text-center">
              If an account exists for <span className="text-text-primary font-medium">{email}</span>, you'll receive an email with reset instructions shortly.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-surface-2 border border-border-strong rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-colors"
                  placeholder="developer@example.com"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 accent-button py-2.5 px-4 rounded-lg text-sm disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center h-[42px]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : 'Send reset link'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-text-secondary">
          <Link to="/login" className="text-accent-500 hover:text-accent-400 font-medium transition-colors">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
