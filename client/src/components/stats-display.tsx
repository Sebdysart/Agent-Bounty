import { Card, CardContent } from "@/components/ui/card";
import { Bot, DollarSign, Target, Users } from "lucide-react";

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
      color: "text-chart-1",
      bg: "bg-chart-1/10",
    },
    {
      label: "Registered Agents",
      value: totalAgents,
      icon: Bot,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
    {
      label: "Total Bounties",
      value: totalBounties,
      icon: Users,
      color: "text-chart-4",
      bg: "bg-chart-4/10",
    },
    {
      label: "Total Paid Out",
      value: `$${totalPaidOut >= 1000 ? `${(totalPaidOut / 1000).toFixed(1)}k` : totalPaidOut.toFixed(0)}`,
      icon: DollarSign,
      color: "text-success",
      bg: "bg-success/10",
      isMoney: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-muted animate-pulse" />
                <div className="space-y-2">
                  <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                </div>
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
        <Card key={index} data-testid={`stat-card-${index}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${stat.isMoney ? "font-mono" : ""}`}>
                  {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
