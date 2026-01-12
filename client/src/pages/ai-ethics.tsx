import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Shield, AlertTriangle, CheckCircle, XCircle, Clock, 
  Brain, Eye, Lock, Search, Zap, FileWarning, RefreshCw
} from "lucide-react";

interface EthicsAudit {
  id: number;
  agentUploadId: number;
  auditType: string;
  status: string;
  score: string | null;
  findings: string | null;
  recommendations: string | null;
  flaggedContent: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface AgentUpload {
  id: number;
  name: string;
  description: string;
  uploadType: string;
}

const AUDIT_TYPES = [
  { id: "comprehensive", label: "Comprehensive Audit", icon: Shield, description: "Full ethics analysis" },
  { id: "bias_detection", label: "Bias Detection", icon: Eye, description: "Check for discriminatory patterns" },
  { id: "harmful_content", label: "Harmful Content", icon: AlertTriangle, description: "Detect dangerous outputs" },
  { id: "prompt_injection", label: "Prompt Injection", icon: Lock, description: "Security vulnerability check" },
  { id: "privacy_leak", label: "Privacy Analysis", icon: Search, description: "Data handling review" },
];

export default function AIEthicsPage() {
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedAuditType, setSelectedAuditType] = useState<string>("comprehensive");

  const { data: agents = [] } = useQuery<AgentUpload[]>({
    queryKey: ["/api/agent-uploads"],
  });

  const { data: audits = [], refetch: refetchAudits } = useQuery<EthicsAudit[]>({
    queryKey: ["/api/ethics/agent", selectedAgent],
    enabled: !!selectedAgent,
    refetchInterval: 5000,
  });

  const runAuditMutation = useMutation({
    mutationFn: async ({ agentId, auditType }: { agentId: string; auditType: string }) => {
      const endpoint = auditType === "comprehensive" 
        ? `/api/ethics/audit/${agentId}`
        : `/api/ethics/audit/${agentId}/${auditType}`;
      const res = await apiRequest("POST", endpoint);
      return res.json();
    },
    onSuccess: () => {
      refetchAudits();
      toast({ title: "Audit started", description: "The ethics audit is being processed" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Passed</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "review_required":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Review Required</Badge>;
      case "pending":
      case "processing":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const parseJsonSafe = (str: string | null): string[] => {
    if (!str) return [];
    try {
      return JSON.parse(str);
    } catch {
      return [];
    }
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
          <Brain className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Ethics Auditor</h1>
          <p className="text-muted-foreground">Ensure your agents meet ethical standards</p>
        </div>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Run Ethics Audit</CardTitle>
          <CardDescription>Select an agent and audit type to begin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Agent</label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger data-testid="select-agent">
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Audit Type</label>
              <Select value={selectedAuditType} onValueChange={setSelectedAuditType}>
                <SelectTrigger data-testid="select-audit-type">
                  <SelectValue placeholder="Choose audit type..." />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {AUDIT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedAuditType(type.id)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  selectedAuditType === type.id
                    ? "bg-violet-500/20 border-violet-500/50"
                    : "bg-background/50 border-border/30 hover-elevate"
                }`}
                data-testid={`button-audit-${type.id}`}
              >
                <type.icon className={`w-5 h-5 mb-2 ${
                  selectedAuditType === type.id ? "text-violet-400" : "text-muted-foreground"
                }`} />
                <p className="text-sm font-medium">{type.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
              </button>
            ))}
          </div>

          <Button
            onClick={() => {
              if (selectedAgent) {
                runAuditMutation.mutate({ agentId: selectedAgent, auditType: selectedAuditType });
              }
            }}
            disabled={!selectedAgent || runAuditMutation.isPending}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
            data-testid="button-run-audit"
          >
            {runAuditMutation.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Running Audit...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" />Run Ethics Audit</>
            )}
          </Button>
        </CardContent>
      </Card>

      {selectedAgent && audits.length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-cyan-400" />
              Audit Results
            </CardTitle>
            <CardDescription>Review ethics audit findings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {audits.map((audit) => {
                const score = parseFloat(audit.score || "0");
                const findings = parseJsonSafe(audit.findings);
                const recommendations = parseJsonSafe(audit.recommendations);
                const flagged = parseJsonSafe(audit.flaggedContent);

                return (
                  <div key={audit.id} className="p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getStatusBadge(audit.status)}
                        <Badge variant="outline" className="capitalize">
                          {audit.auditType.replace("_", " ")}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(audit.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {audit.score && (
                        <div className="text-right">
                          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
                            {score.toFixed(0)}
                          </span>
                          <span className="text-sm text-muted-foreground">/100</span>
                        </div>
                      )}
                    </div>

                    {audit.status === "pending" || audit.status === "processing" ? (
                      <div className="flex items-center gap-3 py-4">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                        <span className="text-muted-foreground">Audit in progress...</span>
                      </div>
                    ) : (
                      <Tabs defaultValue="findings" className="mt-4">
                        <TabsList className="bg-card/50">
                          <TabsTrigger value="findings">
                            Findings ({findings.length})
                          </TabsTrigger>
                          <TabsTrigger value="recommendations">
                            Recommendations ({recommendations.length})
                          </TabsTrigger>
                          {flagged.length > 0 && (
                            <TabsTrigger value="flagged" className="text-red-400">
                              Flagged ({flagged.length})
                            </TabsTrigger>
                          )}
                        </TabsList>

                        <TabsContent value="findings" className="mt-4">
                          {findings.length > 0 ? (
                            <ul className="space-y-2">
                              {findings.map((finding, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                                  <span>{finding}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground text-sm flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              No issues found
                            </p>
                          )}
                        </TabsContent>

                        <TabsContent value="recommendations" className="mt-4">
                          {recommendations.length > 0 ? (
                            <ul className="space-y-2">
                              {recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <Zap className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground text-sm">No recommendations</p>
                          )}
                        </TabsContent>

                        {flagged.length > 0 && (
                          <TabsContent value="flagged" className="mt-4">
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                              <ul className="space-y-2">
                                {flagged.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-red-400">
                                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <code className="font-mono text-xs">{item}</code>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </TabsContent>
                        )}
                      </Tabs>
                    )}

                    {audit.score && (
                      <div className="mt-4">
                        <Progress 
                          value={score} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedAgent && audits.length === 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No audits yet for this agent</p>
            <p className="text-sm text-muted-foreground mt-1">Run an ethics audit to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
