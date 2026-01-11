import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ShieldCheck, Trophy, TrendingUp, Star, Building2, 
  Heart, Sparkles, CheckCircle
} from "lucide-react";
import type { AgentBadge } from "@shared/schema";

const badgeConfig: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  verified_secure: { 
    icon: ShieldCheck, 
    label: "Verified Secure", 
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-500/10"
  },
  top_performer: { 
    icon: Trophy, 
    label: "Top Performer", 
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10"
  },
  trending: { 
    icon: TrendingUp, 
    label: "Trending", 
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-500/10"
  },
  featured: { 
    icon: Star, 
    label: "Featured", 
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10"
  },
  enterprise_ready: { 
    icon: Building2, 
    label: "Enterprise Ready", 
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10"
  },
  community_favorite: { 
    icon: Heart, 
    label: "Community Favorite", 
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10"
  },
  new_release: { 
    icon: Sparkles, 
    label: "New Release", 
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/10"
  },
};

interface BadgeDisplayProps {
  badges: AgentBadge[];
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
}

export function BadgeDisplay({ badges, size = "md", showLabels = false }: BadgeDisplayProps) {
  if (!badges || badges.length === 0) return null;

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="badge-display">
      {badges.map((badge) => {
        const config = badgeConfig[badge.badgeType];
        if (!config) return null;
        
        const Icon = config.icon;
        
        if (showLabels) {
          return (
            <Badge 
              key={badge.id} 
              variant="secondary" 
              className={`gap-1 ${config.bg} ${config.color} border-0`}
              data-testid={`badge-${badge.badgeType}`}
            >
              <Icon className={sizeClasses[size]} />
              {config.label}
            </Badge>
          );
        }
        
        return (
          <Tooltip key={badge.id}>
            <TooltipTrigger>
              <div 
                className={`p-1.5 rounded-md ${config.bg} ${config.color}`}
                data-testid={`badge-icon-${badge.badgeType}`}
              >
                <Icon className={sizeClasses[size]} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{config.label}</p>
              {badge.reason && <p className="text-xs text-muted-foreground">{badge.reason}</p>}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function BadgeIcon({ badgeType, size = "md" }: { badgeType: string; size?: "sm" | "md" | "lg" }) {
  const config = badgeConfig[badgeType];
  if (!config) return null;
  
  const Icon = config.icon;
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };
  
  return (
    <Tooltip>
      <TooltipTrigger>
        <div className={`p-1.5 rounded-md ${config.bg} ${config.color}`}>
          <Icon className={sizeClasses[size]} />
        </div>
      </TooltipTrigger>
      <TooltipContent>{config.label}</TooltipContent>
    </Tooltip>
  );
}
