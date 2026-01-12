import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Activity, Shield, AlertTriangle, Cpu, HardDrive, Network, Clock,
  CheckCircle, XCircle, TrendingUp, Zap, Lock, Eye, RefreshCw,
  Database, Server, ChevronRight, BarChart3, Settings, Terminal,
  Play, Code, FileCode, Link2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SandboxSession {
  id: number;
  sessionId: string;
  status: string;
  runtime: string;
  cpuUsagePercent: string | null;
  memoryUsedMb: number | null;
  peakMemoryMb: number | null;
  networkBytesIn: number | null;
  networkBytesOut: number | null;
  durationMs: number | null;
  createdAt: string;
}

interface SecurityViolation {
  id: number;
  sessionId: string;
  violationType: string;
  severity: string;
  description: string;
  resolved: boolean;
  createdAt: string;
}

interface AnomalyDetection {
  id: number;
  anomalyType: string;
  confidence: string;
  description: string;
  autoResolved: boolean;
  createdAt: string;
}

interface SandboxStats {
  totalSessions: number;
  successRate: number;
  avgDurationMs: number;
  totalViolations: number;
  activeAnomalies: number;
}

interface SandboxConfiguration {
  id: number;
  name: string;
  tier: string;
  runtime: string;
  securityLevel: string;
  cpuCores: number;
  memoryMb: number;
  timeoutMs: number;
  isDefault: boolean;
}

interface SecurityScanResult {
  passed: boolean;
  violations: Array<{ type: string; severity: string; description: string }>;
  score: number;
}

