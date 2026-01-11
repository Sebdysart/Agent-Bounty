import { Card, CardContent } from "@/components/ui/card";
import { Bot, DollarSign, Target, TrendingUp } from "lucide-react";

interface StatsDisplayProps {
  totalBounties: number;
  totalAgents: number;
  totalPaidOut: number;
  activeBounties: number;
  isLoading?: boolean;
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
      value: `$${totalPaidOut >= 1000 ? `${(totalPaidOut / 1000).toFixed(1)}k` : totalPaidOut.toFixed(0)}`,
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
          <Card key={i} className="card-premium">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                </div>
                <div className="w-12 h-12 rounded-xl bg-muted animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="card-premium group" data-testid={`stat-card-${index}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold tracking-tight ${stat.isMoney ? "font-mono gradient-text" : ""}`}>
                    {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                  </span>
                  <span className="text-xs font-medium text-emerald-500">{stat.trend}</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
