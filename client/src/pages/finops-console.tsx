import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, 
  Zap, Target, PiggyBank, BarChart3, Clock, Cpu,
  ArrowUpRight, ArrowDownRight, Sparkles, Check
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#8b5cf6", "#d946ef", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

export default function FinOpsConsole() {
  const { toast } = useToast();
  const [days, setDays] = useState(30);

  const { data: summary, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ["/api/finops/summary"],
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ["/api/finops/usage", days],
    queryFn: async () => {
      const res = await fetch(`/api/finops/usage?days=${days}`);
      return res.json();
    },
  });

  const { data: budgets = [] } = useQuery<any[]>({
    queryKey: ["/api/finops/budgets"],
  });

  const { data: optimizations = [] } = useQuery<any[]>({
    queryKey: ["/api/finops/optimizations"],
  });

  const { data: pricing = [] } = useQuery<any[]>({
    queryKey: ["/api/finops/pricing"],
  });

  const generateOptsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/finops/optimizations/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finops/optimizations"] });
      toast({ title: "Optimizations generated", description: "New cost-saving recommendations are available" });
    },
  });

  const applyOptMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/finops/optimizations/${id}/apply`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finops/optimizations"] });
      toast({ title: "Optimization applied", description: "The recommendation has been applied" });
    },
  });

  const pendingOpts = optimizations.filter((o: any) => !o.isApplied);
  const appliedOpts = optimizations.filter((o: any) => o.isApplied);

  const providerData = usage?.byProvider
    ? Object.entries(usage.byProvider).map(([name, data]: [string, any]) => ({
        name,
        cost: data.cost,
        tokens: data.tokens,
      }))
    : [];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
            AI FinOps Console
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor and optimize your AI infrastructure costs
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d)}
              className={days === d ? "bg-gradient-to-r from-violet-600 to-fuchsia-600" : ""}
              data-testid={`button-days-${d}`}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">
                  ${summary?.currentMonthCost?.toFixed(2) || "0.00"}
                </p>
                {summary?.costChange !== undefined && (
                  <div className={`flex items-center text-sm ${summary.costChange >= 0 ? "text-red-400" : "text-green-400"}`}>
                    {summary.costChange >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 mr-1" />
                    )}
                    {Math.abs(summary.costChange).toFixed(1)}% vs last month
                  </div>
                )}
              </div>
              <DollarSign className="h-8 w-8 text-violet-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Budgets</p>
                <p className="text-2xl font-bold">{summary?.activeBudgets || 0}</p>
                {summary?.budgetsNearLimit > 0 && (
                  <div className="flex items-center text-sm text-yellow-400">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {summary.budgetsNearLimit} near limit
                  </div>
                )}
              </div>
              <Target className="h-8 w-8 text-fuchsia-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Potential Savings</p>
                <p className="text-2xl font-bold">
                  ${summary?.projectedMonthlySavings?.toFixed(2) || "0.00"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {pendingOpts.length} recommendations
                </p>
              </div>
              <PiggyBank className="h-8 w-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tokens</p>
                <p className="text-2xl font-bold">
                  {((usage?.totalTokens || 0) / 1000000).toFixed(2)}M
                </p>
                <p className="text-sm text-muted-foreground">
                  Last {days} days
                </p>
              </div>
              <Cpu className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="budgets" data-testid="tab-budgets">Budgets</TabsTrigger>
          <TabsTrigger value="optimize" data-testid="tab-optimize">Optimize</TabsTrigger>
          <TabsTrigger value="pricing" data-testid="tab-pricing">Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cost Trend</CardTitle>
                <CardDescription>Daily spending over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {usage?.dailyUsage?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={usage.dailyUsage}>
                        <defs>
                          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#888" fontSize={12} />
                        <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `$${v}`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
                          formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="cost"
                          stroke="#8b5cf6"
                          fill="url(#costGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No usage data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cost by Provider</CardTitle>
                <CardDescription>Spending distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {providerData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={providerData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="cost"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {providerData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
                          formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No provider data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {usage?.byModel && Object.keys(usage.byModel).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usage by Model</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(usage.byModel).map(([model, data]: [string, any], index) => (
                    <div key={model} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{model}</span>
                        <span className="text-muted-foreground">
                          ${data.cost.toFixed(4)} | {(data.tokens / 1000).toFixed(1)}K tokens
                        </span>
                      </div>
                      <Progress
                        value={(data.cost / usage.totalCost) * 100}
                        className="h-2"
                        style={{ 
                          background: `linear-gradient(to right, ${COLORS[index % COLORS.length]}40, transparent)` 
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="budgets" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Cost Budgets</h2>
            <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600" data-testid="button-create-budget">
              Create Budget
            </Button>
          </div>

          {budgets.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No budgets configured</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Set up budgets to track and control your AI spending
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {budgets.map((budget: any) => {
                const spend = parseFloat(budget.currentSpend || "0");
                const limit = parseFloat(budget.budgetAmount);
                const percent = (spend / limit) * 100;
                const isNearLimit = percent >= 80;
                const isOverLimit = percent >= 100;

                return (
                  <Card
                    key={budget.id}
                    className={`${
                      isOverLimit
                        ? "border-red-500/50"
                        : isNearLimit
                        ? "border-yellow-500/50"
                        : ""
                    }`}
                    data-testid={`card-budget-${budget.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{budget.name}</CardTitle>
                          <CardDescription>{budget.budgetType}</CardDescription>
                        </div>
                        <Badge
                          className={
                            isOverLimit
                              ? "bg-red-500/20 text-red-400"
                              : isNearLimit
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-green-500/20 text-green-400"
                          }
                        >
                          {isOverLimit ? "Over Budget" : isNearLimit ? "Near Limit" : "On Track"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>${spend.toFixed(2)} spent</span>
                          <span className="text-muted-foreground">${limit.toFixed(2)} limit</span>
                        </div>
                        <Progress
                          value={Math.min(percent, 100)}
                          className={`h-2 ${
                            isOverLimit
                              ? "[&>div]:bg-red-500"
                              : isNearLimit
                              ? "[&>div]:bg-yellow-500"
                              : "[&>div]:bg-green-500"
                          }`}
                        />
                        <p className="text-xs text-muted-foreground">
                          Alert at {parseFloat(budget.alertThreshold || "0.8") * 100}% | 
                          Auto-stop: {budget.autoStop ? "Yes" : "No"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="optimize" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Cost Optimizations</h2>
            <Button
              onClick={() => generateOptsMutation.mutate()}
              disabled={generateOptsMutation.isPending}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600"
              data-testid="button-generate-optimizations"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {generateOptsMutation.isPending ? "Analyzing..." : "Generate Recommendations"}
            </Button>
          </div>

          {pendingOpts.length === 0 && appliedOpts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No optimizations available</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Generate recommendations based on your usage patterns
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {pendingOpts.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Pending Recommendations</h3>
                  {pendingOpts.map((opt: any) => (
                    <Card key={opt.id} className="border-cyan-500/20" data-testid={`card-optimization-${opt.id}`}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-cyan-500/20 text-cyan-400">
                                {opt.optimizationType.replace("_", " ")}
                              </Badge>
                              <span className="text-green-400 font-medium">
                                Save ${parseFloat(opt.projectedSavings || "0").toFixed(2)}/mo
                              </span>
                            </div>
                            <p className="text-sm mb-2">{opt.recommendation}</p>
                            <p className="text-xs text-muted-foreground">
                              Current cost: ${parseFloat(opt.currentCost || "0").toFixed(2)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => applyOptMutation.mutate(opt.id)}
                            disabled={applyOptMutation.isPending}
                            className="bg-gradient-to-r from-violet-600 to-fuchsia-600"
                            data-testid={`button-apply-${opt.id}`}
                          >
                            Apply
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {appliedOpts.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-muted-foreground">Applied</h3>
                  {appliedOpts.map((opt: any) => (
                    <Card key={opt.id} className="opacity-60" data-testid={`card-applied-${opt.id}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-green-400" />
                          <span className="text-sm">{opt.recommendation}</span>
                          <Badge variant="outline" className="ml-auto">
                            Applied {new Date(opt.appliedAt).toLocaleDateString()}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6">
          <h2 className="text-xl font-semibold">Model Pricing Reference</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Provider</th>
                      <th className="text-left py-2">Model</th>
                      <th className="text-right py-2">Input $/1M</th>
                      <th className="text-right py-2">Output $/1M</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 capitalize">{p.provider}</td>
                        <td className="py-2 font-mono text-xs">{p.model}</td>
                        <td className="py-2 text-right">${p.inputPricePerMillion}</td>
                        <td className="py-2 text-right">${p.outputPricePerMillion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
