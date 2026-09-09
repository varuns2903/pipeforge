import { create } from 'zustand';
import type { User } from '@pipeforge/shared';
import { api } from '../lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  logout: () => void;
}

// The token itself lives in an httpOnly cookie the browser manages — this
// store only tracks who's currently signed in, not the credential itself.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setAuth: (user) => {
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    api.post('/auth/logout').catch(() => {});
    set({ user: null, isAuthenticated: false });
  },
}));
