import * as React from "react";

export type PlatformStats = {
  totalBounties: number;
  rewardsDistributedUsd: number;
  activeAgents: number;
  successRate: number;
  updatedAt?: string;
};

type StatsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: PlatformStats }
  | { status: "error"; error: string; lastKnownData?: PlatformStats };

let statsCache: { data: PlatformStats; timestamp: number } | null = null;
const CACHE_TTL = 60000;

export const usePlatformStats = (
  endpoint: string = "/api/stats",
  pollingMs: number = 0
) => {
  const [state, setState] = React.useState<StatsState>({ status: "idle" });
  const pollingRef = React.useRef<number | null>(null);
  const mountedRef = React.useRef<boolean>(true);

  const fetchStats = React.useCallback(async (): Promise<PlatformStats> => {
    const now = Date.now();
    if (statsCache && now - statsCache.timestamp < CACHE_TTL) {
      return statsCache.data;
    }

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    }

    const data = await response.json();

    const totalBounties = data.totalBounties ?? 0;
    const activeBounties = typeof data.activeBounties === "number" ? data.activeBounties : 0;
    const completedBounties = totalBounties - activeBounties;
    const calculatedSuccessRate = totalBounties > 0 
      ? Math.round((completedBounties / totalBounties) * 100 * 10) / 10 
      : 0;

    const normalized: PlatformStats = {
      totalBounties,
      rewardsDistributedUsd: data.rewardsDistributedUsd ?? data.totalPaidOut ?? 0,
      activeAgents: data.activeAgents ?? data.totalAgents ?? 0,
      successRate: data.successRate ?? calculatedSuccessRate,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };

    statsCache = { data: normalized, timestamp: now };
    return normalized;
  }, [endpoint]);

  const retry = React.useCallback(() => {
    setState({ status: "loading" });

    fetchStats()
      .then((data) => {
        if (mountedRef.current) {
          setState({ status: "success", data });
        }
      })
      .catch((error) => {
        if (mountedRef.current) {
          const lastKnownData =
            state.status === "success" ? state.data : undefined;
          setState({
            status: "error",
            error: error.message || "Unable to load platform stats",
            lastKnownData,
          });
        }
      });
  }, [fetchStats, state]);

  React.useEffect(() => {
    mountedRef.current = true;
    setState({ status: "loading" });

    fetchStats()
      .then((data) => {
        if (mountedRef.current) {
          setState({ status: "success", data });
        }
      })
      .catch((error) => {
        if (mountedRef.current) {
          setState({
            status: "error",
            error: error.message || "Unable to load platform stats",
          });
        }
      });

    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchStats]);

  React.useEffect(() => {
    if (pollingMs > 0 && state.status === "success") {
      pollingRef.current = window.setInterval(() => {
        fetchStats()
          .then((data) => {
            if (mountedRef.current) {
              setState({ status: "success", data });
            }
          })
          .catch(() => {
          });
      }, pollingMs);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [pollingMs, state.status, fetchStats]);

  return { ...state, retry };
};
