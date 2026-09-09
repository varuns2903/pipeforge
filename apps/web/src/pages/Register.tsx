import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', { name, email, password });
      setAuth(res.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background canvas-bg relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent-600/10 via-background/80 to-background"></div>
      
      <div className="w-full max-w-sm z-10">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Create your workspace</h2>
          <p className="text-sm text-text-tertiary mt-2">Join pipeforge to automate data engineering.</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl">
          {error && (
            <div className="mb-6 p-3 bg-status-error/10 border border-status-error/20 text-status-error text-sm rounded-lg text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-4 py-2.5 bg-surface-2 border border-border-strong rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-colors"
                placeholder="Ada Lovelace"
                required
              />
            </div>
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
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-2.5 bg-surface-2 border border-border-strong rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-colors"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 accent-button py-2.5 px-4 rounded-lg text-sm disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center h-[42px]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : 'Sign up'}
            </button>
          </form>
        </div>
        
        <p className="mt-8 text-center text-sm text-text-secondary">
          Already have an account? <Link to="/login" className="text-accent-500 hover:text-accent-400 font-medium transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
