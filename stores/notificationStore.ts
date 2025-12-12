import { create } from 'zustand';

export interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'info' | 'error' | 'warning';
}

interface NotificationState {
  notifications: ToastNotification[];
  addNotification: (message: string, type?: ToastNotification['type']) => void;
  removeNotification: (id: number) => void;
}

let nextId = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  addNotification: (message, type = 'info') => {
    const id = nextId++;
    set((state) => ({
      notifications: [...state.notifications, { id, message, type }],
    }));
    setTimeout(() => {
      get().removeNotification(id);
    }, 4000);
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));

// Global helper for non-React parts of the app
export const notify = (message: string, type?: ToastNotification['type']) => {
  useNotificationStore.getState().addNotification(message, type);
};
