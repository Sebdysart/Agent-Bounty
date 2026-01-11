import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, XCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { ActiveToast } from './notification.types';
import { getTypeGradient, getTypeBorderColor } from './notification.utils';
import { Button } from '@/components/ui/button';

type NexusToastProps = {
  toast: ActiveToast;
  onDismiss: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export function NexusToast({ toast, onDismiss, onMouseEnter, onMouseLeave }: NexusToastProps) {
  const [progress, setProgress] = useState(100);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!toast.duration || toast.duration === 0 || toast.isPaused) {
      return;
    }

    const startTime = Date.now();
    const endTime = startTime + toast.remainingDuration;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = endTime - now;
      const percentage = (remaining / toast.remainingDuration) * 100;
      
      if (percentage <= 0) {
        setProgress(0);
        clearInterval(interval);
      } else {
        setProgress(percentage);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [toast.duration, toast.remainingDuration, toast.isPaused]);

  const handleAction = async () => {
    if (!toast.action || actionLoading) return;
    
    setActionLoading(true);
    try {
      await toast.action.onClick();
    } finally {
      setActionLoading(false);
    }
  };

  const getDefaultIcon = () => {
    if (toast.icon) return toast.icon;
    
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-violet-500" />;
      case 'loading':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="relative w-full"
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      data-testid={`toast-${toast.type}-${toast.id}`}
    >
      <div
        className={`
          relative overflow-hidden rounded-lg border border-white/10
          bg-background/80 backdrop-blur-xl shadow-lg
          ${getTypeBorderColor(toast.type)} border-l-4
        `}
      >
        <div className="p-4 flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getDefaultIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground text-sm">
              {toast.title}
            </div>
            {toast.description && (
              <div className="mt-1 text-sm text-muted-foreground">
                {toast.description}
              </div>
            )}
            {toast.action && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAction}
                  disabled={actionLoading}
                  className="h-7 text-xs"
                  data-testid={`toast-action-${toast.id}`}
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    toast.action.label
                  )}
                </Button>
              </div>
            )}
          </div>
          
          {toast.dismissible && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss notification"
              data-testid={`toast-dismiss-${toast.id}`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {toast.duration && toast.duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/20">
            <div
              className={`h-full bg-gradient-to-r ${getTypeGradient(toast.type)} transition-all duration-100 ease-linear`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
