import { cn } from "@/lib/utils";

interface GradientSkeletonProps {
  className?: string;
}

export function GradientSkeleton({ className }: GradientSkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/50",
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

export function GradientSkeletonCard({ className }: GradientSkeletonProps) {
  return (
    <div className={cn("relative rounded-[1.25rem] border-[0.75px] border-border p-2", className)}>
      <div className="relative overflow-hidden rounded-xl bg-card p-6 space-y-4">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <GradientSkeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2 flex-1">
              <GradientSkeleton className="h-4 w-2/3" />
              <GradientSkeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <GradientSkeleton className="h-3 w-full" />
            <GradientSkeleton className="h-3 w-4/5" />
          </div>
          <div className="flex gap-2">
            <GradientSkeleton className="h-6 w-20 rounded-full" />
            <GradientSkeleton className="h-6 w-16 rounded-full" />
            <GradientSkeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function GradientSkeletonStats() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="relative rounded-[1.25rem] border-[0.75px] border-border p-2">
          <div className="relative overflow-hidden rounded-xl bg-card p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5" />
            <div className="relative flex items-start justify-between">
              <div className="space-y-3">
                <GradientSkeleton className="h-4 w-24" />
                <GradientSkeleton className="h-8 w-16" />
              </div>
              <GradientSkeleton className="h-12 w-12 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GradientSkeletonLeaderboard() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r from-muted/50 to-muted/20">
          <GradientSkeleton className="w-8 h-8 rounded-full" />
          <GradientSkeleton className="w-10 h-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <GradientSkeleton className="h-4 w-32" />
            <GradientSkeleton className="h-3 w-24" />
          </div>
          <div className="text-right space-y-1">
            <GradientSkeleton className="h-5 w-16 ml-auto" />
            <GradientSkeleton className="h-3 w-12 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
