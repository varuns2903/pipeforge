import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function ProtectedRoute() {
  const { isAuthenticated, setAuth, logout } = useAuthStore();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // The auth token lives in an httpOnly cookie we can't read from JS, so
    // the only way to know if the session is still valid is to ask the API.
    const verifySession = async () => {
      try {
        const res = await api.get('/auth/me');
        setAuth(res.data.user);
      } catch (err) {
        logout();
      } finally {
        setIsVerifying(false);
      }
    };
    verifySession();
  }, [setAuth, logout]);

  if (isVerifying) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-text-secondary">Loading workspace...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
