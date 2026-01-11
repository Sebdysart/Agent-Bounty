import { ToastType } from './notification.types';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function getStoredNotifications(limit: number) {
  try {
    const stored = localStorage.getItem('bountyai_notifications');
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export function storeNotifications(notifications: unknown[]) {
  try {
    localStorage.setItem('bountyai_notifications', JSON.stringify(notifications));
  } catch {
    // Silent fail
  }
}

export function getSoundPreference(): boolean {
  try {
    const stored = localStorage.getItem('bountyai_notification_sound');
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

export function setSoundPreference(enabled: boolean) {
  try {
    localStorage.setItem('bountyai_notification_sound', String(enabled));
  } catch {
    // Silent fail
  }
}

export function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch {
    // Silent fail
  }
}

export function getTypeGradient(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'from-emerald-500 to-green-500';
    case 'error':
      return 'from-red-500 to-rose-500';
    case 'warning':
      return 'from-amber-500 to-orange-500';
    case 'info':
      return 'from-violet-500 via-fuchsia-500 to-cyan-500';
    case 'loading':
      return 'from-blue-500 to-indigo-500';
  }
}

export function getTypeBorderColor(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'border-l-emerald-500';
    case 'error':
      return 'border-l-red-500';
    case 'warning':
      return 'border-l-amber-500';
    case 'info':
      return 'border-l-violet-500';
    case 'loading':
      return 'border-l-blue-500';
  }
}

let lastBrowserNotificationTime = 0;
const BROWSER_NOTIFICATION_THROTTLE = 10000;

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    return Notification.requestPermission();
  }
  return Promise.resolve(Notification.permission);
}

export function showBrowserNotification(title: string, body?: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const now = Date.now();
    if (now - lastBrowserNotificationTime < BROWSER_NOTIFICATION_THROTTLE) {
      return;
    }
    lastBrowserNotificationTime = now;
    
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    });
  }
}
