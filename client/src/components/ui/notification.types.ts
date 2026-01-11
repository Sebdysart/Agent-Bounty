import { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

export type ToastInput = {
  id?: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
  icon?: ReactNode;
  dismissible?: boolean;
  groupKey?: string;
  meta?: Record<string, unknown>;
};

export type NotificationItem = {
  id: string;
  createdAt: number;
  type: ToastType;
  title: string;
  description?: string;
  read: boolean;
  action?: ToastAction;
  meta?: Record<string, unknown>;
};

export type NotificationCenterProps = {
  position?: ToastPosition;
  maxVisible?: number;
  historyLimit?: number;
  soundEnabled?: boolean;
};

export type ActiveToast = ToastInput & {
  id: string;
  createdAt: number;
  isPaused: boolean;
  remainingDuration: number;
};
