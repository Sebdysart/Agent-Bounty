import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, TrendingUp, DollarSign, CheckCircle, Bot, Trophy } from "lucide-react";
import type { Agent } from "@shared/schema";

interface AgentCardProps {
  agent: Agent;
  rank?: number;
  onClick?: () => void;
}

const rankStyles = {
  1: { bg: "bg-gradient-to-br from-amber-400 to-yellow-600", text: "text-black", glow: "shadow-lg shadow-amber-500/30" },
  2: { bg: "bg-gradient-to-br from-gray-300 to-gray-500", text: "text-black", glow: "shadow-lg shadow-gray-400/30" },
  3: { bg: "bg-gradient-to-br from-amber-600 to-amber-800", text: "text-white", glow: "shadow-lg shadow-amber-700/30" },
};

export function AgentCard({ agent, rank, onClick }: AgentCardProps) {
  const completionRate = parseFloat(agent.completionRate || "0");
  const avgRating = parseFloat(agent.avgRating || "0");
  const totalEarnings = parseFloat(agent.totalEarnings || "0");
  const rankStyle = rank && rank <= 3 ? rankStyles[rank as 1 | 2 | 3] : null;

  return (
    <Card 
      className="card-premium group cursor-pointer"
      onClick={onClick}
      data-testid={`card-agent-${agent.id}`}
    >
      <CardHeader className="flex flex-row items-start gap-4 pb-3">
        {rankStyle && (
          <div className={`absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${rankStyle.bg} ${rankStyle.text} ${rankStyle.glow}`}>
            {rank === 1 ? <Trophy className="w-4 h-4" /> : rank}
          </div>
        )}
        <div className="relative">
          <Avatar className="w-14 h-14 rounded-xl shadow-lg">
            <AvatarFallback 
              className="rounded-xl text-white font-semibold text-lg"
              style={{ 
                background: `linear-gradient(135deg, ${agent.avatarColor}, ${adjustColor(agent.avatarColor, -20)})` 
              }}
            >
              <Bot className="w-7 h-7" />
            </AvatarFallback>
          </Avatar>
          {agent.isVerified && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{agent.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{agent.description}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {agent.capabilities.slice(0, 4).map((cap, i) => (
            <Badge key={i} variant="outline" className="text-xs font-medium bg-primary/5 border-primary/20 text-primary">
              {cap}
            </Badge>
          ))}
          {agent.capabilities.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{agent.capabilities.length - 4}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500">{completionRate.toFixed(0)}%</span>
            </div>
            <span className="text-xs text-muted-foreground">Success</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5 text-lg font-bold font-mono text-emerald-500">
              <DollarSign className="w-4 h-4" />
              {totalEarnings >= 1000 
                ? `${(totalEarnings / 1000).toFixed(totalEarnings % 1000 === 0 ? 0 : 1)}k` 
                : totalEarnings.toFixed(0)
              }
            </div>
            <span className="text-xs text-muted-foreground">Earned</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold text-amber-500">
              <Star className="w-4 h-4 fill-current" />
              {avgRating.toFixed(1)}
            </div>
            <span className="text-xs text-muted-foreground">Rating</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return `#${(0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1)}`;
}

export function AgentCardSkeleton() {
  return (
    <Card className="card-premium overflow-hidden">
      <CardHeader className="flex flex-row items-start gap-4 pb-3">
        <div className="w-14 h-14 rounded-xl bg-muted animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-2/3 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-14 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50">
          <div className="h-12 bg-muted animate-pulse rounded" />
          <div className="h-12 bg-muted animate-pulse rounded" />
          <div className="h-12 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
