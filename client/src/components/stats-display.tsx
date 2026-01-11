import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Bot, DollarSign, Target, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface StatsDisplayProps {
  totalBounties: number;
  totalAgents: number;
  totalPaidOut: number;
  activeBounties: number;
  isLoading?: boolean;
}

function CountUp({ end, duration = 2000, prefix = "", suffix = "" }: { end: number; duration?: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);
  
  return <>{prefix}{count.toLocaleString()}{suffix}</>;
}

export function StatsDisplay({ 
  totalBounties, 
  totalAgents, 
  totalPaidOut, 
  activeBounties,
  isLoading 
}: StatsDisplayProps) {
  const stats = [
    {
      label: "Active Bounties",
      value: activeBounties,
      icon: Target,
      gradient: "from-violet-500 to-purple-600",
      trend: "+12%",
    },
    {
      label: "Registered Agents",
      value: totalAgents,
      icon: Bot,
      gradient: "from-cyan-500 to-blue-600",
      trend: "+8%",
    },
    {
      label: "Total Bounties",
      value: totalBounties,
      icon: TrendingUp,
      gradient: "from-orange-500 to-amber-600",
      trend: "+24%",
    },
    {
      label: "Total Paid Out",
      value: totalPaidOut,
      icon: DollarSign,
      gradient: "from-emerald-500 to-green-600",
      isMoney: true,
      trend: "+18%",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="relative rounded-[1.25rem] border-[0.75px] border-border p-2">
            <Card className="card-premium">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="h-4 w-20 bg-gradient-to-r from-muted to-muted/50 animate-pulse rounded" />
                    <div className="h-8 w-16 bg-gradient-to-r from-muted to-muted/50 animate-pulse rounded" />
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-muted to-muted/50 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
          className="relative rounded-[1.25rem] border-[0.75px] border-border p-2"
        >
          <GlowingEffect
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
            borderWidth={2}
          />
          <Card className="relative card-premium group overflow-hidden" data-testid={`stat-card-${index}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold tracking-tight ${stat.isMoney ? "font-mono gradient-text" : ""}`}>
                      {stat.isMoney ? (
                        <CountUp 
                          end={stat.value} 
                          prefix="$" 
                          suffix={stat.value >= 1000 ? "" : ""}
                        />
                      ) : (
                        <CountUp end={stat.value} />
                      )}
                      {stat.isMoney && stat.value >= 1000 && (
                        <span className="text-lg">k</span>
                      )}
                    </span>
                    <motion.span 
                      className="text-xs font-medium text-emerald-500"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                    >
                      {stat.trend}
                    </motion.span>
                  </div>
                </div>
                <motion.div 
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <stat.icon className="w-6 h-6 text-white" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
