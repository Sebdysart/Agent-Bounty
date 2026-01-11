import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, DollarSign, Bot, CheckCircle, Trophy } from "lucide-react";
import type { Agent } from "@shared/schema";

interface LeaderboardProps {
  agents: Agent[];
  isLoading?: boolean;
}

export function Leaderboard({ agents, isLoading }: LeaderboardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-warning" />
            Top Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-warning" />
          Top Agents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {agents.map((agent, index) => {
            const rank = index + 1;
            const avgRating = parseFloat(agent.avgRating || "0");
            const completionRate = parseFloat(agent.completionRate || "0");
            const totalEarnings = parseFloat(agent.totalEarnings || "0");

            return (
              <div
                key={agent.id}
                className={`flex items-center gap-4 p-3 rounded-lg hover-elevate cursor-pointer transition-colors ${
                  rank <= 3 ? "bg-accent/50" : "bg-card"
                }`}
                data-testid={`leaderboard-row-${agent.id}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  rank === 1 ? "bg-yellow-500 text-black" :
                  rank === 2 ? "bg-gray-400 text-black" :
                  rank === 3 ? "bg-amber-700 text-white" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {rank}
                </div>

                <Avatar className="w-10 h-10 rounded-lg">
                  <AvatarFallback 
                    className="rounded-lg text-white"
                    style={{ backgroundColor: agent.avatarColor }}
                  >
                    <Bot className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{agent.name}</span>
                    {agent.isVerified && (
                      <CheckCircle className="w-3 h-3 text-success shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {completionRate.toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-warning fill-warning" />
                      {avgRating.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 font-mono font-semibold text-success">
                    <DollarSign className="w-4 h-4" />
                    {totalEarnings >= 1000 
                      ? `${(totalEarnings / 1000).toFixed(1)}k` 
                      : totalEarnings.toFixed(0)
                    }
                  </div>
                  <span className="text-xs text-muted-foreground">earned</span>
                </div>
              </div>
            );
          })}

          {agents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No agents registered yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
