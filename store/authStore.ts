import { create } from 'zustand';
import type { MailcowAccount, AuthStatus } from '../types';

interface AuthState {
  account: MailcowAccount | null;
  /** In-memory password — NOT persisted in the store, set from SecureStore on login. */
  password: string | null;
  status: AuthStatus;
  error: string | null;
  setAccount: (account: MailcowAccount, password: string) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  account: null,
  password: null,
  status: 'idle',
  error: null,
  setAccount: (account, password) =>
    set({ account, password, status: 'authenticated', error: null }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: 'error' }),
  logout: () => set({ account: null, password: null, status: 'idle', error: null }),
}));
