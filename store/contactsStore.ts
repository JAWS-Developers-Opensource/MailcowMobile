import { create } from 'zustand';
import type { AddressBook, Contact } from '../types';

interface ContactsState {
  addressBooks: AddressBook[];
  contacts: Contact[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  setAddressBooks: (books: AddressBook[]) => void;
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (contact: Contact) => void;
  removeContact: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useContactsStore = create<ContactsState>((set) => ({
  addressBooks: [],
  contacts: [],
  searchQuery: '',
  isLoading: false,
  error: null,
  setAddressBooks: (addressBooks) => set({ addressBooks }),
  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) =>
    set((state) => ({ contacts: [...state.contacts, contact] })),
  updateContact: (contact) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === contact.id ? contact : c)),
    })),
  removeContact: (id) =>
    set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
