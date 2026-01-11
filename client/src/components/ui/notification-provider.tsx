import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { ToastInput, NotificationItem, ActiveToast } from './notification.types';
import {
  generateId,
  getStoredNotifications,
  storeNotifications,
  getSoundPreference,
  setSoundPreference,
  playNotificationSound,
  showBrowserNotification,
} from './notification.utils';

type NotificationContextType = {
  activeToasts: ActiveToast[];
  notifications: NotificationItem[];
  unreadCount: number;
  soundEnabled: boolean;
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  update: (id: string, patch: Partial<ToastInput>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  toggleSound: () => void;
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
  historyLimit: number;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNexusToast() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNexusToast must be used within NotificationProvider');
  return {
    toast: context.toast,
    dismiss: context.dismiss,
    dismissAll: context.dismissAll,
    update: context.update,
  };
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return {
    notifications: context.notifications,
    unreadCount: context.unreadCount,
    markAsRead: context.markAsRead,
    markAllAsRead: context.markAllAsRead,
    clearAll: context.clearAll,
  };
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotificationContext must be used within NotificationProvider');
  return context;
}

type NotificationProviderProps = {
  children: ReactNode;
  historyLimit?: number;
  soundEnabled?: boolean;
};

export function NotificationProvider({
  children,
  historyLimit = 50,
  soundEnabled: initialSoundEnabled,
}: NotificationProviderProps) {
  const [activeToasts, setActiveToasts] = useState<ActiveToast[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [soundEnabled, setSoundEnabledState] = useState(() => 
    initialSoundEnabled !== undefined ? initialSoundEnabled : getSoundPreference()
  );
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const groupKeysRef = useRef<Map<string, string>>(new Map());
  const pauseStartRef = useRef<Map<string, number>>(new Map());
  const timerStartRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const stored = getStoredNotifications(historyLimit);
    setNotifications(stored);
  }, [historyLimit]);

  useEffect(() => {
    storeNotifications(notifications);
  }, [notifications]);

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    clearTimer(id);
    pauseStartRef.current.delete(id);
    timerStartRef.current.delete(id);
    setActiveToasts(prev => prev.filter(t => t.id !== id));
    
    const groupKey = Array.from(groupKeysRef.current.entries()).find(([_, val]) => val === id)?.[0];
    if (groupKey) {
      groupKeysRef.current.delete(groupKey);
    }
  }, [clearTimer]);

  const startTimer = useCallback((id: string, duration: number) => {
    clearTimer(id);
    timerStartRef.current.set(id, Date.now());
    const timer = setTimeout(() => {
      dismiss(id);
    }, duration);
    timersRef.current.set(id, timer);
  }, [clearTimer, dismiss]);

  const pauseToast = useCallback((id: string) => {
    setActiveToasts(prev => prev.map(toast => {
      if (toast.id === id && !toast.isPaused && toast.duration && toast.duration > 0) {
        clearTimer(id);
        const timerStart = timerStartRef.current.get(id) || toast.createdAt;
        const elapsed = Date.now() - timerStart;
        const remaining = Math.max(0, toast.remainingDuration - elapsed);
        pauseStartRef.current.set(id, Date.now());
        return { ...toast, isPaused: true, remainingDuration: remaining };
      }
      return toast;
    }));
  }, [clearTimer]);

  const resumeToast = useCallback((id: string) => {
    setActiveToasts(prev => {
      const newToasts = prev.map(toast => {
        if (toast.id === id && toast.isPaused && toast.remainingDuration > 0) {
          pauseStartRef.current.delete(id);
          startTimer(id, toast.remainingDuration);
          return { ...toast, isPaused: false };
        }
        return toast;
      });
      return newToasts;
    });
  }, [startTimer]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        activeToasts.forEach(toast => {
          if (!toast.isPaused && toast.duration && toast.duration > 0) {
            pauseToast(toast.id);
          }
        });
      } else {
        activeToasts.forEach(toast => {
          if (toast.isPaused && toast.duration && toast.duration > 0) {
            resumeToast(toast.id);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeToasts, pauseToast, resumeToast]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const update = useCallback((id: string, patch: Partial<ToastInput>) => {
    setActiveToasts(prev => prev.map(toast => {
      if (toast.id === id) {
        const updated = { ...toast, ...patch };
        
        if (patch.duration !== undefined && patch.duration !== toast.duration) {
          clearTimer(id);
          if (patch.duration > 0) {
            startTimer(id, patch.duration);
          }
          updated.remainingDuration = patch.duration;
        }
        
        return updated;
      }
      return toast;
    }));

    setNotifications(prev => prev.map(notif => {
      if (notif.id === id) {
        return {
          ...notif,
          ...(patch.type && { type: patch.type }),
          ...(patch.title && { title: patch.title }),
          ...(patch.description !== undefined && { description: patch.description }),
          ...(patch.action && { action: patch.action }),
          ...(patch.meta && { meta: patch.meta }),
        };
      }
      return notif;
    }));
  }, [clearTimer, startTimer]);

  const toast = useCallback((input: ToastInput): string => {
    const id = input.id || generateId();
    const duration = input.duration !== undefined ? input.duration : 5000;
    const createdAt = Date.now();

    if (input.groupKey) {
      const existingId = groupKeysRef.current.get(input.groupKey);
      if (existingId) {
        update(existingId, input);
        return existingId;
      }
      groupKeysRef.current.set(input.groupKey, id);
    }

    const newToast: ActiveToast = {
      ...input,
      id,
      createdAt,
      isPaused: false,
      remainingDuration: duration,
      dismissible: input.dismissible !== false,
    };

    setActiveToasts(prev => [newToast, ...prev]);

    const notificationItem: NotificationItem = {
      id,
      createdAt,
      type: input.type,
      title: input.title,
      description: input.description,
      read: false,
      action: input.action,
      meta: input.meta,
    };

    setNotifications(prev => [notificationItem, ...prev].slice(0, historyLimit));

    if (soundEnabled && input.type !== 'loading') {
      playNotificationSound();
    }

    if ((input.type === 'error' || input.type === 'warning') && 'Notification' in window) {
      showBrowserNotification(input.title, input.description);
    }

    if (duration > 0) {
      startTimer(id, duration);
    }

    return id;
  }, [soundEnabled, historyLimit, startTimer, update]);

  const dismissAll = useCallback(() => {
    activeToasts.forEach(toast => clearTimer(toast.id));
    setActiveToasts([]);
    groupKeysRef.current.clear();
  }, [activeToasts, clearTimer]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    dismissAll();
    setNotifications([]);
  }, [dismissAll]);

  const toggleSound = useCallback(() => {
    setSoundEnabledState(prev => {
      const newValue = !prev;
      setSoundPreference(newValue);
      return newValue;
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        activeToasts,
        notifications,
        unreadCount,
        soundEnabled,
        toast,
        dismiss,
        dismissAll,
        update,
        markAsRead,
        markAllAsRead,
        clearAll,
        toggleSound,
        pauseToast,
        resumeToast,
        historyLimit,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
