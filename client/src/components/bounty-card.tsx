import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Users, Shield, DollarSign, CheckCircle, AlertCircle, Loader2, XCircle, Timer } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Bounty } from "@shared/schema";

interface BountyCardProps {
  bounty: Bounty;
  submissionCount?: number;
  onClick?: () => void;
}

const statusConfig = {
  open: { color: "border-l-primary", icon: Timer, label: "Open", bg: "bg-primary/10 text-primary" },
  in_progress: { color: "border-l-info", icon: Loader2, label: "In Progress", bg: "bg-info/10 text-info" },
  under_review: { color: "border-l-warning", icon: AlertCircle, label: "Under Review", bg: "bg-warning/10 text-warning" },
  completed: { color: "border-l-success", icon: CheckCircle, label: "Completed", bg: "bg-success/10 text-success" },
  failed: { color: "border-l-destructive", icon: XCircle, label: "Failed", bg: "bg-destructive/10 text-destructive" },
  cancelled: { color: "border-l-muted", icon: XCircle, label: "Cancelled", bg: "bg-muted text-muted-foreground" },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  marketing: { label: "Marketing", color: "bg-chart-1/10 text-chart-1" },
  sales: { label: "Sales", color: "bg-chart-2/10 text-chart-2" },
  research: { label: "Research", color: "bg-chart-3/10 text-chart-3" },
  data_analysis: { label: "Data Analysis", color: "bg-chart-4/10 text-chart-4" },
  development: { label: "Development", color: "bg-chart-5/10 text-chart-5" },
  other: { label: "Other", color: "bg-muted text-muted-foreground" },
};

export function BountyCard({ bounty, submissionCount = 0, onClick }: BountyCardProps) {
  const status = statusConfig[bounty.status as keyof typeof statusConfig] || statusConfig.open;
  const category = categoryConfig[bounty.category] || categoryConfig.other;
  const StatusIcon = status.icon;
  const deadline = new Date(bounty.deadline);
  const isExpired = deadline < new Date() && bounty.status === "open";

  return (
    <Card 
      className={`hover-elevate cursor-pointer border-l-4 ${status.color} transition-all duration-200`}
      onClick={onClick}
      data-testid={`card-bounty-${bounty.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="secondary" className={`${category.color} text-xs`}>
              {category.label}
            </Badge>
            <Badge variant="secondary" className={`${status.bg} text-xs`}>
              <StatusIcon className={`w-3 h-3 mr-1 ${bounty.status === "in_progress" ? "animate-spin" : ""}`} />
              {status.label}
            </Badge>
          </div>
          <h3 className="font-semibold text-lg leading-tight line-clamp-2">{bounty.title}</h3>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 text-2xl font-bold font-mono text-success">
            <DollarSign className="w-5 h-5" />
            {parseFloat(bounty.reward).toLocaleString()}
          </div>
          <span className="text-xs text-muted-foreground">Bounty</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{bounty.description}</p>
        
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Success Metrics</div>
          <ul className="text-sm space-y-1">
            {bounty.successMetrics.split('\n').slice(0, 2).map((metric, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="w-3 h-3 mt-1 text-success shrink-0" />
                <span className="line-clamp-1">{metric}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className={`w-4 h-4 ${isExpired ? "text-destructive" : ""}`} />
              <span className={isExpired ? "text-destructive" : ""}>
                {isExpired ? "Expired" : formatDistanceToNow(deadline, { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{submissionCount} agents</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Shield className="w-3 h-3 text-success" />
            Escrow Protected
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BountyCardSkeleton() {
  return (
    <Card className="border-l-4 border-l-muted">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-4 w-full bg-muted animate-pulse rounded" />
        <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
