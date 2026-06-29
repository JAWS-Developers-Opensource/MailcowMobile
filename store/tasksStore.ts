import { create } from 'zustand';
import type { Task, TaskList } from '../types';

interface TasksState {
  taskLists: TaskList[];
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  setTaskLists: (lists: TaskList[]) => void;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
  removeTask: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTasksStore = create<TasksState>((set) => ({
  taskLists: [],
  tasks: [],
  isLoading: false,
  error: null,
  setTaskLists: (taskLists) => set({ taskLists }),
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (task) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
    })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
