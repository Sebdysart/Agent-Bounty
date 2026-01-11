import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw, Filter, Wifi, WifiOff } from "lucide-react";
import { NeonActivityItem, type Activity as ActivityType } from "./neon-activity-item";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { ScrollArea } from "./scroll-area";

interface NeonActivityFeedProps {
  limit?: number;
  showFilters?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
}

const activityTypeLabels: Record<string, string> = {
  bounty_created: "New Bounties",
  bounty_funded: "Funded Bounties",
  bounty_completed: "Completed Bounties",
  agent_registered: "New Agents",
  submission_created: "Submissions",
  payment_released: "Payments",
};

export function NeonActivityFeed({
  limit = 15,
  showFilters = true,
  autoRefresh = true,
  refreshInterval = 30000,
  className = "",
}: NeonActivityFeedProps) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const { data: activities = [], isLoading, refetch, isRefetching } = useQuery<ActivityType[]>({
    queryKey: ['/api/activity', limit],
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'activity' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.channel === 'activity' && data.type === 'new_activity') {
          queryClient.invalidateQueries({ queryKey: ['/api/activity'] });
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [queryClient]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  const filteredActivities = filters.size === 0
    ? activities
    : activities.filter(a => filters.has(a.type));

  const toggleFilter = (type: string) => {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 rounded-xl blur-xl opacity-50" />
      
      <div className="relative bg-card/80 backdrop-blur-xl rounded-xl border border-border/50 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Activity Feed</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isConnected ? (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-500" />
                    <span>Live updates</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-amber-500" />
                    <span>Reconnecting...</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showFilters && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className={filters.size > 0 ? "text-violet-500" : ""}
                    data-testid="button-activity-filter"
                  >
                    <Filter className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {Object.entries(activityTypeLabels).map(([type, label]) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={filters.has(type)}
                      onCheckedChange={() => toggleFilter(type)}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefetching}
              data-testid="button-activity-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="p-3 space-y-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-20 bg-muted rounded" />
                      <div className="h-4 w-3/4 bg-muted rounded" />
                      <div className="h-3 w-1/2 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {filters.size > 0 ? "No matching activities" : "No recent activity"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {filters.size > 0 
                    ? "Try adjusting your filters" 
                    : "Activities will appear here as they happen"}
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredActivities.map((activity, index) => (
                  <NeonActivityItem
                    key={activity.id}
                    activity={activity}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        {filteredActivities.length > 0 && (
          <div className="p-3 border-t border-border/50 text-center">
            <span className="text-xs text-muted-foreground">
              Showing {filteredActivities.length} of {activities.length} activities
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
