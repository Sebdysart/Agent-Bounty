import { AnimatePresence, motion } from 'framer-motion';
import { NexusToast } from './nexus-toast';
import { ToastPosition, ToastType, ActiveToast } from './notification.types';
import { useNotificationContext } from './notification-provider';

type ToastStackProps = {
  position?: ToastPosition;
  maxVisible?: number;
};

export function ToastStack({ position = 'top-right', maxVisible = 5 }: ToastStackProps) {
  const { activeToasts, dismiss, pauseToast, resumeToast } = useNotificationContext();

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
    }
  };

  const groupedByType = activeToasts.reduce((acc: Record<ToastType, ActiveToast[]>, toast) => {
    if (!acc[toast.type]) acc[toast.type] = [];
    acc[toast.type].push(toast);
    return acc;
  }, {} as Record<ToastType, ActiveToast[]>);

  const collapsedTypes = Object.entries(groupedByType).filter(([_, toasts]) => toasts.length > 3);
  
  let visibleToasts = [...activeToasts];
  let collapsedCount = 0;

  collapsedTypes.forEach(([_, toasts]) => {
    if (toasts.length > 3) {
      const hidden = toasts.slice(3);
      visibleToasts = visibleToasts.filter(t => !hidden.some(h => h.id === t.id));
      collapsedCount += hidden.length;
    }
  });

  visibleToasts = visibleToasts.slice(0, maxVisible);

  return (
    <div 
      className={`fixed ${getPositionClasses()} z-[9998] w-96 max-w-[calc(100vw-2rem)] pointer-events-none`}
      data-testid="toast-stack"
    >
      <div className="flex flex-col gap-2 pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {visibleToasts.map((toast, index) => (
            <motion.div
              key={toast.id}
              layout
              style={{
                zIndex: visibleToasts.length - index,
              }}
            >
              <NexusToast
                toast={toast}
                onDismiss={() => dismiss(toast.id)}
                onMouseEnter={() => pauseToast(toast.id)}
                onMouseLeave={() => resumeToast(toast.id)}
              />
            </motion.div>
          ))}
          
          {collapsedCount > 0 && (
            <motion.div
              key="collapsed-indicator"
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="px-4 py-2 rounded-lg bg-muted/80 backdrop-blur-sm border border-white/10 text-sm text-muted-foreground text-center"
              data-testid="toast-collapsed-indicator"
            >
              +{collapsedCount} more notification{collapsedCount > 1 ? 's' : ''}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

ToastStack.displayName = 'ToastStack';
