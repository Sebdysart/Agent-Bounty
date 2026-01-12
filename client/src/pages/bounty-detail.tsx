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
import { ArrowLeft, Clock, Users, Shield, DollarSign, CheckCircle, AlertCircle, Loader2, XCircle, Timer, Bot, Star, TrendingUp, Calendar, Target, CreditCard, RefreshCw, Wallet } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { Bounty, Agent, Submission } from "@shared/schema";

interface BountyWithDetails extends Bounty {
  submissions: (Submission & { agent: Agent })[];
  timeline: { status: string; description: string; createdAt: string }[];
}

const statusConfig = {
  open: { color: "border-l-primary", icon: Timer, label: "Open", bg: "bg-primary/10 text-primary" },
  in_progress: { color: "border-l-info", icon: Loader2, label: "In Progress", bg: "bg-info/10 text-info" },
  under_review: { color: "border-l-warning", icon: AlertCircle, label: "Under Review", bg: "bg-warning/10 text-warning" },
  completed: { color: "border-l-success", icon: CheckCircle, label: "Completed", bg: "bg-success/10 text-success" },
  failed: { color: "border-l-destructive", icon: XCircle, label: "Failed", bg: "bg-destructive/10 text-destructive" },
  cancelled: { color: "border-l-muted", icon: XCircle, label: "Cancelled", bg: "bg-muted text-muted-foreground" },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  marketing: { label: "Marketing", color: "bg-chart-1/10 text-chart-1" },
  sales: { label: "Sales", color: "bg-chart-2/10 text-chart-2" },
  research: { label: "Research", color: "bg-chart-3/10 text-chart-3" },
  data_analysis: { label: "Data Analysis", color: "bg-chart-4/10 text-chart-4" },
  development: { label: "Development", color: "bg-chart-5/10 text-chart-5" },
  other: { label: "Other", color: "bg-muted text-muted-foreground" },
};

const paymentStatusConfig = {
  pending: { label: "Not Funded", color: "bg-warning/10 text-warning", icon: Wallet },
  funded: { label: "Funded (Escrow)", color: "bg-success/10 text-success", icon: Shield },
  released: { label: "Payment Released", color: "bg-info/10 text-info", icon: CheckCircle },
  refunded: { label: "Refunded", color: "bg-muted text-muted-foreground", icon: RefreshCw },
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

  const { data: bounty, isLoading } = useQuery<BountyWithDetails>({
    queryKey: ["/api/bounties", id],
  });

  const { data: myAgents } = useQuery<Agent[]>({
    queryKey: ["/api/agents/mine"],
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
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
          <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-8">
          <div className="space-y-6">
            <div className="h-8 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-32 bg-muted animate-pulse rounded-lg" />
            <div className="h-48 bg-muted animate-pulse rounded-lg" />
          </div>
        </main>
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Target className="w-16 h-16 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Bounty not found</h2>
          <Button onClick={() => navigate("/")}>Go back to dashboard</Button>
        </div>
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <span className="font-semibold truncate max-w-xs sm:max-w-md">{bounty.title}</span>
          </div>
          {bounty.status === "open" && (
            <Button onClick={() => setShowSubmitDialog(true)} data-testid="button-submit-agent">
              <Bot className="w-4 h-4 mr-2" />
              Submit Agent
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className={`border-l-4 ${status.color} pl-6`}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="secondary" className={`${category.color} text-xs`}>
              {category.label}
            </Badge>
            <Badge variant="secondary" className={`${status.bg} text-xs`}>
              <StatusIcon className={`w-3 h-3 mr-1 ${bounty.status === "in_progress" ? "animate-spin" : ""}`} />
              {status.label}
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-4">{bounty.title}</h1>
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-2xl font-bold font-mono text-success">
              <DollarSign className="w-6 h-6" />
              {parseFloat(bounty.reward).toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Clock className={isExpired ? "text-destructive" : ""} />
              <span className={isExpired ? "text-destructive" : ""}>
                {isExpired ? "Expired" : `Due ${formatDistanceToNow(deadline, { addSuffix: true })}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users />
              {bounty.submissions?.length || 0} agents
            </div>
            <div className="flex items-center gap-2">
              <Shield className="text-success" />
              Escrow Protected
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{bounty.description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  Success Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {bounty.successMetrics.split('\n').map((metric, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle className="w-3.5 h-3.5 text-success" />
                      </div>
                      <span>{metric}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-info" />
                  Verification Criteria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{bounty.verificationCriteria}</p>
              </CardContent>
            </Card>

            {bounty.submissions && bounty.submissions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    Agent Submissions ({bounty.submissions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bounty.submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
                      data-testid={`submission-${submission.id}`}
                    >
                      <Avatar className="w-10 h-10 rounded-lg">
                        <AvatarFallback
                          className="rounded-lg text-white"
                          style={{ backgroundColor: submission.agent.avatarColor }}
                        >
                          <Bot className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{submission.agent.name}</span>
                          {submission.agent.isVerified && (
                            <CheckCircle className="w-3 h-3 text-success" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {parseFloat(submission.agent.completionRate || "0").toFixed(0)}%
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-warning fill-warning" />
                            {parseFloat(submission.agent.avgRating || "0").toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <Badge
                          variant="secondary"
                          className={
                            submission.status === "approved" ? "bg-success/10 text-success" :
                            submission.status === "rejected" ? "bg-destructive/10 text-destructive" :
                            submission.status === "in_progress" ? "bg-info/10 text-info" :
                            submission.status === "submitted" ? "bg-warning/10 text-warning" :
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {submission.status === "approved" && bounty.winnerId === submission.id ? "Winner" : submission.status.replace("_", " ")}
                        </Badge>
                        {submission.status === "in_progress" && (
                          <div>
                            <Progress value={submission.progress || 0} className="w-24 h-2" />
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
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Bounty Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Posted</span>
                  <span className="text-sm font-medium">
                    {format(new Date(bounty.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Deadline</span>
                  <span className={`text-sm font-medium ${isExpired ? "text-destructive" : ""}`}>
                    {format(deadline, "MMM d, yyyy")}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Platform Fee</span>
                  <span className="text-sm font-medium">15%</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Winner Payout</span>
                  <span className="text-sm font-mono font-bold text-success">
                    ${(parseFloat(bounty.reward) * 0.85).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {isOwner && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant="secondary" className={paymentStatus.color}>
                      <PaymentIcon className="w-3 h-3 mr-1" />
                      {paymentStatus.label}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {bounty.paymentStatus === "pending" && bounty.status !== "cancelled" && (
                      <Button 
                        className="w-full" 
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
                    )}
                    {bounty.paymentStatus === "funded" && bounty.status === "completed" && (
                      <Button 
                        className="w-full" 
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
                        className="w-full text-destructive hover:text-destructive" 
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
            )}

            {bounty.timeline && bounty.timeline.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4">
                      {bounty.timeline.map((event, i) => (
                        <div key={i} className="relative pl-8">
                          <div className="absolute left-0 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-primary" />
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
            )}
          </div>
        </div>
      </main>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Agent to Bounty</DialogTitle>
            <DialogDescription>
              Select one of your registered agents to compete for this bounty.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger data-testid="select-agent">
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
                <Link href="/agents/create" className="text-primary underline">
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
              data-testid="button-confirm-submit"
            >
              {submitAgent.isPending ? "Submitting..." : "Submit Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Bounty & Request Refund</DialogTitle>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Winner Selection</DialogTitle>
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
    </div>
  );
}
