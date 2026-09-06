import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function ProtectedRoute() {
  const { isAuthenticated, token, restoreAuth, logout } = useAuthStore();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsVerifying(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        restoreAuth(res.data.user, token);
      } catch (err) {
        logout();
      } finally {
        setIsVerifying(false);
      }
    };
    verifyToken();
  }, [token, restoreAuth, logout]);

  if (isVerifying) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-text-secondary">Loading workspace...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
