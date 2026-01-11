import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Gavel, AlertTriangle, Clock, CheckCircle2, XCircle, 
  MessageSquare, FileText, Plus, ChevronRight, Scale, Users
} from "lucide-react";
import type { Dispute, Bounty } from "@shared/schema";

const statusColors: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  awaiting_response: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  escalated: "bg-red-500/20 text-red-400 border-red-500/30",
  closed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const resolutionLabels: Record<string, string> = {
  in_favor_business: "Resolved in favor of business",
  in_favor_developer: "Resolved in favor of developer",
  partial_refund: "Partial refund issued",
  full_refund: "Full refund issued",
  no_action: "No action taken",
  mediated: "Mediated agreement",
};

export function DisputesPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [formData, setFormData] = useState({
    bountyId: "",
    category: "",
    title: "",
    description: "",
    evidence: "",
  });

  const { data: disputes, isLoading } = useQuery<Dispute[]>({
    queryKey: ["/api/disputes"],
  });

  const { data: myBounties } = useQuery<Bounty[]>({
    queryKey: ["/api/bounties/mine"],
  });

  const createDispute = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/disputes", {
        ...data,
        bountyId: parseInt(data.bountyId),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disputes"] });
      setIsCreateOpen(false);
      setFormData({ bountyId: "", category: "", title: "", description: "", evidence: "" });
      toast({ title: "Dispute filed", description: "Our team will review your case." });
    },
    onError: () => {
      toast({ title: "Failed to create dispute", variant: "destructive" });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ disputeId, content }: { disputeId: number; content: string }) => {
      const response = await apiRequest("POST", `/api/disputes/${disputeId}/messages`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disputes"] });
      setNewMessage("");
    },
  });

  const openDisputes = disputes?.filter(d => !["resolved", "closed"].includes(d.status)) || [];
  const resolvedDisputes = disputes?.filter(d => ["resolved", "closed"].includes(d.status)) || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent" data-testid="text-disputes-title">
              Dispute Resolution
            </h1>
            <p className="text-muted-foreground mt-1">Manage and resolve bounty disputes fairly</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-new-dispute">
                <Plus className="w-4 h-4" />
                File Dispute
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>File a Dispute</DialogTitle>
                <DialogDescription>
                  Please provide detailed information about your dispute. Both parties will have the opportunity to present evidence.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Related Bounty</Label>
                  <Select value={formData.bountyId} onValueChange={(v) => setFormData(p => ({ ...p, bountyId: v }))}>
                    <SelectTrigger data-testid="select-bounty">
                      <SelectValue placeholder="Select a bounty..." />
                    </SelectTrigger>
                    <SelectContent>
                      {myBounties?.map(b => (
                        <SelectItem key={b.id} value={b.id.toString()}>{b.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dispute Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData(p => ({ ...p, category: v }))}>
                    <SelectTrigger data-testid="select-dispute-category">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quality">Output Quality</SelectItem>
                      <SelectItem value="incomplete">Incomplete Work</SelectItem>
                      <SelectItem value="criteria_mismatch">Criteria Mismatch</SelectItem>
                      <SelectItem value="deadline_missed">Deadline Missed</SelectItem>
                      <SelectItem value="payment_issue">Payment Issue</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dispute Title</Label>
                  <Input 
                    placeholder="Brief summary of the dispute"
                    value={formData.title}
                    onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                    data-testid="input-dispute-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Describe the issue in detail..."
                    className="min-h-[100px]"
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    data-testid="textarea-dispute-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Evidence (Optional)</Label>
                  <Textarea 
                    placeholder="Provide any supporting evidence, links, or documentation..."
                    className="min-h-[80px]"
                    value={formData.evidence}
                    onChange={(e) => setFormData(p => ({ ...p, evidence: e.target.value }))}
                    data-testid="textarea-dispute-evidence"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => createDispute.mutate(formData)}
                  disabled={!formData.bountyId || !formData.category || !formData.title || !formData.description || createDispute.isPending}
                  data-testid="button-submit-dispute"
                >
                  {createDispute.isPending ? "Filing..." : "Submit Dispute"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Scale className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{openDisputes.length}</p>
                  <p className="text-sm text-muted-foreground">Active Disputes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{resolvedDisputes.length}</p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-violet-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">~24h</p>
                  <p className="text-sm text-muted-foreground">Avg. Response Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Active ({openDisputes.length})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Resolved ({resolvedDisputes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading disputes...</div>
            ) : !openDisputes.length ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Gavel className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No active disputes. That's great!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {openDisputes.map((dispute) => (
                  <Card 
                    key={dispute.id} 
                    className="cursor-pointer hover-elevate transition-all"
                    onClick={() => setSelectedDispute(dispute)}
                    data-testid={`card-dispute-${dispute.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                          <Gavel className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{dispute.title}</h3>
                            <Badge className={statusColors[dispute.status] || statusColors.open}>
                              {dispute.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{dispute.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Filed {new Date(dispute.createdAt).toLocaleDateString()}
                            </span>
                            <span className="capitalize">{dispute.category}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolved" className="space-y-4">
            {!resolvedDisputes.length ? (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground">No resolved disputes yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {resolvedDisputes.map((dispute) => (
                  <Card key={dispute.id} className="opacity-75" data-testid={`card-resolved-dispute-${dispute.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{dispute.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {dispute.resolution ? resolutionLabels[dispute.resolution] : "Closed"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Resolved {dispute.resolvedAt ? new Date(dispute.resolvedAt).toLocaleDateString() : ""}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dispute Resolution Process</CardTitle>
            <CardDescription>How we handle disputes fairly</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { step: 1, title: "File Dispute", desc: "Submit your case with evidence within 14 days" },
                { step: 2, title: "Response", desc: "Other party has 5 days to respond" },
                { step: 3, title: "Review", desc: "Our mediators examine all evidence" },
                { step: 4, title: "Resolution", desc: "Final binding decision is made" },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold mx-auto mb-2">
                    {item.step}
                  </div>
                  <h4 className="font-medium text-sm">{item.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default DisputesPage;
