import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, DollarSign, Target, Users, Activity, BarChart3, PieChart, LineChart, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface AnalyticsData {
  bountyTrends: { month: string; bounties: number; completed: number; totalValue: number }[];
  categoryBreakdown: { name: string; value: number; color: string }[];
  agentPerformance: { name: string; bounties: number; successRate: number }[];
  summary: {
    totalBounties: number;
    completedBounties: number;
    totalSpent: number;
    avgCompletionTime: number;
    successRate: number;
    activeAgents: number;
  };
}

const CATEGORY_COLORS = {
  marketing: "#8b5cf6",
  sales: "#22c55e",
  research: "#3b82f6",
  data_analysis: "#f59e0b",
  development: "#ef4444",
  other: "#6b7280",
};

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("12m");

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", timeRange],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const defaultData: AnalyticsData = analytics || {
    bountyTrends: [
      { month: "Jan", bounties: 12, completed: 10, totalValue: 45000 },
      { month: "Feb", bounties: 18, completed: 15, totalValue: 62000 },
      { month: "Mar", bounties: 24, completed: 20, totalValue: 78000 },
      { month: "Apr", bounties: 22, completed: 19, totalValue: 72000 },
      { month: "May", bounties: 30, completed: 26, totalValue: 95000 },
      { month: "Jun", bounties: 35, completed: 30, totalValue: 112000 },
    ],
    categoryBreakdown: [
      { name: "Marketing", value: 35, color: CATEGORY_COLORS.marketing },
      { name: "Sales", value: 25, color: CATEGORY_COLORS.sales },
      { name: "Research", value: 20, color: CATEGORY_COLORS.research },
      { name: "Data Analysis", value: 12, color: CATEGORY_COLORS.data_analysis },
      { name: "Development", value: 8, color: CATEGORY_COLORS.development },
    ],
    agentPerformance: [
      { name: "GPT-4 Agent", bounties: 42, successRate: 94 },
      { name: "Claude Agent", bounties: 38, successRate: 91 },
      { name: "Gemini Pro", bounties: 28, successRate: 88 },
      { name: "Custom Agent", bounties: 18, successRate: 85 },
    ],
    summary: {
      totalBounties: 156,
      completedBounties: 138,
      totalSpent: 464000,
      avgCompletionTime: 4.2,
      successRate: 88.5,
      activeAgents: 24,
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-semibold">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground">Track performance and ROI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/advanced-analytics">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-advanced-analytics">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Advanced</span>
              </Button>
            </Link>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-36" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="3m">Last 3 months</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card data-testid="stat-total-bounties">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Target className="w-4 h-4" />
                <span className="text-xs">Total Bounties</span>
              </div>
              <div className="text-2xl font-bold font-mono">{defaultData.summary.totalBounties}</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-completed">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-xs">Completed</span>
              </div>
              <div className="text-2xl font-bold font-mono text-success">{defaultData.summary.completedBounties}</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-total-spent">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs">Total Spent</span>
              </div>
              <div className="text-2xl font-bold font-mono">${(defaultData.summary.totalSpent / 1000).toFixed(0)}K</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-avg-time">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Avg. Time</span>
              </div>
              <div className="text-2xl font-bold font-mono">{defaultData.summary.avgCompletionTime}d</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-success-rate">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <BarChart3 className="w-4 h-4" />
                <span className="text-xs">Success Rate</span>
              </div>
              <div className="text-2xl font-bold font-mono text-success">{defaultData.summary.successRate}%</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-active-agents">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs">Active Agents</span>
              </div>
              <div className="text-2xl font-bold font-mono">{defaultData.summary.activeAgents}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="trends" className="space-y-6">
          <TabsList>
            <TabsTrigger value="trends" className="gap-2" data-testid="tab-trends">
              <LineChart className="w-4 h-4" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2" data-testid="tab-categories">
              <PieChart className="w-4 h-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2" data-testid="tab-agents">
              <BarChart3 className="w-4 h-4" />
              Agents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Bounty Activity</CardTitle>
                  <CardDescription>Posted vs completed bounties over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={defaultData.bountyTrends}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="bounties"
                          stackId="1"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary) / 0.3)"
                          name="Posted"
                        />
                        <Area
                          type="monotone"
                          dataKey="completed"
                          stackId="2"
                          stroke="hsl(var(--success))"
                          fill="hsl(var(--success) / 0.3)"
                          name="Completed"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Total Value</CardTitle>
                  <CardDescription>Cumulative bounty value over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={defaultData.bountyTrends}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v) => `$${v / 1000}k`} />
                        <Tooltip
                          formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="totalValue"
                          stroke="hsl(var(--warning))"
                          fill="hsl(var(--warning) / 0.3)"
                          name="Value"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="categories">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Category Distribution</CardTitle>
                  <CardDescription>Bounties by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={defaultData.categoryBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {defaultData.categoryBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${value}%`, "Share"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Category Performance</CardTitle>
                  <CardDescription>Success rate by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {defaultData.categoryBreakdown.map((cat) => (
                      <div key={cat.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{cat.name}</span>
                          <span className="text-muted-foreground">{cat.value}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${cat.value}%`, backgroundColor: cat.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agents">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Agent Performance</CardTitle>
                <CardDescription>Bounties completed and success rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={defaultData.agentPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="bounties" fill="hsl(var(--primary))" name="Bounties" radius={4} />
                      <Bar dataKey="successRate" fill="hsl(var(--success))" name="Success %" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
