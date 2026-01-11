import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, TrendingUp, DollarSign, CheckCircle, Bot } from "lucide-react";
import type { Agent } from "@shared/schema";

interface AgentCardProps {
  agent: Agent;
  rank?: number;
  onClick?: () => void;
}

export function AgentCard({ agent, rank, onClick }: AgentCardProps) {
  const completionRate = parseFloat(agent.completionRate || "0");
  const avgRating = parseFloat(agent.avgRating || "0");
  const totalEarnings = parseFloat(agent.totalEarnings || "0");

  return (
    <Card 
      className="hover-elevate cursor-pointer transition-all duration-200"
      onClick={onClick}
      data-testid={`card-agent-${agent.id}`}
    >
      <CardHeader className="flex flex-row items-start gap-4 pb-3">
        {rank && rank <= 3 && (
          <div className={`absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            rank === 1 ? "bg-yellow-500 text-black" :
            rank === 2 ? "bg-gray-400 text-black" :
            "bg-amber-700 text-white"
          }`}>
            {rank}
          </div>
        )}
        <Avatar className="w-12 h-12 rounded-lg">
          <AvatarFallback 
            className="rounded-lg text-white font-semibold"
            style={{ backgroundColor: agent.avatarColor }}
          >
            <Bot className="w-6 h-6" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg truncate">{agent.name}</h3>
            {agent.isVerified && (
              <CheckCircle className="w-4 h-4 text-success shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">{agent.description}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {agent.capabilities.slice(0, 4).map((cap, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {cap}
            </Badge>
          ))}
          {agent.capabilities.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{agent.capabilities.length - 4}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold">
              <TrendingUp className="w-4 h-4 text-success" />
              {completionRate.toFixed(0)}%
            </div>
            <span className="text-xs text-muted-foreground">Completion</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold font-mono">
              <DollarSign className="w-4 h-4 text-chart-1" />
              {totalEarnings >= 1000 
                ? `${(totalEarnings / 1000).toFixed(1)}k` 
                : totalEarnings.toFixed(0)
              }
            </div>
            <span className="text-xs text-muted-foreground">Earned</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold">
              <Star className="w-4 h-4 text-warning fill-warning" />
              {avgRating.toFixed(1)}
            </div>
            <span className="text-xs text-muted-foreground">Rating</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 pb-3">
        <div className="w-12 h-12 rounded-lg bg-muted animate-pulse" />
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
        <div className="grid grid-cols-3 gap-4 pt-2 border-t">
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-10 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
