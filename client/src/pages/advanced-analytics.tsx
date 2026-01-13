import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Target, Users, Activity, 
  BarChart3, LineChart, Award, Zap, ArrowUpRight, ArrowDownRight, Trophy,
  Loader2, Star, Percent
} from "lucide-react";
import { Link } from "wouter";
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Line,
  Legend,
} from "recharts";

interface AdvancedAnalyticsData {
  periodComparison: {
    bounties: { current: number; previous: number; growth: number };
    agents: { current: number; previous: number; growth: number };
    submissions: { current: number; previous: number; growth: number };
  };
  dailyActivity: { date: string; bounties: number; value: number }[];
}

interface AgentPerformanceData {
  topPerformers: {
    id: number;
    name: string;
    completionRate: number;
    avgRating: number;
    totalBounties: number;
    totalEarnings: number;
    capabilities: string[];
    avatarColor: string;
  }[];
  performanceDistribution: { range: string; count: number }[];
  averages: { completionRate: number; rating: string };
  totalAgents: number;
}

interface ROIData {
  summary: {
    totalInvested: number;
    estimatedValue: number;
    roi: number;
    completedBounties: number;
  };
  categoryROI: {
    category: string;
    invested: number;
    estimatedReturn: number;
    roi: number;
    count: number;
  }[];
  monthlyROI: { month: string; invested: number; returned: number }[];
}

interface BenchmarkData {
  platformBenchmarks: {
    avgCompletionRate: number;
    avgRating: number;
    avgBountiesPerAgent: number;
    topPercentileRate: number;
  };
  capabilityBenchmarks: {
    capability: string;
    avgRate: number;
    topRate: number;
    agentCount: number;
  }[];
  agentRankings: {
    id: number;
    name: string;
    completionRate: number;
    rating: number;
    bounties: number;
    score: number;
    rank: number;
  }[];
}

