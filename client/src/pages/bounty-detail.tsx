import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { CredentialConsentForm } from "@/components/credential-consent";
import { 
  ArrowLeft, Clock, Users, Shield, DollarSign, CheckCircle, AlertCircle, 
  Loader2, XCircle, Timer, Bot, Star, TrendingUp, Calendar, Target, 
  CreditCard, RefreshCw, Wallet, Sparkles, Lock, ShieldCheck, Key
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { Bounty, Agent, Submission } from "@shared/schema";

interface CredentialRequirement {
  id: number;
  bountyId: number;
  credentialType: string;
  serviceName: string;
  description: string;
  isRequired: boolean;
}

interface CredentialConsent {
  id: number;
  requirementId: number;
  status: string;
}

interface BountyWithDetails extends Bounty {
  submissions: (Submission & { agent: Agent })[];
  timeline: { status: string; description: string; createdAt: string }[];
}

const statusConfig = {
  open: { color: "from-violet-500 to-fuchsia-500", icon: Timer, label: "Open", bg: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
  in_progress: { color: "from-cyan-500 to-blue-500", icon: Loader2, label: "In Progress", bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  under_review: { color: "from-amber-500 to-orange-500", icon: AlertCircle, label: "Under Review", bg: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  completed: { color: "from-emerald-500 to-green-500", icon: CheckCircle, label: "Completed", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  failed: { color: "from-red-500 to-rose-500", icon: XCircle, label: "Failed", bg: "bg-red-500/10 text-red-400 border-red-500/30" },
  cancelled: { color: "from-gray-500 to-slate-500", icon: XCircle, label: "Cancelled", bg: "bg-muted text-muted-foreground border-border" },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  marketing: { label: "Marketing", color: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30" },
  sales: { label: "Sales", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  research: { label: "Research", color: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
  data_analysis: { label: "Data Analysis", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  development: { label: "Development", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  other: { label: "Other", color: "bg-muted text-muted-foreground border-border" },
};

const paymentStatusConfig = {
  pending: { label: "Not Funded", color: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Wallet },
  funded: { label: "Funded (Escrow)", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: Shield },
  released: { label: "Payment Released", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30", icon: CheckCircle },
  refunded: { label: "Refunded", color: "bg-muted text-muted-foreground border-border", icon: RefreshCw },
};

export function BountyDetailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);

  const { data: bounty, isLoading } = useQuery<BountyWithDetails>({
    queryKey: ["/api/bounties", id],
  });

  const { data: myAgents } = useQuery<Agent[]>({
    queryKey: ["/api/agents/mine"],
  });

  // Fetch credential requirements for this bounty
  const { data: credentialData } = useQuery<{ requirements: CredentialRequirement[]; consents: CredentialConsent[] }>({
    queryKey: ["/api/bounties", id, "credentials"],
    enabled: !!id,
  });

  const submitAgent = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/bounties/${id}/submissions`, {
        agentId: parseInt(selectedAgentId),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bounties", id] });
      toast({
        title: "Agent submitted!",
        description: "Your agent is now competing for this bounty.",
      });
      setShowSubmitDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit agent",
        variant: "destructive",
      });
    },
  });

  const fundBounty = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/bounties/${id}/fund`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    },
  });

  const releasePayment = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/bounties/${id}/release-payment`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bounties", id] });
      toast({
        title: "Payment Released",
        description: "The payment has been released to the winning agent.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to release payment",
        variant: "destructive",
      });
    },
  });

  const refundPayment = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/bounties/${id}/refund`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bounties", id] });
      setShowRefundDialog(false);
      toast({
        title: "Bounty Cancelled",
        description: "The payment has been refunded to your account.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refund payment",
        variant: "destructive",
      });
    },
  });

  const selectWinner = useMutation({
    mutationFn: async (submissionId: number) => {
      return apiRequest("POST", `/api/bounties/${id}/select-winner`, {
        submissionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bounties", id] });
      setShowWinnerDialog(false);
      setSelectedSubmissionId(null);
      toast({
        title: "Winner Selected!",
        description: "The winner has been selected. You can now release the payment.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to select winner",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />
        </div>
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
          <div className="space-y-6">
            <div className="h-8 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-32 bg-muted animate-pulse rounded-xl" />
            <div className="h-48 bg-muted animate-pulse rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mx-auto">
            <Target className="w-10 h-10 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Bounty not found
          </h2>
          <Button 
            onClick={() => navigate("/")}
            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
          >
            Go back to dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  const status = statusConfig[bounty.status as keyof typeof statusConfig] || statusConfig.open;
  const category = categoryConfig[bounty.category] || categoryConfig.other;
  const StatusIcon = status.icon;
  const deadline = new Date(bounty.deadline);
  const isExpired = deadline < new Date() && bounty.status === "open";
  const isOwner = user?.id === bounty.posterId;
  const paymentStatus = paymentStatusConfig[bounty.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.pending;
  const PaymentIcon = paymentStatus.icon;
  const isFunded = bounty.paymentStatus === "funded" || bounty.paymentStatus === "released";
  const canSubmitAgent = bounty.status === "open" && isFunded;
  
  // Credential requirements - check what's needed and what's consented
  const credentialRequirements = credentialData?.requirements || [];
  const credentialConsents = credentialData?.consents || [];
  const hasCredentialRequirements = credentialRequirements.length > 0;
  const requiredCredentials = credentialRequirements.filter(r => r.isRequired);
  const consentedIds = new Set(credentialConsents.filter(c => c.status === "granted").map(c => c.requirementId));
  const pendingCredentials = requiredCredentials.filter(r => !consentedIds.has(r.id));
  const allCredentialsProvided = requiredCredentials.every(r => consentedIds.has(r.id));

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${status.color}`} />
              <span className="font-semibold truncate max-w-xs sm:max-w-md">{bounty.title}</span>
            </div>
          </div>
          {bounty.status === "open" && (
            <Button 
              onClick={() => {
                if (!isFunded) {
                  toast({
                    title: "Funding Required",
                    description: "This bounty must be funded before agents can submit. Fund it to attract competitors!",
                    variant: "destructive",
                  });
                  return;
                }
                setShowSubmitDialog(true);
              }}
              className={canSubmitAgent 
                ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600" 
                : "bg-muted text-muted-foreground"
              }
              data-testid="button-submit-agent"
            >
              {!isFunded && <Lock className="w-4 h-4 mr-2" />}
              <Bot className="w-4 h-4 mr-2" />
              Submit Agent
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-violet-500/40 via-fuchsia-500/40 to-cyan-500/40">
            <div className="bg-background/95 backdrop-blur-xl rounded-2xl p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge variant="outline" className={`${category.color} border text-xs`}>
                  {category.label}
                </Badge>
                <Badge variant="outline" className={`${status.bg} border text-xs`}>
                  <StatusIcon className={`w-3 h-3 mr-1 ${bounty.status === "in_progress" ? "animate-spin" : ""}`} />
                  {status.label}
                </Badge>
                <Badge variant="outline" className={`${paymentStatus.color} border text-xs`}>
                  <PaymentIcon className="w-3 h-3 mr-1" />
                  {paymentStatus.label}
                </Badge>
              </div>
              
              <h1 
                className="text-2xl md:text-3xl font-bold mb-6" 
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {bounty.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                      ${parseFloat(bounty.reward).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">Reward</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isExpired ? "bg-red-500/20" : "bg-violet-500/20"}`}>
                    <Clock className={`w-5 h-5 ${isExpired ? "text-red-400" : "text-violet-400"}`} />
                  </div>
                  <div>
                    <div className={`font-medium ${isExpired ? "text-red-400" : ""}`}>
                      {isExpired ? "Expired" : formatDistanceToNow(deadline, { addSuffix: true })}
                    </div>
                    <div className="text-xs text-muted-foreground">Deadline</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <Users className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="font-medium">{bounty.submissions?.length || 0}</div>
                    <div className="text-xs text-muted-foreground">Agents</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-medium text-emerald-400">Protected</div>
                    <div className="text-xs text-muted-foreground">Escrow</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {!isFunded && bounty.status === "open" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative rounded-xl p-[1px] bg-gradient-to-r from-amber-500/60 to-orange-500/60"
          >
            <div className="bg-background/95 backdrop-blur-xl rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Fund Your Bounty to Attract Agents
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Agents cannot submit until the bounty is funded. Your payment is held in secure escrow until you approve a winner.
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span>100% Money-Back Guarantee</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="w-4 h-4" />
                      <span>Full refund if no winner selected</span>
                    </div>
                  </div>
                </div>
                {isOwner && (
                  <Button
                    onClick={() => fundBounty.mutate()}
                    disabled={fundBounty.isPending}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30"
                    data-testid="button-fund-bounty-hero"
                  >
                    {fundBounty.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    Fund Now
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <Sparkles className="w-5 h-5 text-violet-400" />
                    Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-muted-foreground">{bounty.description}</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <Target className="w-5 h-5 text-emerald-400" />
                    Success Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {bounty.successMetrics.split('\n').filter(m => m.trim()).map((metric, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <span className="text-muted-foreground">{metric}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <Shield className="w-5 h-5 text-cyan-400" />
                    Verification Criteria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-muted-foreground">{bounty.verificationCriteria}</p>
                </CardContent>
              </Card>
            </motion.div>

            {bounty.submissions && bounty.submissions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      <Bot className="w-5 h-5 text-fuchsia-400" />
                      Agent Submissions ({bounty.submissions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {bounty.submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50 hover-elevate transition-all"
                        data-testid={`submission-${submission.id}`}
                      >
                        <Avatar className="w-12 h-12 rounded-xl">
                          <AvatarFallback
                            className="rounded-xl text-white"
                            style={{ backgroundColor: submission.agent.avatarColor }}
                          >
                            <Bot className="w-6 h-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{submission.agent.name}</span>
                            {submission.agent.isVerified && (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {parseFloat(submission.agent.completionRate || "0").toFixed(0)}%
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              {parseFloat(submission.agent.avgRating || "0").toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <Badge
                            variant="outline"
                            className={
                              submission.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                              submission.status === "rejected" ? "bg-red-500/10 text-red-400 border-red-500/30" :
                              submission.status === "in_progress" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" :
                              submission.status === "submitted" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                              "bg-muted text-muted-foreground border-border"
                            }
                          >
                            {submission.status === "approved" && bounty.winnerId === submission.id ? "Winner" : submission.status.replace("_", " ")}
                          </Badge>
                          {submission.status === "in_progress" && (
                            <div className="flex items-center gap-2">
                              <Progress value={submission.progress || 0} className="w-20 h-2" />
                              <span className="text-xs text-muted-foreground">{submission.progress}%</span>
                            </div>
                          )}
                          {isOwner && bounty.status !== "completed" && bounty.status !== "cancelled" && submission.status === "submitted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSubmissionId(submission.id);
                                setShowWinnerDialog(true);
                              }}
                              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              data-testid={`button-select-winner-${submission.id}`}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Select Winner
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Bounty Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Posted</span>
                    <span className="text-sm font-medium">
                      {format(new Date(bounty.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Deadline</span>
                    <span className={`text-sm font-medium ${isExpired ? "text-red-400" : ""}`}>
                      {format(deadline, "MMM d, yyyy")}
                    </span>
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Platform Fee</span>
                    <span className="text-sm font-medium">15%</span>
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Winner Payout</span>
                    <span className="text-sm font-mono font-bold text-emerald-400">
                      ${(parseFloat(bounty.reward) * 0.85).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {isOwner && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="w-4 h-4" />
                      Payment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant="outline" className={paymentStatus.color}>
                        <PaymentIcon className="w-3 h-3 mr-1" />
                        {paymentStatus.label}
                      </Badge>
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="space-y-3">
                      {bounty.paymentStatus === "pending" && bounty.status !== "cancelled" && (
                        <>
                          <Button 
                            className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600" 
                            onClick={() => fundBounty.mutate()}
                            disabled={fundBounty.isPending}
                            data-testid="button-fund-bounty"
                          >
                            {fundBounty.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <CreditCard className="w-4 h-4 mr-2" />
                            )}
                            Fund Bounty
                          </Button>
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1">
                              <ShieldCheck className="w-3 h-3" />
                              <span className="font-medium">100% Refund Guarantee</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Get a full refund if no agent completes your bounty successfully.
                            </p>
                          </div>
                        </>
                      )}
                      {bounty.paymentStatus === "funded" && bounty.status === "completed" && (
                        <Button 
                          className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600" 
                          onClick={() => releasePayment.mutate()}
                          disabled={releasePayment.isPending}
                          data-testid="button-release-payment"
                        >
                          {releasePayment.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Release Payment
                        </Button>
                      )}
                      {bounty.paymentStatus === "funded" && bounty.status !== "completed" && bounty.status !== "cancelled" && (
                        <Button 
                          variant="outline" 
                          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10" 
                          onClick={() => setShowRefundDialog(true)}
                          data-testid="button-cancel-refund"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Cancel & Refund
                        </Button>
                      )}
                    </div>
                    {bounty.paymentStatus === "pending" && (
                      <p className="text-xs text-muted-foreground">
                        Fund your bounty to attract more agents. Payments are held in escrow until completion.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {isOwner && hasCredentialRequirements && isFunded && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 }}
              >
                <Card className={`bg-background/80 backdrop-blur-sm ${
                  allCredentialsProvided ? "border-emerald-500/30" : "border-amber-500/30"
                }`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Key className="w-4 h-4" />
                      Credentials
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {allCredentialsProvided ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm text-emerald-400 font-medium">All credentials provided</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                          <span className="text-sm text-amber-400">
                            {pendingCredentials.length} credential{pendingCredentials.length > 1 ? "s" : ""} needed
                          </span>
                        </div>
                        <div className="space-y-2">
                          {credentialRequirements.map((req) => {
                            const isConsented = consentedIds.has(req.id);
                            return (
                              <div 
                                key={req.id} 
                                className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${isConsented ? "bg-emerald-400" : "bg-amber-400"}`} />
                                  <span className="text-sm">{req.serviceName}</span>
                                </div>
                                {isConsented ? (
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                                    Provided
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                                    Pending
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <Button 
                          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                          onClick={() => setShowCredentialsDialog(true)}
                          data-testid="button-provide-credentials"
                        >
                          <Key className="w-4 h-4 mr-2" />
                          Provide Credentials
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {bounty.timeline && bounty.timeline.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
              >
                <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/50 via-fuchsia-500/50 to-cyan-500/50" />
                      <div className="space-y-4">
                        {bounty.timeline.map((event, i) => (
                          <div key={i} className="relative pl-8">
                            <div className="absolute left-0 w-6 h-6 rounded-full bg-background border-2 border-violet-500/50 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-violet-500" />
                            </div>
                            <div className="text-sm font-medium">{event.description}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(event.createdAt), "MMM d, h:mm a")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="bg-background/95 backdrop-blur-xl border-violet-500/20">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Submit Agent to Bounty</DialogTitle>
            <DialogDescription>
              Select one of your registered agents to compete for this bounty.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger data-testid="select-agent" className="border-border/50">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {myAgents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ backgroundColor: agent.avatarColor }}
                      >
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      {agent.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(!myAgents || myAgents.length === 0) && (
              <p className="text-sm text-muted-foreground">
                You don't have any agents registered yet.{" "}
                <Link href="/agents/create" className="text-violet-400 underline">
                  Register an agent
                </Link>{" "}
                first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => submitAgent.mutate()}
              disabled={!selectedAgentId || submitAgent.isPending}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
              data-testid="button-confirm-submit"
            >
              {submitAgent.isPending ? "Submitting..." : "Submit Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent className="bg-background/95 backdrop-blur-xl border-red-500/20">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Cancel Bounty & Request Refund</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this bounty? The full payment will be refunded to your original payment method. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefundDialog(false)}>
              Keep Bounty
            </Button>
            <Button
              variant="destructive"
              onClick={() => refundPayment.mutate()}
              disabled={refundPayment.isPending}
              data-testid="button-confirm-refund"
            >
              {refundPayment.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Cancel & Refund"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
        <DialogContent className="bg-background/95 backdrop-blur-xl border-emerald-500/20">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Confirm Winner Selection</DialogTitle>
            <DialogDescription>
              Are you sure you want to select this agent as the winner? This will complete the bounty and allow you to release the payment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowWinnerDialog(false);
              setSelectedSubmissionId(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedSubmissionId && selectWinner.mutate(selectedSubmissionId)}
              disabled={!selectedSubmissionId || selectWinner.isPending}
              className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
              data-testid="button-confirm-winner"
            >
              {selectWinner.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Selecting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Winner
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="bg-background/95 backdrop-blur-xl border-amber-500/20 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Provide Credentials</DialogTitle>
            <DialogDescription>
              This bounty requires access to your accounts. Provide credentials securely to enable agents to complete the task.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <CredentialConsentForm
              bountyId={parseInt(id || "0")}
              onConsentComplete={() => {
                setShowCredentialsDialog(false);
                queryClient.invalidateQueries({ queryKey: ["/api/bounties", id, "credentials"] });
                toast({
                  title: "Credentials Saved",
                  description: "Your credentials have been securely stored.",
                });
              }}
              onCancel={() => setShowCredentialsDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
