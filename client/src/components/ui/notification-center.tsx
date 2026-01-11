import { useState, useEffect } from 'react';
import { Bell, Volume2, VolumeX, Trash2, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './button';
import { Badge } from './badge';
import { ScrollArea } from './scroll-area';
import { formatRelativeTime, getTypeBorderColor, requestNotificationPermission } from './notification.utils';
import { NotificationCenterProps } from './notification.types';
import { useNotificationContext } from './notification-provider';

export function NotificationCenter({ position = 'top-right' }: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    soundEnabled,
    markAsRead,
    markAllAsRead,
    clearAll,
    toggleSound,
  } = useNotificationContext();

  const [isOpen, setIsOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  const handleRequestPermission = async () => {
    const permission = await requestNotificationPermission();
    setBrowserPermission(permission);
  };

  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        data-testid="button-notification-center"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] flex items-center justify-center p-0 text-xs"
            data-testid="badge-unread-count"
          >
            {displayCount}
          </Badge>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9997]"
              onClick={() => setIsOpen(false)}
              data-testid="notification-overlay"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] z-[9998] rounded-lg border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl"
              data-testid="notification-panel"
            >
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <h3 className="font-semibold text-lg">Notifications</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={toggleSound}
                      aria-label={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
                      data-testid="button-toggle-sound"
                    >
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <VolumeX className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {browserPermission !== 'granted' && 'Notification' in window && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleRequestPermission}
                    data-testid="button-enable-browser-notifications"
                  >
                    Enable Browser Notifications
                  </Button>
                )}

                {notifications.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={markAllAsRead}
                      data-testid="button-mark-all-read"
                    >
                      <CheckCheck className="w-3 h-3 mr-1" />
                      Mark All Read
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={clearAll}
                      data-testid="button-clear-all"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Clear All
                    </Button>
                  </div>
                )}
              </div>

              <ScrollArea className="h-[400px]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`
                          p-4 cursor-pointer transition-colors hover:bg-muted/50
                          ${!notification.read ? 'bg-muted/30' : ''}
                        `}
                        onClick={() => markAsRead(notification.id)}
                        data-testid={`notification-item-${notification.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-1 h-full min-h-[40px] rounded-full ${getTypeBorderColor(notification.type).replace('border-l-', 'bg-')}`} />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-sm text-foreground">
                                {notification.title}
                              </div>
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-1" />
                              )}
                            </div>
                            
                            {notification.description && (
                              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                {notification.description}
                              </div>
                            )}
                            
                            <div className="mt-2 text-xs text-muted-foreground">
                              {formatRelativeTime(notification.createdAt)}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
