import { useState, useEffect, useRef } from "react";
import { Bell, X, CheckCircle, AlertCircle, Info, Zap, Bot, DollarSign, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWebSocket } from "@/hooks/use-websocket.tsx";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  icon: string;
  link?: string;
}

const iconMap: Record<string, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  agent: Bot,
  payment: DollarSign,
  achievement: Trophy,
  test: Zap,
};

const colorMap: Record<string, string> = {
  success: "text-green-500",
  error: "text-red-500",
  info: "text-blue-500",
  agent: "text-purple-500",
  payment: "text-emerald-500",
  achievement: "text-amber-500",
  test: "text-cyan-500",
};

function formatNotificationType(type: string): { title: string; icon: string; } {
  switch (type) {
    case "submission_update":
      return { title: "Submission Update", icon: "info" };
    case "bounty_update":
      return { title: "Bounty Update", icon: "info" };
    case "payment_update":
      return { title: "Payment Update", icon: "payment" };
    case "agent_test_complete":
      return { title: "Agent Test Complete", icon: "test" };
    case "new_submission":
      return { title: "New Submission", icon: "success" };
    case "review_received":
      return { title: "Review Received", icon: "success" };
    case "agent_published":
      return { title: "Agent Published", icon: "agent" };
    default:
      return { title: "Notification", icon: "info" };
  }
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const { isConnected, addMessageHandler, removeMessageHandler, subscribe, unsubscribe } = useWebSocket();
  const handlerId = useRef(`notification-bell-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const id = handlerId.current;
    
    subscribe("notifications", id);
    
    addMessageHandler(id, (data) => {
      if (data.type === "ping" || data.type === "pong") return;
      
      const { title, icon } = formatNotificationType(data.type);
      
      const notification: Notification = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: data.type,
        title,
        message: data.message || getDefaultMessage(data),
        timestamp: new Date(),
        read: false,
        icon,
        link: data.link,
      };
      
      setNotifications(prev => [notification, ...prev].slice(0, 50));
    });
    
    return () => {
      unsubscribe("notifications", id);
      removeMessageHandler(id);
    };
  }, [addMessageHandler, removeMessageHandler, subscribe, unsubscribe]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getDefaultMessage = (data: any): string => {
    switch (data.type) {
      case "submission_update":
        return `Submission status changed to ${data.status}`;
      case "bounty_update":
        return `Bounty has been updated`;
      case "payment_update":
        return `Payment status: ${data.status}`;
      case "agent_test_complete":
        return `Test ${data.status === "passed" ? "passed" : "failed"}`;
      case "new_submission":
        return "A new submission was received";
      case "review_received":
        return "You received a new review";
      case "agent_published":
        return "Your agent is now live on the marketplace";
      default:
        return "You have a new notification";
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          {isConnected && (
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex gap-1">
            {notifications.length > 0 && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  className="text-xs h-7"
                  data-testid="button-mark-all-read"
                >
                  Mark all read
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearAll}
                  className="text-xs h-7"
                  data-testid="button-clear-all"
                >
                  Clear
                </Button>
              </>
            )}
          </div>
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs mt-1">Real-time updates will appear here</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = iconMap[notification.icon] || Info;
                const color = colorMap[notification.icon] || "text-muted-foreground";
                
                return (
                  <div
                    key={notification.id}
                    className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                      !notification.read ? "bg-primary/5" : ""
                    }`}
                    onClick={() => markAsRead(notification.id)}
                    data-testid={`notification-${notification.id}`}
                  >
                    <div className="flex gap-3">
                      <div className={`shrink-0 ${color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">{notification.title}</p>
                          {!notification.read && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        {isConnected && (
          <div className="p-2 border-t text-center">
            <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Live updates active
            </span>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
