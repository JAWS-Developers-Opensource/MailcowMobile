import { create } from 'zustand';
import type { Calendar, CalendarEvent } from '../types';

interface CalendarState {
  calendars: Calendar[];
  events: CalendarEvent[];
  selectedDate: string; // ISO date string YYYY-MM-DD
  isLoading: boolean;
  error: string | null;
  setCalendars: (calendars: Calendar[]) => void;
  toggleCalendarVisible: (id: string) => void;
  setEvents: (events: CalendarEvent[]) => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (event: CalendarEvent) => void;
  removeEvent: (id: string) => void;
  setSelectedDate: (date: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useCalendarStore = create<CalendarState>((set) => ({
  calendars: [],
  events: [],
  selectedDate: new Date().toISOString().split('T')[0],
  isLoading: false,
  error: null,
  setCalendars: (calendars) => set({ calendars }),
  toggleCalendarVisible: (id) =>
    set((state) => ({
      calendars: state.calendars.map((c) =>
        c.id === id ? { ...c, visible: !c.visible } : c,
      ),
    })),
  setEvents: (events) => set({ events }),
  addEvent: (event) =>
    set((state) => ({ events: [...state.events, event] })),
  updateEvent: (event) =>
    set((state) => ({
      events: state.events.map((e) => (e.id === event.id ? event : e)),
    })),
  removeEvent: (id) =>
    set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
