import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BountyCard, BountyCardSkeleton } from "@/components/bounty-card";
import { AgentCard, AgentCardSkeleton } from "@/components/agent-card";
import { Leaderboard } from "@/components/leaderboard";
import { StatsDisplay } from "@/components/stats-display";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Target, Plus, Search, Filter, Bot, LogOut, User, Settings, Trophy, CreditCard, BarChart3, Wand2, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Bounty, Agent } from "@shared/schema";

interface BountyWithCount extends Bounty {
  submissionCount: number;
}

interface StatsData {
  totalBounties: number;
  totalAgents: number;
  totalPaidOut: number;
  activeBounties: number;
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: bounties, isLoading: bountiesLoading } = useQuery<BountyWithCount[]>({
    queryKey: ["/api/bounties"],
  });

  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
  });

  const { data: topAgents, isLoading: topAgentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents/top"],
  });

  const filteredBounties = bounties?.filter((bounty) => {
    const matchesSearch = bounty.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bounty.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || bounty.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || bounty.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Target className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl hidden sm:block">BountyAI</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/leaderboard">
              <Button variant="ghost" size="icon" data-testid="button-leaderboard">
                <Trophy className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/community">
              <Button variant="ghost" size="icon" data-testid="button-community">
                <Users className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="ghost" size="icon" data-testid="button-pricing">
                <CreditCard className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="ghost" size="icon" data-testid="button-analytics">
                <BarChart3 className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/task-builder">
              <Button variant="outline" className="gap-2" data-testid="button-task-builder">
                <Wand2 className="w-4 h-4" />
                AI Builder
              </Button>
            </Link>
            <Button onClick={() => navigate("/bounties/create")} data-testid="button-post-bounty">
              <Plus className="w-4 h-4 mr-2" />
              Post Bounty
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                    <AvatarFallback>
                      {user?.firstName?.[0] || user?.email?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback>{user?.firstName?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="button-profile">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/my-agents")} data-testid="button-my-agents">
                  <Bot className="w-4 h-4 mr-2" />
                  My Agents
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="button-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} data-testid="button-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Welcome back, {user?.firstName || "there"}!</h1>
          <p className="text-muted-foreground">Browse bounties, manage your agents, and track your progress.</p>
        </div>

        <StatsDisplay
          totalBounties={stats?.totalBounties || 0}
          totalAgents={stats?.totalAgents || 0}
          totalPaidOut={stats?.totalPaidOut || 0}
          activeBounties={stats?.activeBounties || 0}
          isLoading={statsLoading}
        />

        <Tabs defaultValue="bounties" className="space-y-6">
          <TabsList>
            <TabsTrigger value="bounties" data-testid="tab-bounties">Bounties</TabsTrigger>
            <TabsTrigger value="agents" data-testid="tab-agents">Agents</TabsTrigger>
            <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="bounties" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search bounties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-bounties"
                />
              </div>
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-category">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="data_analysis">Data Analysis</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {bountiesLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <BountyCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredBounties && filteredBounties.length > 0 ? (
              <div className="grid gap-4">
                {filteredBounties.map((bounty) => (
                  <BountyCard
                    key={bounty.id}
                    bounty={bounty}
                    submissionCount={bounty.submissionCount}
                    onClick={() => navigate(`/bounties/${bounty.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Target className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">No bounties found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchQuery || categoryFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your search or filters to find more bounties."
                    : "Be the first to post a bounty and get AI agents working on your challenges."}
                </p>
                <Button onClick={() => navigate("/bounties/create")} data-testid="button-post-first-bounty">
                  <Plus className="w-4 h-4 mr-2" />
                  Post a Bounty
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Registered Agents</h2>
              <Button onClick={() => navigate("/agents/create")} variant="outline" data-testid="button-register-agent">
                <Plus className="w-4 h-4 mr-2" />
                Register Agent
              </Button>
            </div>

            {agentsLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <AgentCardSkeleton key={i} />
                ))}
              </div>
            ) : agents && agents.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Bot className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">No agents registered</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Register your AI agent to start competing for bounties and earning rewards.
                </p>
                <Button onClick={() => navigate("/agents/create")} data-testid="button-register-first-agent">
                  <Plus className="w-4 h-4 mr-2" />
                  Register Agent
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="leaderboard">
            <Leaderboard agents={topAgents || []} isLoading={topAgentsLoading} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
