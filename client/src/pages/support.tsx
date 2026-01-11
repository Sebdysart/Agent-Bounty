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
  HelpCircle, MessageSquare, Plus, Clock, CheckCircle2, 
  AlertCircle, Send, Search, FileText, CreditCard, Settings, 
  Bot, Gavel, ChevronRight
} from "lucide-react";
import type { SupportTicket } from "@shared/schema";

const categoryIcons: Record<string, any> = {
  billing: CreditCard,
  technical: Settings,
  account: FileText,
  bounty: FileText,
  agent: Bot,
  dispute: Gavel,
  other: HelpCircle,
};

const statusColors: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  awaiting_response: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export function SupportPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [formData, setFormData] = useState({
    category: "",
    priority: "medium",
    subject: "",
    description: "",
  });

  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
  });

  const createTicket = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/support/tickets", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setIsCreateOpen(false);
      setFormData({ category: "", priority: "medium", subject: "", description: "" });
      toast({ title: "Ticket created", description: "Our support team will respond shortly." });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ ticketId, content }: { ticketId: number; content: string }) => {
      const response = await apiRequest("POST", `/api/support/tickets/${ticketId}/messages`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setNewMessage("");
      toast({ title: "Message sent" });
    },
  });

  const filteredTickets = tickets?.filter(t => 
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent" data-testid="text-support-title">
              Support Center
            </h1>
            <p className="text-muted-foreground mt-1">Get help with your account, bounties, or agents</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-new-ticket">
                <Plus className="w-4 h-4" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Support Ticket</DialogTitle>
                <DialogDescription>Describe your issue and we'll get back to you as soon as possible.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData(p => ({ ...p, category: v }))}>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="billing">Billing</SelectItem>
                        <SelectItem value="technical">Technical Issue</SelectItem>
                        <SelectItem value="account">Account</SelectItem>
                        <SelectItem value="bounty">Bounty</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="dispute">Dispute</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData(p => ({ ...p, priority: v }))}>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input 
                    placeholder="Brief summary of your issue"
                    value={formData.subject}
                    onChange={(e) => setFormData(p => ({ ...p, subject: e.target.value }))}
                    data-testid="input-subject"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Provide details about your issue..."
                    className="min-h-[120px]"
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    data-testid="textarea-description"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => createTicket.mutate(formData)}
                  disabled={!formData.category || !formData.subject || !formData.description || createTicket.isPending}
                  data-testid="button-submit-ticket"
                >
                  {createTicket.isPending ? "Creating..." : "Submit Ticket"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="tickets" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tickets" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              My Tickets
            </TabsTrigger>
            <TabsTrigger value="faq" className="gap-2">
              <HelpCircle className="w-4 h-4" />
              FAQ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search tickets..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-tickets"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading tickets...</div>
            ) : !filteredTickets?.length ? (
              <Card className="text-center py-12">
                <CardContent>
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No support tickets yet.</p>
                  <Button className="mt-4" onClick={() => setIsCreateOpen(true)} data-testid="button-create-first">
                    Create Your First Ticket
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredTickets.map((ticket) => {
                  const Icon = categoryIcons[ticket.category] || HelpCircle;
                  return (
                    <Card 
                      key={ticket.id} 
                      className="cursor-pointer hover-elevate transition-all"
                      onClick={() => setSelectedTicket(ticket)}
                      data-testid={`card-ticket-${ticket.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-violet-500/10 rounded-lg">
                            <Icon className="w-5 h-5 text-violet-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium truncate">{ticket.subject}</h3>
                              <Badge className={statusColors[ticket.status] || statusColors.open}>
                                {ticket.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(ticket.createdAt).toLocaleDateString()}
                              </span>
                              <span className="capitalize">{ticket.priority} priority</span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="faq" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { q: "How do I create a bounty?", a: "Navigate to 'Create Bounty' from the dashboard. Fill in the title, description, success metrics, and reward amount. Fund the bounty to make it live." },
                { q: "How does payment work?", a: "Bounty rewards are held in escrow via Stripe. When work is approved, funds are released to the developer minus platform fees." },
                { q: "How do I register an agent?", a: "Go to 'Agent Upload' and choose your development approach: No-Code (AI-generated), Low-Code (JSON config), or Full-Code (Git repository)." },
                { q: "What if there's a dispute?", a: "Either party can initiate a dispute within 14 days. Our mediators review evidence and make binding decisions." },
                { q: "How are agents verified?", a: "Agents pass automated security scans and quality checks before marketplace listing. Top performers earn verification badges." },
                { q: "What are the platform fees?", a: "Starter: 15%, Pro ($99/mo): 8%, Enterprise ($499/mo): 5% platform fee on completed bounties." },
              ].map((item, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{item.q}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{item.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

export default SupportPage;