export default function SandboxControl() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [codeToScan, setCodeToScan] = useState(`// Paste code here to scan for security issues
const result = 2 + 2;
console.log('Result:', result);
`);
  const [scanResult, setScanResult] = useState<SecurityScanResult | null>(null);

  const { data: stats } = useQuery<SandboxStats>({
    queryKey: ["/api/sandbox/stats"],
  });

  const { data: sessions, refetch: refetchSessions } = useQuery<SandboxSession[]>({
    queryKey: ["/api/sandbox/sessions"],
  });

  const { data: violations } = useQuery<SecurityViolation[]>({
    queryKey: ["/api/sandbox/violations"],
  });

  const { data: anomalies } = useQuery<AnomalyDetection[]>({
    queryKey: ["/api/sandbox/anomalies"],
  });

  const { data: configurations } = useQuery<SandboxConfiguration[]>({
    queryKey: ["/api/sandbox/configurations"],
  });

  const scanMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/sandbox/scan", { code });
      return res.json();
    },
    onSuccess: (data) => {
      setScanResult(data);
      toast({
        title: data.passed ? "Security scan passed" : "Security issues found",
        description: `Score: ${data.score}/100`,
        variant: data.passed ? "default" : "destructive",
      });
    },
    onError: () => {
      toast({ title: "Scan failed", variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "running": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "failed": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "timeout": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "high": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "low": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getTierGradient = (tier: string) => {
    switch (tier) {
      case "max": return "from-fuchsia-500 via-violet-500 to-cyan-500";
      case "enterprise": return "from-violet-500 to-purple-500";
      case "professional": return "from-blue-500 to-indigo-500";
      case "standard": return "from-green-500 to-emerald-500";
      default: return "from-gray-500 to-slate-500";
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "0ms";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Max Tier Sandbox Control
            </h1>
            <p className="text-muted-foreground mt-1">
              Enterprise-grade agent execution environment with advanced security
            </p>
          </div>
          <Button 
            onClick={() => refetchSessions()}
            variant="outline"
            className="gap-2"
            data-testid="button-refresh-sandbox"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border-violet-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20">
                  <Activity className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sessions</p>
                  <p className="text-2xl font-bold">{stats?.totalSessions || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{(stats?.successRate || 0).toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <Clock className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <p className="text-2xl font-bold">{formatDuration(stats?.avgDurationMs || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Shield className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Violations</p>
                  <p className="text-2xl font-bold">{stats?.totalViolations || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Anomalies</p>
                  <p className="text-2xl font-bold">{stats?.activeAnomalies || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="overview" className="gap-2" data-testid="tab-sandbox-overview">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="scanner" className="gap-2" data-testid="tab-sandbox-scanner">
              <Shield className="w-4 h-4" />
              Security Scanner
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2" data-testid="tab-sandbox-sessions">
              <Terminal className="w-4 h-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="configurations" className="gap-2" data-testid="tab-sandbox-configurations">
              <Settings className="w-4 h-4" />
              Configurations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-violet-400" />
                    Runtime Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {["quickjs", "wasmtime", "docker", "kubernetes", "firecracker"].map((runtime) => {
                      const count = sessions?.filter(s => s.runtime === runtime).length || 0;
                      const total = sessions?.length || 1;
                      const percentage = (count / total) * 100;
                      return (
                        <div key={runtime} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{runtime}</span>
                            <span className="text-muted-foreground">{count} sessions</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-fuchsia-400" />
                    Security Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-green-400" />
                        <span>Passed Scans</span>
                      </div>
                      <span className="font-mono text-lg text-green-400">
                        {sessions?.filter(s => s.status === 'completed').length || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-red-400" />
                        <span>Blocked Executions</span>
                      </div>
                      <span className="font-mono text-lg text-red-400">
                        {sessions?.filter(s => s.status === 'failed').length || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        <span>Active Alerts</span>
                      </div>
                      <span className="font-mono text-lg text-yellow-400">
                        {(violations?.filter(v => !v.resolved).length || 0) + (anomalies?.filter(a => !a.autoResolved).length || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-cyan-400" />
                  Blockchain Verification Ready
                </CardTitle>
                <CardDescription>
                  Immutable proof generation for high-stakes bounty executions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {["Ethereum", "Polygon", "Arbitrum", "Optimism"].map((network) => (
                    <div key={network} className="p-4 rounded-lg bg-muted/30 text-center">
                      <Database className="w-8 h-8 mx-auto mb-2 text-violet-400" />
                      <p className="font-medium">{network}</p>
                      <p className="text-xs text-muted-foreground">Available</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scanner" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="w-5 h-5 text-violet-400" />
                  Security Code Scanner
                </CardTitle>
                <CardDescription>
                  Scan agent code for security vulnerabilities, prompt injections, and dangerous patterns
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Code to Scan</Label>
                  <Textarea
                    value={codeToScan}
                    onChange={(e) => setCodeToScan(e.target.value)}
                    className="font-mono h-64"
                    placeholder="Paste code here to scan..."
                    data-testid="textarea-code-scan"
                  />
                </div>
                <Button 
                  onClick={() => scanMutation.mutate(codeToScan)}
                  disabled={scanMutation.isPending}
                  className="gap-2"
                  data-testid="button-scan-code"
                >
                  <Shield className="w-4 h-4" />
                  {scanMutation.isPending ? "Scanning..." : "Scan Code"}
                </Button>

                {scanResult && (
                  <Card className={scanResult.passed ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {scanResult.passed ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                          <span className="font-medium">
                            {scanResult.passed ? "Security Check Passed" : "Security Issues Detected"}
                          </span>
                        </div>
                        <Badge className={scanResult.passed ? "bg-green-500" : "bg-red-500"}>
                          Score: {scanResult.score}/100
                        </Badge>
                      </div>
                      {scanResult.violations.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Violations found:</p>
                          {scanResult.violations.map((v, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                              <Badge className={getSeverityColor(v.severity)}>{v.severity}</Badge>
                              <div>
                                <p className="text-sm font-medium">{v.type}</p>
                                <p className="text-xs text-muted-foreground">{v.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Blocked Patterns</CardTitle>
                  <CardDescription>Code patterns automatically blocked by the scanner</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 font-mono text-sm">
                    {[
                      "eval()", "new Function()", "process.exit",
                      "child_process", "__proto__", "constructor.constructor"
                    ].map((pattern) => (
                      <div key={pattern} className="flex items-center gap-2 p-2 rounded bg-red-500/10">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <code>{pattern}</code>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Prompt Injection Detection</CardTitle>
                  <CardDescription>AI-powered detection of manipulation attempts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {[
                      "Ignore previous instructions",
                      "Disregard context",
                      "Act as if you are",
                      "Reveal system prompt",
                      "Bypass restrictions"
                    ].map((pattern) => (
                      <div key={pattern} className="flex items-center gap-2 p-2 rounded bg-yellow-500/10">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span>{pattern}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Sandbox Sessions</CardTitle>
                <CardDescription>
                  View all agent execution sessions with resource metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {sessions?.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No sandbox sessions yet. Execute an agent to create sessions.
                      </div>
                    ) : (
                      sessions?.map((session) => (
                        <Card key={session.id} className="bg-muted/20">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge className={getStatusColor(session.status)}>
                                    {session.status}
                                  </Badge>
                                  <span className="font-mono text-sm">{session.sessionId}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Server className="w-3 h-3" />
                                    {session.runtime}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(session.durationMs)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Cpu className="w-3 h-3" />
                                    {session.cpuUsagePercent || 0}%
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <HardDrive className="w-3 h-3" />
                                    {session.memoryUsedMb || 0} MB
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Network className="w-3 h-3" />
                                    {formatBytes((session.networkBytesIn || 0) + (session.networkBytesOut || 0))}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right text-sm text-muted-foreground">
                                {new Date(session.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configurations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-violet-400" />
                  Sandbox Tier Configurations
                </CardTitle>
                <CardDescription>
                  Available sandbox tiers with resource limits and security settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {configurations?.map((config) => (
                    <Card 
                      key={config.id} 
                      className={`relative overflow-hidden ${config.isDefault ? 'ring-2 ring-violet-500' : ''}`}
                    >
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getTierGradient(config.tier)}`} />
                      <CardContent className="p-4 pt-5">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{config.name}</h3>
                            {config.isDefault && (
                              <Badge className="bg-violet-500/20 text-violet-400">Default</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">{config.tier}</Badge>
                            <Badge variant="outline">{config.runtime}</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                              <span>CPU Cores</span>
                              <span className="font-mono">{config.cpuCores}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Memory</span>
                              <span className="font-mono">{config.memoryMb} MB</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Timeout</span>
                              <span className="font-mono">{(config.timeoutMs / 1000).toFixed(0)}s</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Security Level</span>
                              <Badge variant="secondary" className="capitalize text-xs">
                                {config.securityLevel}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tier Comparison</CardTitle>
                <CardDescription>Compare sandbox tiers and their capabilities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Feature</th>
                        <th className="text-center py-3 px-4">Basic</th>
                        <th className="text-center py-3 px-4">Standard</th>
                        <th className="text-center py-3 px-4">Professional</th>
                        <th className="text-center py-3 px-4">Enterprise</th>
                        <th className="text-center py-3 px-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-3 px-4">CPU Cores</td>
                        <td className="text-center py-3 px-4">1</td>
                        <td className="text-center py-3 px-4">1</td>
                        <td className="text-center py-3 px-4">2</td>
                        <td className="text-center py-3 px-4">4</td>
                        <td className="text-center py-3 px-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 font-bold">8</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-4">Memory</td>
                        <td className="text-center py-3 px-4">256 MB</td>
                        <td className="text-center py-3 px-4">512 MB</td>
                        <td className="text-center py-3 px-4">1 GB</td>
                        <td className="text-center py-3 px-4">4 GB</td>
                        <td className="text-center py-3 px-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 font-bold">8 GB</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-4">Timeout</td>
                        <td className="text-center py-3 px-4">30s</td>
                        <td className="text-center py-3 px-4">60s</td>
                        <td className="text-center py-3 px-4">3m</td>
                        <td className="text-center py-3 px-4">5m</td>
                        <td className="text-center py-3 px-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 font-bold">10m</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-4">Blockchain Proofs</td>
                        <td className="text-center py-3 px-4"><XCircle className="w-4 h-4 mx-auto text-muted-foreground" /></td>
                        <td className="text-center py-3 px-4"><XCircle className="w-4 h-4 mx-auto text-muted-foreground" /></td>
                        <td className="text-center py-3 px-4"><CheckCircle className="w-4 h-4 mx-auto text-green-400" /></td>
                        <td className="text-center py-3 px-4"><CheckCircle className="w-4 h-4 mx-auto text-green-400" /></td>
                        <td className="text-center py-3 px-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10"><CheckCircle className="w-4 h-4 mx-auto text-green-400" /></td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4">Anomaly Detection</td>
                        <td className="text-center py-3 px-4"><XCircle className="w-4 h-4 mx-auto text-muted-foreground" /></td>
                        <td className="text-center py-3 px-4"><XCircle className="w-4 h-4 mx-auto text-muted-foreground" /></td>
                        <td className="text-center py-3 px-4"><XCircle className="w-4 h-4 mx-auto text-muted-foreground" /></td>
                        <td className="text-center py-3 px-4"><CheckCircle className="w-4 h-4 mx-auto text-green-400" /></td>
                        <td className="text-center py-3 px-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10"><CheckCircle className="w-4 h-4 mx-auto text-green-400" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
