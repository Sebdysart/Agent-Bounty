import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { GlowButton } from "@/components/ui/glow-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Target, Plus, Trophy, CreditCard, BarChart3, Wand2, Users, 
  LogOut, User, Settings, Bot, Upload, Store, Plug, Shield,
  Network, DollarSign, TrendingUp, Lock, Coins, Globe
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

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

          <div className="flex items-center gap-2">
            <Link href="/browse-bounties">
              <Button variant="ghost" size="icon" data-testid="button-browse-bounties">
                <Target className="w-5 h-5" />
              </Button>
            </Link>
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
            <Link href="/agent-marketplace">
              <Button variant="ghost" size="icon" data-testid="button-agent-marketplace">
                <Store className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/task-builder">
              <Button variant="outline" className="gap-2 hidden md:flex" data-testid="button-task-builder">
                <Wand2 className="w-4 h-4" />
                AI Builder
              </Button>
            </Link>
            <Link href="/agent-upload">
              <Button variant="outline" className="gap-2 hidden lg:flex" data-testid="button-agent-upload">
                <Upload className="w-4 h-4" />
                Upload Agent
              </Button>
            </Link>
            <GlowButton 
              onClick={() => navigate("/bounties/create")} 
              data-testid="button-post-bounty"
              glowIntensity="strong"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Post Bounty</span>
              <span className="sm:hidden">Post</span>
            </GlowButton>
            <NotificationBell />
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
                <DropdownMenuItem onClick={() => navigate("/browse-bounties")} className="cursor-pointer">
                  <Target className="w-4 h-4 mr-2" />
                  Browse Bounties
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/agent-upload")} className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Agent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/agent-marketplace")} className="cursor-pointer">
                  <Store className="w-4 h-4 mr-2" />
                  Agent Marketplace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/task-builder")} className="cursor-pointer">
                  <Wand2 className="w-4 h-4 mr-2" />
                  AI Task Builder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/pricing")} className="cursor-pointer">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Subscription
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/analytics")} className="cursor-pointer">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/integrations")} className="cursor-pointer">
                  <Plug className="w-4 h-4 mr-2" />
                  Integration Hub
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/security")} className="cursor-pointer">
                  <Shield className="w-4 h-4 mr-2" />
                  Security Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Enterprise</div>
                <DropdownMenuItem onClick={() => navigate("/integrations-hub")} className="cursor-pointer">
                  <Plug className="w-4 h-4 mr-2" />
                  Integrations Hub
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/finops")} className="cursor-pointer">
                  <DollarSign className="w-4 h-4 mr-2" />
                  FinOps Console
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/predictive-analytics")} className="cursor-pointer">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Predictive Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/quantum-security")} className="cursor-pointer">
                  <Lock className="w-4 h-4 mr-2" />
                  Quantum Security
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
