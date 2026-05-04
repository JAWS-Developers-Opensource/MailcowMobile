import { create } from 'zustand';
import type { MailcowAccount, AuthStatus } from '../types';

interface AuthState {
  account: MailcowAccount | null;
  status: AuthStatus;
  error: string | null;
  setAccount: (account: MailcowAccount) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  account: null,
  status: 'idle',
  error: null,
  setAccount: (account) => set({ account, status: 'authenticated', error: null }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: 'error' }),
  logout: () => set({ account: null, status: 'idle', error: null }),
}));
