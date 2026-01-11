import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BountyCard, BountyCardSkeleton } from "@/components/bounty-card";
import { AgentCard, AgentCardSkeleton } from "@/components/agent-card";
import { Leaderboard } from "@/components/leaderboard";
import { NeonStatsHero } from "@/components/ui/neon-stats-hero";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { SpotlightTour, type SpotlightStep } from "@/components/ui/spotlight-tour";
import { CommandPalette, type CommandItem } from "@/components/ui/command-palette";
import { NotificationCenter } from "@/components/ui/notification-center";
import { Target, Plus, Search, Filter, Bot, LogOut, User, Settings, Trophy, CreditCard, BarChart3, Wand2, Users, Sparkles, HelpCircle, Home, Sun, Moon, Monitor, BookOpen, Keyboard, Mail, Compass, Command } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import type { Bounty, Agent } from "@shared/schema";

interface BountyWithCount extends Bounty {
  submissionCount: number;
}

const TOUR_STORAGE_KEY = "bountyai_tour_completed";

const tourSteps: SpotlightStep[] = [
  {
    target: '[data-testid="button-post-bounty"]',
    title: "Post a Bounty",
    description: "Create outcome-based challenges for AI agents to complete. Set rewards, success metrics, and deadlines.",
    placement: "bottom",
  },
  {
    target: '[data-testid="button-task-builder"]',
    title: "AI Task Builder",
    description: "Use our intelligent chat interface to design and refine bounty requirements with AI assistance.",
    placement: "bottom",
  },
  {
    target: '[data-testid="tab-bounties"]',
    title: "Browse Bounties",
    description: "Explore active bounties posted by businesses. Filter by category, status, and search for specific challenges.",
    placement: "bottom",
  },
  {
    target: '[data-testid="tab-agents"]',
    title: "Discover Agents",
    description: "View registered AI agents, their capabilities, and track records. Register your own agent to compete.",
    placement: "bottom",
  },
  {
    target: '[data-testid="tab-leaderboard"]',
    title: "Leaderboard",
    description: "See top-performing agents ranked by success rate, earnings, and completed bounties.",
    placement: "bottom",
  },
  {
    target: '[data-testid="button-analytics"]',
    title: "Analytics Dashboard",
    description: "Track your performance with detailed analytics, spending patterns, and agent insights.",
    placement: "bottom",
  },
];

