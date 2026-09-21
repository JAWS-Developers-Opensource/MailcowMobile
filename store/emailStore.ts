import { create } from 'zustand';
import type { Email, EmailFolder } from '../types';

interface EmailState {
  folders: EmailFolder[];
  emails: Email[];
  selectedFolder: string;
  selectedEmail: Email | null;
  isLoading: boolean;
  error: string | null;
  setFolders: (folders: EmailFolder[]) => void;
  setEmails: (emails: Email[]) => void;
  appendEmails: (emails: Email[]) => void;
  setSelectedFolder: (folder: string) => void;
  setSelectedEmail: (email: Email | null) => void;
  markAsRead: (id: string) => void;
  markAsFlagged: (id: string, flagged: boolean) => void;
  removeEmail: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useEmailStore = create<EmailState>((set) => ({
  folders: [],
  emails: [],
  selectedFolder: 'INBOX',
  selectedEmail: null,
  isLoading: false,
  error: null,
  setFolders: (folders) => set({ folders }),
  setEmails: (emails) => set({ emails }),
  appendEmails: (emails) =>
    set((state) => ({ emails: [...state.emails, ...emails] })),
  setSelectedFolder: (folder) => set({ selectedFolder: folder, emails: [] }),
  setSelectedEmail: (email) => set({ selectedEmail: email }),
  markAsRead: (id) =>
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === id ? { ...e, isRead: true } : e,
      ),
    })),
  markAsFlagged: (id, flagged) =>
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === id ? { ...e, isFlagged: flagged } : e,
      ),
    })),
  removeEmail: (id) =>
    set((state) => ({ emails: state.emails.filter((e) => e.id !== id) })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
