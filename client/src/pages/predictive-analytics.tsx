import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, TrendingDown, AlertTriangle, Target, 
  BarChart3, Activity, Shield, Brain, Sparkles,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

export default function PredictiveAnalytics() {
  const { data: insights, isLoading } = useQuery<any>({
    queryKey: ["/api/analytics/insights"],
  });

  const { data: trends = [] } = useQuery<any[]>({
    queryKey: ["/api/analytics/trends"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/trends?period=daily&limit=30");
      return res.json();
    },
  });

  const { data: forecasts = [] } = useQuery<any[]>({
    queryKey: ["/api/analytics/forecasts"],
  });

  const { data: risks = [] } = useQuery<any[]>({
    queryKey: ["/api/analytics/risks"],
  });

  const trendData = trends.slice(0, 14).reverse().map((t: any) => ({
    date: new Date(t.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: parseFloat(t.metricValue),
    change: parseFloat(t.changePercent || "0"),
  }));

  const riskDistribution = [
    { subject: "Fraud", value: insights?.avgBountySuccessRate ? (1 - insights.avgBountySuccessRate) * 100 : 30 },
    { subject: "Delivery", value: insights?.avgAgentPerformance ? (1 - insights.avgAgentPerformance) * 100 : 25 },
    { subject: "Payment", value: 15 },
    { subject: "Reputation", value: 20 },
    { subject: "Compliance", value: 10 },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
          Predictive Analytics
        </h1>
        <p className="text-muted-foreground mt-2">
          AI-powered insights and forecasting for your marketplace
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bounty Success Rate</p>
                <p className="text-2xl font-bold">
                  {((insights?.avgBountySuccessRate || 0) * 100).toFixed(1)}%
                </p>
                <div className="flex items-center text-sm text-green-400">
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  Predicted
                </div>
              </div>
              <Target className="h-8 w-8 text-violet-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agent Performance</p>
                <p className="text-2xl font-bold">
                  {((insights?.avgAgentPerformance || 0) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">Avg forecast</p>
              </div>
              <Brain className="h-8 w-8 text-fuchsia-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Risk Entities</p>
                <p className="text-2xl font-bold">{insights?.highRiskEntities || 0}</p>
                <p className="text-sm text-yellow-400">Requires attention</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Forecasts</p>
                <p className="text-2xl font-bold">{forecasts.length}</p>
                <p className="text-sm text-muted-foreground">Models running</p>
              </div>
              <Sparkles className="h-8 w-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-400" />
              Platform Trends
            </CardTitle>
            <CardDescription>Key metrics over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: "#8b5cf6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No trend data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-fuchsia-400" />
              Risk Distribution
            </CardTitle>
            <CardDescription>Platform risk analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={riskDistribution}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="subject" stroke="#888" fontSize={12} />
                  <PolarRadiusAxis stroke="#888" fontSize={10} />
                  <Radar
                    name="Risk"
                    dataKey="value"
                    stroke="#d946ef"
                    fill="#d946ef"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Forecasts</CardTitle>
            <CardDescription>AI-generated predictions</CardDescription>
          </CardHeader>
          <CardContent>
            {forecasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Brain className="h-10 w-10 mb-3" />
                <p>No forecasts generated yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {forecasts.slice(0, 5).map((forecast: any) => (
                  <div
                    key={forecast.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`forecast-${forecast.id}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {forecast.forecastType?.replace("_", " ")}
                        </Badge>
                        <span className="text-sm font-medium">
                          {forecast.entityType} #{forecast.entityId}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Horizon: {forecast.horizon}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {(parseFloat(forecast.prediction || "0") * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(parseFloat(forecast.confidence || "0") * 100).toFixed(0)}% confidence
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trending Summary</CardTitle>
            <CardDescription>Latest metric changes</CardDescription>
          </CardHeader>
          <CardContent>
            {insights?.trendingSummary?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-3" />
                <p>No trends recorded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(insights?.trendingSummary || []).slice(0, 5).map((trend: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {trend.trend === "up" ? (
                        <TrendingUp className="h-5 w-5 text-green-400" />
                      ) : trend.trend === "down" ? (
                        <TrendingDown className="h-5 w-5 text-red-400" />
                      ) : (
                        <Activity className="h-5 w-5 text-yellow-400" />
                      )}
                      <span className="font-medium">{trend.metric}</span>
                    </div>
                    <Badge
                      className={
                        trend.trend === "up"
                          ? "bg-green-500/20 text-green-400"
                          : trend.trend === "down"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }
                    >
                      {trend.change >= 0 ? "+" : ""}
                      {trend.change.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {risks.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              Risk Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {risks.filter((r: any) => parseFloat(r.overallScore || "0") >= 60).slice(0, 5).map((risk: any) => (
                <div
                  key={risk.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5"
                  data-testid={`risk-${risk.id}`}
                >
                  <div>
                    <p className="font-medium">
                      {risk.entityType} #{risk.entityId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Last updated: {new Date(risk.lastUpdated).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-yellow-400">
                        {parseFloat(risk.overallScore).toFixed(0)}
                      </span>
                      <span className="text-sm text-muted-foreground">/100</span>
                    </div>
                    <Progress
                      value={parseFloat(risk.overallScore)}
                      className="w-24 h-2 [&>div]:bg-yellow-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
