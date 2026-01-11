import * as React from "react";
import { motion } from "framer-motion";
import { Trophy, DollarSign, Users, TrendingUp, AlertCircle } from "lucide-react";
import { usePlatformStats } from "@/hooks/use-platform-stats";
import { NeonStatCard } from "@/components/ui/neon-stats-card";
import { NeonStatsSkeleton } from "@/components/ui/neon-stats-skeleton";
import { Button } from "@/components/ui/button";

export type NeonStatsHeroProps = {
  endpoint?: string;
  title?: string;
  subtitle?: string;
  reanimateOnHover?: boolean;
  showBackgroundFX?: boolean;
  pollingMs?: number;
};

export const NeonStatsHero: React.FC<NeonStatsHeroProps> = ({
  endpoint = "/api/stats",
  title = "Platform Overview",
  subtitle,
  reanimateOnHover = false,
  showBackgroundFX = false,
  pollingMs = 0,
}) => {
  const statsQuery = usePlatformStats(endpoint, pollingMs);

  const stats = React.useMemo(() => {
    if (statsQuery.status !== "success") return null;

    return [
      {
        icon: Trophy,
        value: statsQuery.data.totalBounties,
        label: "Total Bounties",
        format: "number" as const,
      },
      {
        icon: DollarSign,
        value: statsQuery.data.rewardsDistributedUsd,
        label: "Rewards Distributed",
        format: "currency" as const,
      },
      {
        icon: Users,
        value: statsQuery.data.activeAgents,
        label: "Active Agents",
        format: "number" as const,
      },
      {
        icon: TrendingUp,
        value: statsQuery.data.successRate,
        label: "Success Rate",
        format: "percentage" as const,
      },
    ];
  }, [statsQuery]);

  return (
    <section className="relative w-full py-8 px-4 lg:px-6" aria-labelledby="stats-heading" data-testid="neon-stats-hero">
      {showBackgroundFX && (
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl" />
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 text-center"
        >
          <h2
            id="stats-heading"
            className="text-2xl lg:text-3xl font-bold text-foreground mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-muted-foreground text-base">{subtitle}</p>
          )}
        </motion.div>

        {statsQuery.status === "loading" && <NeonStatsSkeleton />}

        {statsQuery.status === "success" && stats && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            role="region"
            aria-live="polite"
            aria-label="Platform statistics"
            data-testid="stats-grid"
          >
            {stats.map((stat, index) => (
              <NeonStatCard
                key={stat.label}
                icon={stat.icon}
                value={stat.value}
                label={stat.label}
                format={stat.format}
                index={index}
                reanimateOnHover={reanimateOnHover}
                updatedAt={statsQuery.data.updatedAt}
              />
            ))}
          </div>
        )}

        {statsQuery.status === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-4 p-12 rounded-xl bg-background/60 backdrop-blur-xl border border-border/40"
            data-testid="stats-error"
          >
            <AlertCircle className="w-12 h-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Unable to load stats
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {statsQuery.error}
              </p>
              <Button onClick={statsQuery.retry} variant="outline" data-testid="button-retry-stats">
                Retry
              </Button>
            </div>
            {statsQuery.lastKnownData && (
              <p className="text-xs text-muted-foreground/60 mt-2">
                Last known values available
              </p>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
};