function GrowthIndicator({ value, size = "default" }: { value: number; size?: "default" | "sm" }) {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const sizeClasses = size === "sm" ? "text-xs" : "text-sm";
  
  return (
    <div className={`flex items-center gap-1 ${isPositive ? "text-emerald-500" : "text-red-500"} ${sizeClasses}`}>
      <Icon className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      <span className="font-medium">{isPositive ? "+" : ""}{value}%</span>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  growth, 
  icon: Icon,
  gradient
}: { 
  title: string; 
  value: string | number; 
  growth?: number; 
  icon: any;
  gradient: string;
}) {
  return (
    <Card className="hover-elevate" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold font-mono">{value}</p>
            {growth !== undefined && <GrowthIndicator value={growth} size="sm" />}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${gradient}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdvancedAnalyticsPage() {
  const { data: advanced, isLoading: advLoading } = useQuery<AdvancedAnalyticsData>({
    queryKey: ["/api/analytics/advanced"],
  });

  const { data: performance, isLoading: perfLoading } = useQuery<AgentPerformanceData>({
    queryKey: ["/api/analytics/agent-performance"],
  });

  const { data: roi, isLoading: roiLoading } = useQuery<ROIData>({
    queryKey: ["/api/analytics/roi"],
  });

  const { data: benchmarks, isLoading: benchLoading } = useQuery<BenchmarkData>({
    queryKey: ["/api/analytics/benchmarks"],
  });

  const isLoading = advLoading || perfLoading || roiLoading || benchLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

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
              <h1 className="font-semibold font-display">Advanced Analytics</h1>
              <p className="text-sm text-muted-foreground">Performance Metrics, Benchmarking & ROI</p>
            </div>
          </div>
          <Badge className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white">
            Enterprise
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Bounties (30d)" 
            value={advanced?.periodComparison.bounties.current || 0}
            growth={advanced?.periodComparison.bounties.growth}
            icon={Target}
            gradient="bg-gradient-to-br from-violet-500 to-fuchsia-500"
          />
          <StatCard 
            title="New Agents (30d)" 
            value={advanced?.periodComparison.agents.current || 0}
            growth={advanced?.periodComparison.agents.growth}
            icon={Users}
            gradient="bg-gradient-to-br from-cyan-500 to-blue-500"
          />
          <StatCard 
            title="Submissions (30d)" 
            value={advanced?.periodComparison.submissions.current || 0}
            growth={advanced?.periodComparison.submissions.growth}
            icon={Activity}
            gradient="bg-gradient-to-br from-emerald-500 to-green-500"
          />
          <StatCard 
            title="Total ROI" 
            value={`${roi?.summary.roi || 0}%`}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-amber-500 to-orange-500"
          />
        </div>

        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="performance" className="gap-2" data-testid="tab-performance">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="benchmarks" className="gap-2" data-testid="tab-benchmarks">
              <Award className="w-4 h-4" />
              <span className="hidden sm:inline">Benchmarks</span>
            </TabsTrigger>
            <TabsTrigger value="roi" className="gap-2" data-testid="tab-roi">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">ROI</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2" data-testid="tab-activity">
              <LineChart className="w-4 h-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Top Performing Agents
                  </CardTitle>
                  <CardDescription>Agents ranked by completion rate and earnings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {performance?.topPerformers.map((agent, i) => (
                      <div 
                        key={agent.id} 
                        className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover-elevate"
                        data-testid={`performer-${agent.id}`}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-bold text-sm">
                          {i + 1}
                        </div>
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: agent.avatarColor || "#8B5CF6" }}
                        >
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{agent.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{agent.totalBounties} bounties</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              {agent.avgRating.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-emerald-500">
                            {formatCurrency(agent.totalEarnings)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {agent.completionRate}% success
                          </p>
                        </div>
                      </div>
                    ))}
                    {(!performance?.topPerformers || performance.topPerformers.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        No agent performance data yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-cyan-500" />
                    Success Rate Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {performance?.performanceDistribution.map((dist) => (
                      <div key={dist.range}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{dist.range}</span>
                          <span className="font-medium">{dist.count} agents</span>
                        </div>
                        <Progress 
                          value={performance?.totalAgents ? (dist.count / performance.totalAgents) * 100 : 0} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Completion Rate</span>
                      <span className="font-mono font-bold">{performance?.averages.completionRate || 0}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Rating</span>
                      <span className="font-mono font-bold">{performance?.averages.rating || "0.0"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="benchmarks" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Benchmarks</CardTitle>
                  <CardDescription>Overall platform performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-3xl font-bold font-mono text-violet-500">
                        {Math.round(benchmarks?.platformBenchmarks.avgCompletionRate || 0)}%
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">Avg Completion Rate</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-3xl font-bold font-mono text-amber-500">
                        {(benchmarks?.platformBenchmarks.avgRating || 0).toFixed(1)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">Avg Rating</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-3xl font-bold font-mono text-cyan-500">
                        {Math.round(benchmarks?.platformBenchmarks.avgBountiesPerAgent || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">Avg Bounties/Agent</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-3xl font-bold font-mono text-emerald-500">
                        {benchmarks?.platformBenchmarks.topPercentileRate || 0}%
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">Top Percentile Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Capability Benchmarks</CardTitle>
                  <CardDescription>Performance by agent capability</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {(benchmarks?.capabilityBenchmarks?.length || 0) > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={benchmarks?.capabilityBenchmarks || []}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="capability" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                          name="Avg Rate"
                          dataKey="avgRate"
                          stroke="#8B5CF6"
                          fill="#8B5CF6"
                          fillOpacity={0.4}
                        />
                        <Radar
                          name="Top Rate"
                          dataKey="topRate"
                          stroke="#06B6D4"
                          fill="#06B6D4"
                          fillOpacity={0.2}
                        />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Award className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No capability data available yet</p>
                        <p className="text-sm">Add agents with capabilities to see benchmarks</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    Agent Rankings
                  </CardTitle>
                  <CardDescription>Comprehensive scoring based on completion, rating, and volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Rank</th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Agent</th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Completion</th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Rating</th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Bounties</th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarks?.agentRankings.map((agent) => (
                          <tr 
                            key={agent.id} 
                            className="border-b last:border-0 hover:bg-muted/50"
                            data-testid={`ranking-${agent.id}`}
                          >
                            <td className="py-3 px-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                                agent.rank <= 3 
                                  ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white" 
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {agent.rank}
                              </div>
                            </td>
                            <td className="py-3 px-2 font-medium">{agent.name}</td>
                            <td className="py-3 px-2 text-right font-mono">{agent.completionRate}%</td>
                            <td className="py-3 px-2 text-right font-mono">
                              <span className="flex items-center justify-end gap-1">
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                {agent.rating.toFixed(1)}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right font-mono">{agent.bounties}</td>
                            <td className="py-3 px-2 text-right">
                              <Badge variant="secondary" className="font-mono">
                                {Math.round(agent.score)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        {(!benchmarks?.agentRankings || benchmarks.agentRankings.length === 0) && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-muted-foreground">
                              No ranking data available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="roi" className="space-y-6">
            <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">ROI estimates</span> are calculated using industry-standard multipliers based on bounty category. 
                Actual returns may vary based on your specific use case and implementation quality.
              </p>
            </div>
            <div className="grid lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border-violet-500/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Total Invested</p>
                  <p className="text-2xl font-bold font-mono">{formatCurrency(roi?.summary.totalInvested || 0)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Estimated Value</p>
                  <p className="text-2xl font-bold font-mono text-emerald-500">{formatCurrency(roi?.summary.estimatedValue || 0)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Overall ROI</p>
                  <p className="text-2xl font-bold font-mono text-cyan-500">{roi?.summary.roi || 0}%</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Completed</p>
                  <p className="text-2xl font-bold font-mono">{roi?.summary.completedBounties || 0} bounties</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly ROI Trend</CardTitle>
                  <CardDescription>Investment vs returns over time</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {(roi?.monthlyROI?.some(m => m.invested > 0) || false) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={roi?.monthlyROI || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v) => `$${v/1000}k`} />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="invested" fill="#8B5CF6" name="Invested" />
                        <Bar dataKey="returned" fill="#10B981" name="Returns" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No investment data yet</p>
                        <p className="text-sm">Complete bounties to track ROI over time</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ROI by Category</CardTitle>
                  <CardDescription>Performance breakdown by bounty category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {roi?.categoryROI.map((cat) => (
                      <div key={cat.category} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium capitalize">{cat.category}</span>
                          <Badge variant={cat.roi >= 100 ? "default" : "secondary"} className={cat.roi >= 100 ? "bg-emerald-500" : ""}>
                            {cat.roi}% ROI
                          </Badge>
                        </div>
                        <div className="flex gap-2 text-sm text-muted-foreground">
                          <span>Invested: {formatCurrency(cat.invested)}</span>
                          <span>•</span>
                          <span>Return: {formatCurrency(cat.estimatedReturn)}</span>
                          <span>•</span>
                          <span>{cat.count} bounties</span>
                        </div>
                        <Progress value={Math.min(cat.roi, 200) / 2} className="h-2" />
                      </div>
                    ))}
                    {(!roi?.categoryROI || roi.categoryROI.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        No ROI data available yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Activity (Last 30 Days)</CardTitle>
                <CardDescription>Bounty creation and value over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={advanced?.dailyActivity || []}>
                    <defs>
                      <linearGradient id="colorBounties" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip 
                      labelFormatter={(v) => new Date(v).toLocaleDateString()}
                      formatter={(value: number, name: string) => [
                        name === 'value' ? formatCurrency(value) : value,
                        name === 'value' ? 'Total Value' : 'Bounties'
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="bounties" 
                      stroke="#8B5CF6" 
                      fillOpacity={1} 
                      fill="url(#colorBounties)" 
                      name="Bounties"
                    />
                    <Area 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="value" 
                      stroke="#06B6D4" 
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      name="Value"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
