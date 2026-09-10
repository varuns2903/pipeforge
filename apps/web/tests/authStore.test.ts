import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/api', () => ({
  api: { post: vi.fn().mockResolvedValue({}) },
}));

import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/lib/api';

const user = { id: 'u1', email: 'a@b.com', name: 'A' } as any;

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    vi.clearAllMocks();
  });

  it('starts signed out', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setAuth marks the store authenticated with the given user', () => {
    useAuthStore.getState().setAuth(user);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('logout clears the store and calls the logout endpoint', () => {
    useAuthStore.getState().setAuth(user);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });

  it('logout clears local state even if the request fails', async () => {
    (api.post as any).mockRejectedValueOnce(new Error('network error'));
    useAuthStore.getState().setAuth(user);

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
