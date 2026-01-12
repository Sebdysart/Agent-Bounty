import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, Download, Trash2, FileText, Clock, CheckCircle, XCircle, AlertTriangle, Eye, Lock } from "lucide-react";

interface Consent {
  id: number;
  category: string;
  granted: boolean;
  version: string;
  grantedAt: string | null;
  revokedAt: string | null;
}

interface ExportRequest {
  id: number;
  status: string;
  format: string;
  downloadUrl: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface DeletionRequest {
  id: number;
  status: string;
  reason: string | null;
  confirmationCode: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const CONSENT_LABELS: Record<string, { title: string; description: string }> = {
  analytics: { title: "Analytics", description: "Help us improve by collecting usage data" },
  marketing: { title: "Marketing", description: "Receive personalized offers and updates" },
  ai_training: { title: "AI Training", description: "Allow your data to improve our AI models" },
  third_party: { title: "Third Party", description: "Share data with trusted partners" },
  essential: { title: "Essential", description: "Required for basic functionality" },
};

export default function PrivacyCenterPage() {
  const { toast } = useToast();
  const [deletionReason, setDeletionReason] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [pendingDeletionId, setPendingDeletionId] = useState<number | null>(null);

  const { data: consents = [] } = useQuery<Consent[]>({
    queryKey: ["/api/privacy/consents"],
  });

  const { data: exports = [] } = useQuery<ExportRequest[]>({
    queryKey: ["/api/privacy/exports"],
  });

  const { data: deletionRequests = [] } = useQuery<DeletionRequest[]>({
    queryKey: ["/api/privacy/deletions"],
    refetchInterval: 5000,
  });

  const updateConsentMutation = useMutation({
    mutationFn: async ({ category, granted }: { category: string; granted: boolean }) => {
      const res = await apiRequest("POST", "/api/privacy/consents", { category, granted, version: "1.0" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/consents"] });
      toast({ title: "Consent updated" });
    },
  });

  const requestExportMutation = useMutation({
    mutationFn: async (format: string) => {
      const res = await apiRequest("POST", "/api/privacy/export", { format });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/exports"] });
      toast({ title: "Data export requested", description: "We'll notify you when it's ready" });
    },
  });

  const requestDeletionMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", "/api/privacy/delete", { reason });
      return res.json();
    },
    onSuccess: (data: any) => {
      setPendingDeletionId(data.requestId);
      toast({ 
        title: "Deletion requested", 
        description: "Enter the confirmation code to proceed" 
      });
    },
  });

  const confirmDeletionMutation = useMutation({
    mutationFn: async ({ requestId, code }: { requestId: number; code: string }) => {
      const res = await apiRequest("POST", "/api/privacy/delete/confirm", { requestId, confirmationCode: code });
      return res.json();
    },
    onSuccess: () => {
      setPendingDeletionId(null);
      setConfirmationCode("");
      toast({ title: "Deletion confirmed", description: "Your data is being processed" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
          <Shield className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Privacy Center</h1>
          <p className="text-muted-foreground">Manage your data and privacy preferences</p>
        </div>
      </div>

      <Tabs defaultValue="consents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-card/50 border border-border/50">
          <TabsTrigger value="consents" data-testid="tab-consents">
            <Eye className="w-4 h-4 mr-2" />Consents
          </TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">
            <Download className="w-4 h-4 mr-2" />Data Export
          </TabsTrigger>
          <TabsTrigger value="delete" data-testid="tab-delete">
            <Trash2 className="w-4 h-4 mr-2" />Delete Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consents" className="space-y-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Data Collection Preferences</CardTitle>
              <CardDescription>Control how we collect and use your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(CONSENT_LABELS).map(([category, { title, description }]) => {
                const consent = consents.find(c => c.category === category);
                const isGranted = consent?.granted ?? category === 'essential';
                const isEssential = category === 'essential';

                return (
                  <div key={category} className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="font-medium">{title}</Label>
                        {isEssential && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={isGranted}
                      disabled={isEssential || updateConsentMutation.isPending}
                      onCheckedChange={(checked) => {
                        updateConsentMutation.mutate({ category, granted: checked });
                      }}
                      data-testid={`switch-consent-${category}`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Export Your Data</CardTitle>
              <CardDescription>Download a copy of all your data (GDPR Article 20)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button
                  onClick={() => requestExportMutation.mutate("json")}
                  disabled={requestExportMutation.isPending}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                  data-testid="button-export-json"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export as JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => requestExportMutation.mutate("csv")}
                  disabled={requestExportMutation.isPending}
                  data-testid="button-export-csv"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export as CSV
                </Button>
              </div>

              {exports.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-medium">Recent Exports</h4>
                    {exports.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(exp.status)}
                          <span className="text-sm text-muted-foreground">
                            {new Date(exp.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {exp.status === "completed" && exp.downloadUrl && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={exp.downloadUrl} download data-testid={`button-download-${exp.id}`}>
                              <Download className="w-4 h-4 mr-2" />Download
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delete" className="space-y-4">
          <Card className="bg-card/50 border-border/50 border-red-500/20">
            <CardHeader>
              <CardTitle className="text-red-400">Delete Your Data</CardTitle>
              <CardDescription>Permanently delete all your data (GDPR Article 17)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-red-400">This action is irreversible</p>
                    <p className="text-sm text-muted-foreground">
                      All your bounties, agents, submissions, and account data will be permanently deleted.
                    </p>
                  </div>
                </div>
              </div>

              {!pendingDeletionId ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="deletion-reason">Reason for leaving (optional)</Label>
                    <Textarea
                      id="deletion-reason"
                      placeholder="Tell us why you're leaving..."
                      value={deletionReason}
                      onChange={(e) => setDeletionReason(e.target.value)}
                      className="mt-2"
                      data-testid="textarea-deletion-reason"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => requestDeletionMutation.mutate(deletionReason)}
                    disabled={requestDeletionMutation.isPending}
                    data-testid="button-request-deletion"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Request Data Deletion
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-sm">
                      A confirmation code has been generated. Enter it below to confirm deletion.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="confirmation-code">Confirmation Code</Label>
                    <Input
                      id="confirmation-code"
                      placeholder="Enter confirmation code"
                      value={confirmationCode}
                      onChange={(e) => setConfirmationCode(e.target.value)}
                      className="mt-2 font-mono"
                      data-testid="input-confirmation-code"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="destructive"
                      onClick={() => confirmDeletionMutation.mutate({ 
                        requestId: pendingDeletionId, 
                        code: confirmationCode 
                      })}
                      disabled={!confirmationCode || confirmDeletionMutation.isPending}
                      data-testid="button-confirm-deletion"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Confirm Deletion
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPendingDeletionId(null);
                        setConfirmationCode("");
                      }}
                      data-testid="button-cancel-deletion"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
