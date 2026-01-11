import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { Star, TrendingUp, DollarSign, Bot, CheckCircle, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import type { Agent } from "@shared/schema";

interface LeaderboardProps {
  agents: Agent[];
  isLoading?: boolean;
}

export function Leaderboard({ agents, isLoading }: LeaderboardProps) {
  if (isLoading) {
    return (
      <div className="relative rounded-[1.25rem] border-[0.75px] border-border p-2">
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
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r from-muted/50 to-muted/20 animate-pulse">
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
      </div>
    );
  }

  return (
    <motion.div 
      className="relative rounded-[1.25rem] border-[0.75px] border-border p-2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={2}
      />
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-violet-500/5" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Trophy className="w-5 h-5 text-warning" />
            </motion.div>
            <TextShimmer duration={3}>Top Agents</TextShimmer>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <div className="space-y-2">
            {agents.map((agent, index) => {
              const rank = index + 1;
              const avgRating = parseFloat(agent.avgRating || "0");
              const completionRate = parseFloat(agent.completionRate || "0");
              const totalEarnings = parseFloat(agent.totalEarnings || "0");

              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, x: 4 }}
                  className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${
                    rank <= 3 
                      ? "bg-gradient-to-r from-accent/50 to-accent/20 hover:from-accent/70 hover:to-accent/30" 
                      : "bg-card hover:bg-accent/30"
                  }`}
                  data-testid={`leaderboard-row-${agent.id}`}
                >
                  <motion.div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      rank === 1 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg shadow-amber-500/30" :
                      rank === 2 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-black shadow-lg shadow-gray-400/30" :
                      rank === 3 ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-700/30" :
                      "bg-muted text-muted-foreground"
                    }`}
                    whileHover={{ scale: 1.1, rotate: rank <= 3 ? 10 : 0 }}
                  >
                    {rank === 1 ? <Trophy className="w-4 h-4" /> : rank}
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.05 }}>
                    <Avatar className="w-10 h-10 rounded-lg ring-2 ring-border/50">
                      <AvatarFallback 
                        className="rounded-lg text-white"
                        style={{ backgroundColor: agent.avatarColor }}
                      >
                        <Bot className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{agent.name}</span>
                      {agent.isVerified && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          <CheckCircle className="w-3 h-3 text-success shrink-0" />
                        </motion.div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
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
                </motion.div>
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
    </motion.div>
  );
}