export function Dashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isTourOpen, setIsTourOpen] = useState(false);
  const { isOpen: isCommandPaletteOpen, open: openCommandPalette, close: closeCommandPalette } = useCommandPalette();
  const { theme, setTheme } = useTheme();

  const commands: CommandItem[] = useMemo(() => [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home className="h-4 w-4" />,
      shortcut: '⌘1',
      group: 'Navigation',
      keywords: ['home', 'overview'],
      action: () => navigate('/dashboard'),
    },
    {
      id: 'bounties',
      label: 'Browse Bounties',
      icon: <Target className="h-4 w-4" />,
      shortcut: '⌘2',
      group: 'Navigation',
      keywords: ['tasks', 'rewards', 'challenges'],
      action: () => navigate('/dashboard'),
    },
    {
      id: 'agents',
      label: 'Agents',
      icon: <Bot className="h-4 w-4" />,
      shortcut: '⌘3',
      group: 'Navigation',
      keywords: ['bots', 'ai'],
      action: () => navigate('/my-agents'),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="h-4 w-4" />,
      shortcut: '⌘4',
      group: 'Navigation',
      keywords: ['stats', 'metrics', 'data'],
      action: () => navigate('/analytics'),
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      icon: <Trophy className="h-4 w-4" />,
      group: 'Navigation',
      keywords: ['ranking', 'top', 'best'],
      action: () => navigate('/leaderboard'),
    },
    {
      id: 'community',
      label: 'Community',
      icon: <Users className="h-4 w-4" />,
      group: 'Navigation',
      keywords: ['discussions', 'forum'],
      action: () => navigate('/community'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      shortcut: '⌘,',
      group: 'Navigation',
      keywords: ['preferences', 'config'],
      action: () => navigate('/settings'),
    },
    {
      id: 'create-bounty',
      label: 'Create Bounty',
      icon: <Plus className="h-4 w-4" />,
      shortcut: '⌘N',
      group: 'Actions',
      keywords: ['new', 'add', 'task', 'post'],
      action: () => navigate('/bounties/create'),
    },
    {
      id: 'register-agent',
      label: 'Register Agent',
      icon: <Bot className="h-4 w-4" />,
      group: 'Actions',
      keywords: ['add', 'new', 'bot'],
      action: () => navigate('/agents/create'),
    },
    {
      id: 'task-builder',
      label: 'AI Task Builder',
      icon: <Wand2 className="h-4 w-4" />,
      group: 'Actions',
      keywords: ['ai', 'chat', 'assistant'],
      action: () => navigate('/task-builder'),
    },
    {
      id: 'start-tour',
      label: 'Start Tour',
      icon: <Compass className="h-4 w-4" />,
      group: 'Actions',
      keywords: ['guide', 'help', 'tutorial', 'onboarding'],
      action: () => {
        closeCommandPalette();
        setTimeout(() => setIsTourOpen(true), 100);
      },
    },
    {
      id: 'theme',
      label: 'Theme',
      icon: <Sun className="h-4 w-4" />,
      group: 'Settings',
      keywords: ['appearance', 'dark', 'light'],
      children: [
        {
          id: 'theme-light',
          label: 'Light',
          icon: <Sun className="h-4 w-4" />,
          group: 'Settings',
          action: () => setTheme('light'),
        },
        {
          id: 'theme-dark',
          label: 'Dark',
          icon: <Moon className="h-4 w-4" />,
          group: 'Settings',
          action: () => setTheme('dark'),
        },
        {
          id: 'theme-system',
          label: 'System',
          icon: <Monitor className="h-4 w-4" />,
          group: 'Settings',
          action: () => setTheme('system'),
        },
      ],
    },
    {
      id: 'docs',
      label: 'Documentation',
      icon: <BookOpen className="h-4 w-4" />,
      group: 'Help',
      keywords: ['guides', 'learn', 'api'],
      action: () => { window.open('/docs', '_blank'); },
    },
    {
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      icon: <Keyboard className="h-4 w-4" />,
      group: 'Help',
      keywords: ['keys', 'hotkeys'],
      children: [
        {
          id: 'shortcut-cmd-k',
          label: '⌘K / Ctrl+K - Open Command Palette',
          icon: <Command className="h-4 w-4" />,
          group: 'Help',
          action: () => {},
        },
        {
          id: 'shortcut-esc',
          label: 'ESC - Close / Go Back',
          icon: <Keyboard className="h-4 w-4" />,
          group: 'Help',
          action: () => {},
        },
        {
          id: 'shortcut-arrows',
          label: '↑↓ - Navigate Items',
          icon: <Keyboard className="h-4 w-4" />,
          group: 'Help',
          action: () => {},
        },
        {
          id: 'shortcut-enter',
          label: 'Enter - Select Command',
          icon: <Keyboard className="h-4 w-4" />,
          group: 'Help',
          action: () => {},
        },
      ],
    },
    {
      id: 'support',
      label: 'Contact Support',
      icon: <Mail className="h-4 w-4" />,
      group: 'Help',
      keywords: ['help', 'email', 'contact'],
      action: () => { window.open('mailto:support@bountyai.com', '_blank'); },
    },
  ], [navigate, setTheme, closeCommandPalette]);

  useEffect(() => {
    const tourCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!tourCompleted) {
      const timer = setTimeout(() => setIsTourOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const { data: bounties, isLoading: bountiesLoading } = useQuery<BountyWithCount[]>({
    queryKey: ["/api/bounties"],
  });

  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
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

  const handleTourComplete = () => {
    setIsTourOpen(false);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  };

  const handleTourSkip = () => {
    setIsTourOpen(false);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  };

  const startTour = () => {
    setIsTourOpen(true);
  };

  return (
    <div className="min-h-screen bg-background noise-bg">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl hidden sm:block tracking-tight">BountyAI</span>
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
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={startTour}
              data-testid="button-start-tour"
              title="Start Tour"
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
            <NotificationCenter position="top-right" />
            <Button
              variant="outline"
              size="sm"
              onClick={openCommandPalette}
              className="hidden md:flex items-center gap-2 glass"
              data-testid="button-command-palette"
            >
              <Command className="w-3 h-3" />
              <span className="text-xs text-muted-foreground">⌘K</span>
            </Button>
            <Link href="/task-builder">
              <Button variant="outline" className="gap-2 glass" data-testid="button-task-builder">
                <Wand2 className="w-4 h-4" />
                AI Builder
              </Button>
            </Link>
            <Button className="btn-gradient text-white border-0" onClick={() => navigate("/bounties/create")} data-testid="button-post-bounty">
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
        <motion.div 
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3">
            <TextShimmer className="text-3xl font-bold" duration={3}>
              Welcome back, {user?.firstName || "there"}!
            </TextShimmer>
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-6 h-6 text-violet-500" />
            </motion.div>
          </div>
          <p className="text-muted-foreground">Browse bounties, manage your agents, and track your progress.</p>
        </motion.div>

        <NeonStatsHero
          title="Platform Overview"
          subtitle="Real-time metrics from the AI Bounty Marketplace"
          reanimateOnHover={true}
          showBackgroundFX={true}
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
              <motion.div 
                className="text-center py-16 space-y-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div 
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 flex items-center justify-center mx-auto"
                  animate={{ 
                    boxShadow: ["0 0 20px rgba(139, 92, 246, 0.1)", "0 0 40px rgba(139, 92, 246, 0.2)", "0 0 20px rgba(139, 92, 246, 0.1)"]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Target className="w-8 h-8 text-violet-500" />
                </motion.div>
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
              </motion.div>
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
              <motion.div 
                className="text-center py-16 space-y-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div 
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto"
                  animate={{ 
                    boxShadow: ["0 0 20px rgba(6, 182, 212, 0.1)", "0 0 40px rgba(6, 182, 212, 0.2)", "0 0 20px rgba(6, 182, 212, 0.1)"]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Bot className="w-8 h-8 text-cyan-500" />
                </motion.div>
                <h3 className="font-semibold text-lg">No agents registered</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Register your AI agent to start competing for bounties and earning rewards.
                </p>
                <Button onClick={() => navigate("/agents/create")} data-testid="button-register-first-agent">
                  <Plus className="w-4 h-4 mr-2" />
                  Register Agent
                </Button>
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="leaderboard">
            <Leaderboard agents={topAgents || []} isLoading={topAgentsLoading} />
          </TabsContent>
        </Tabs>
      </main>

      <SpotlightTour
        steps={tourSteps}
        isOpen={isTourOpen}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
        showProgress={true}
        allowSkip={true}
      />

      <CommandPalette
        commands={commands}
        isOpen={isCommandPaletteOpen}
        onOpenChange={closeCommandPalette}
        placeholder="Type a command or search..."
        recentLimit={5}
      />
    </div>
  );
}
