import { useState, useEffect, useCallback } from 'react';
import {
  registerServiceWorker,
  setupInstallPrompt,
  canInstall,
  promptInstall,
  isStandalone,
  isOnline,
  addOnlineListener,
  addOfflineListener,
  removeOnlineListener,
  removeOfflineListener,
  requestNotificationPermission,
  getNotificationPermission
} from '@/lib/pwa';

interface UsePWAReturn {
  isInstalled: boolean;
  canInstall: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  install: () => Promise<boolean>;
  requestNotifications: () => Promise<NotificationPermission>;
  updateApp: () => void;
}

export function usePWA(): UsePWAReturn {
  const [installed, setInstalled] = useState(isStandalone());
  const [installReady, setInstallReady] = useState(false);
  const [online, setOnline] = useState(isOnline());
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    registerServiceWorker();
    setupInstallPrompt();

    const handleInstallReady = () => setInstallReady(true);
    const handleInstalled = () => {
      setInstalled(true);
      setInstallReady(false);
    };
    const handleUpdateAvailable = () => setUpdateAvailable(true);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('pwa-install-ready', handleInstallReady);
    window.addEventListener('pwa-installed', handleInstalled);
    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    addOnlineListener(handleOnline);
    addOfflineListener(handleOffline);

    setNotifPermission(getNotificationPermission());

    return () => {
      window.removeEventListener('pwa-install-ready', handleInstallReady);
      window.removeEventListener('pwa-installed', handleInstalled);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
      removeOnlineListener(handleOnline);
      removeOfflineListener(handleOffline);
    };
  }, []);

  const install = useCallback(async () => {
    const result = await promptInstall();
    if (result) {
      setInstalled(true);
      setInstallReady(false);
    }
    return result;
  }, []);

  const requestNotifications = useCallback(async () => {
    const permission = await requestNotificationPermission();
    setNotifPermission(permission);
    return permission;
  }, []);

  const updateApp = useCallback(() => {
    window.location.reload();
  }, []);

  return {
    isInstalled: installed,
    canInstall: installReady && canInstall(),
    isOnline: online,
    isUpdateAvailable: updateAvailable,
    notificationPermission: notifPermission,
    install,
    requestNotifications,
    updateApp
  };
}
