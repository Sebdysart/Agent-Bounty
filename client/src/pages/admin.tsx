import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Shield, Users, Bot, FileText, AlertTriangle, CheckCircle2,
  XCircle, Eye, Ban, Flag, TrendingUp, Clock, Search,
  BarChart3, Activity, Gavel, MessageSquare
} from "lucide-react";

export function AdminDashboardPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats } = useQuery<{
    totalUsers: number;
    totalBounties: number;
    totalAgents: number;
    pendingReviews: number;
    openDisputes: number;
    openTickets: number;
  }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: pendingAgents } = useQuery({
    queryKey: ["/api/admin/agents/pending"],
    enabled: activeTab === "agents",
  });

  const { data: contentFlags } = useQuery({
    queryKey: ["/api/admin/flags"],
    enabled: activeTab === "moderation",
  });

  const approveAgent = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest("POST", `/api/admin/agents/${agentId}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents/pending"] });
      toast({ title: "Agent approved" });
    },
  });

  const rejectAgent = useMutation({
    mutationFn: async ({ agentId, reason }: { agentId: number; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/agents/${agentId}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents/pending"] });
      toast({ title: "Agent rejected" });
    },
  });

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-lg">
              <Shield className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent" data-testid="text-admin-title">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground">Platform management and moderation</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-xl font-bold">{stats?.totalUsers || 0}</p>
                  <p className="text-xs text-muted-foreground">Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-xl font-bold">{stats?.totalBounties || 0}</p>
                  <p className="text-xs text-muted-foreground">Bounties</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-violet-400" />
                <div>
                  <p className="text-xl font-bold">{stats?.totalAgents || 0}</p>
                  <p className="text-xs text-muted-foreground">Agents</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-xl font-bold">{stats?.pendingReviews || 0}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Gavel className="w-5 h-5 text-orange-400" />
                <div>
                  <p className="text-xl font-bold">{stats?.openDisputes || 0}</p>
                  <p className="text-xs text-muted-foreground">Disputes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-xl font-bold">{stats?.openTickets || 0}</p>
                  <p className="text-xs text-muted-foreground">Tickets</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2">
              <Bot className="w-4 h-4" />
              Agents
            </TabsTrigger>
            <TabsTrigger value="moderation" className="gap-2">
              <Flag className="w-4 h-4" />
              Moderation
            </TabsTrigger>
            <TabsTrigger value="disputes" className="gap-2">
              <Gavel className="w-4 h-4" />
              Disputes
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Support
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-violet-400" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { action: "New agent submitted for review", time: "5 min ago", type: "info" },
                      { action: "Dispute resolved - Bounty #142", time: "1 hour ago", type: "success" },
                      { action: "Content flagged for review", time: "2 hours ago", type: "warning" },
                      { action: "New enterprise user registered", time: "3 hours ago", type: "info" },
                      { action: "Payment released - $2,500", time: "4 hours ago", type: "success" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          item.type === "success" ? "bg-green-500" :
                          item.type === "warning" ? "bg-yellow-500" : "bg-blue-500"
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm">{item.action}</p>
                          <p className="text-xs text-muted-foreground">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Platform Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: "Bounty Completion Rate", value: "78%", trend: "+5%" },
                      { label: "Avg. Time to Resolution", value: "18 hours", trend: "-2h" },
                      { label: "Agent Success Rate", value: "82%", trend: "+3%" },
                      { label: "Dispute Rate", value: "4.2%", trend: "-0.5%" },
                      { label: "User Satisfaction", value: "4.6/5", trend: "+0.2" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.value}</span>
                          <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
                            {item.trend}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" data-testid="button-review-agents">
                    <Bot className="w-5 h-5" />
                    <span>Review Agents</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" data-testid="button-handle-disputes">
                    <Gavel className="w-5 h-5" />
                    <span>Handle Disputes</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" data-testid="button-moderate-content">
                    <Flag className="w-5 h-5" />
                    <span>Moderate Content</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" data-testid="button-view-reports">
                    <BarChart3 className="w-5 h-5" />
                    <span>View Reports</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search agents..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-agents"
                />
              </div>
              <Select defaultValue="pending">
                <SelectTrigger className="w-48" data-testid="select-agent-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pending Agent Reviews</CardTitle>
                <CardDescription>Review and approve agent submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No agents pending review</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="moderation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Flagged Content</CardTitle>
                <CardDescription>Review reported content and take action</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No flagged content to review</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="disputes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Disputes</CardTitle>
                <CardDescription>Mediate and resolve user disputes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Gavel className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No active disputes requiring mediation</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Support Tickets</CardTitle>
                <CardDescription>Manage customer support requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No open support tickets</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

export default AdminDashboardPage;
