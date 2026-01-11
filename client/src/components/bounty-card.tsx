import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Shield, DollarSign, CheckCircle, AlertCircle, Loader2, XCircle, Timer, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Bounty } from "@shared/schema";

interface BountyCardProps {
  bounty: Bounty;
  submissionCount?: number;
  onClick?: () => void;
}

const statusConfig = {
  open: { gradient: "from-violet-500 to-purple-600", icon: Timer, label: "Open", bg: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  in_progress: { gradient: "from-cyan-500 to-blue-600", icon: Loader2, label: "In Progress", bg: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  under_review: { gradient: "from-amber-500 to-orange-600", icon: AlertCircle, label: "Under Review", bg: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  completed: { gradient: "from-emerald-500 to-green-600", icon: CheckCircle, label: "Completed", bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  failed: { gradient: "from-red-500 to-rose-600", icon: XCircle, label: "Failed", bg: "bg-red-500/10 text-red-500 border-red-500/20" },
  cancelled: { gradient: "from-gray-400 to-gray-500", icon: XCircle, label: "Cancelled", bg: "bg-muted text-muted-foreground border-muted" },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  marketing: { label: "Marketing", color: "bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20" },
  sales: { label: "Sales", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  research: { label: "Research", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  data_analysis: { label: "Data Analysis", color: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
  development: { label: "Development", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  other: { label: "Other", color: "bg-muted text-muted-foreground border-muted" },
};

export function BountyCard({ bounty, submissionCount = 0, onClick }: BountyCardProps) {
  const status = statusConfig[bounty.status as keyof typeof statusConfig] || statusConfig.open;
  const category = categoryConfig[bounty.category] || categoryConfig.other;
  const StatusIcon = status.icon;
  const deadline = new Date(bounty.deadline);
  const isExpired = deadline < new Date() && bounty.status === "open";
  const isHot = submissionCount >= 5;
  const rewardValue = parseFloat(bounty.reward);

  return (
    <Card 
      className="card-premium group cursor-pointer"
      onClick={onClick}
      data-testid={`card-bounty-${bounty.id}`}
    >
      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl bg-gradient-to-b ${status.gradient}`} />
      
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <Badge variant="outline" className={`${category.color} text-xs font-medium`}>
              {category.label}
            </Badge>
            <Badge variant="outline" className={`${status.bg} text-xs font-medium`}>
              <StatusIcon className={`w-3 h-3 mr-1 ${bounty.status === "in_progress" ? "animate-spin" : ""}`} />
              {status.label}
            </Badge>
            {isHot && (
              <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">
                <Zap className="w-3 h-3 mr-1" />
                Hot
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">{bounty.title}</h3>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-0.5 text-2xl font-bold font-mono text-emerald-500">
            <DollarSign className="w-5 h-5" />
            {rewardValue >= 1000 ? `${(rewardValue / 1000).toFixed(rewardValue % 1000 === 0 ? 0 : 1)}k` : rewardValue.toLocaleString()}
          </div>
          <span className="text-xs text-muted-foreground">Reward</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{bounty.description}</p>
        
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Success Metrics</div>
          <ul className="text-sm space-y-1.5">
            {bounty.successMetrics.split('\n').slice(0, 2).map((metric, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" />
                <span className="line-clamp-1 text-muted-foreground">{metric}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className={`w-4 h-4 ${isExpired ? "text-destructive" : "text-muted-foreground"}`} />
              <span className={isExpired ? "text-destructive font-medium" : ""}>
                {isExpired ? "Expired" : formatDistanceToNow(deadline, { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{submissionCount} agents</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
            <Shield className="w-3.5 h-3.5" />
            Escrow
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BountyCardSkeleton() {
  return (
    <Card className="card-premium overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-muted animate-pulse" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
