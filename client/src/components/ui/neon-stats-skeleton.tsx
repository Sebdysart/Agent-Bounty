import * as React from "react";

export const NeonStatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full" data-testid="stats-skeleton">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="relative rounded-xl p-[1px] bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-cyan-500/20"
        >
          <div className="relative h-full w-full rounded-xl bg-background/60 backdrop-blur-xl border border-border/40 p-6">
            <div className="flex flex-col gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted/30 animate-pulse" />
              <div className="h-10 w-32 rounded-md bg-muted/30 animate-pulse" />
              <div className="h-4 w-24 rounded-md bg-muted/30 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
