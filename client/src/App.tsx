import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { NotificationProvider } from "@/components/ui/notification-provider";
import { ToastStack } from "@/components/ui/toast-stack";
import { useAuth } from "@/hooks/use-auth";
import { WebSocketProvider } from "@/hooks/use-websocket.tsx";
import NotFound from "@/pages/not-found";
import { LandingPage } from "@/pages/landing";
import { Dashboard } from "@/pages/dashboard";
import { CreateBountyPage } from "@/pages/create-bounty";
import { CreateAgentPage } from "@/pages/create-agent";
import { BountyDetailPage } from "@/pages/bounty-detail";
import { PricingPage } from "@/pages/pricing";
import { LeaderboardPage } from "@/pages/leaderboard";
import { AnalyticsPage } from "@/pages/analytics";
import { TaskBuilderPage } from "@/pages/task-builder";
import { CommunityPage } from "@/pages/community";
import { MarketplacePage } from "@/pages/marketplace";
import { AgentUploadPage } from "@/pages/agent-upload";
import { AgentMarketplacePage } from "@/pages/agent-marketplace";
import { AgentDetailPage } from "@/pages/agent-detail";
import IntegrationHub from "@/pages/integration-hub";
import SecuritySettingsPage from "@/pages/security-settings";
import ProfilePage from "@/pages/profile";
import MyAgentsPage from "@/pages/my-agents";
import SettingsPage from "@/pages/settings";
import UIDemoPage from "@/pages/ui-demo";
import CompareAgentsPage from "@/pages/compare-agents";
import SignInDemoPage from "@/pages/sign-in-demo";

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/ui-demo" component={UIDemoPage} />
      <Route path="/bounties/create" component={CreateBountyPage} />
      <Route path="/bounties/:id" component={BountyDetailPage} />
      <Route path="/agents/create" component={CreateAgentPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/task-builder" component={TaskBuilderPage} />
      <Route path="/community" component={CommunityPage} />
      <Route path="/marketplace" component={MarketplacePage} />
      <Route path="/agent-upload" component={AgentUploadPage} />
      <Route path="/agent-marketplace" component={AgentMarketplacePage} />
      <Route path="/agent-marketplace/:id" component={AgentDetailPage} />
      <Route path="/integrations" component={IntegrationHub} />
      <Route path="/security" component={SecuritySettingsPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/my-agents" component={MyAgentsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/compare-agents" component={CompareAgentsPage} />
      <Route path="/sign-in-demo" component={SignInDemoPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UnauthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/ui-demo" component={UIDemoPage} />
      <Route path="/sign-in-demo" component={SignInDemoPage} />
      <Route component={LandingPage} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedRouter /> : <UnauthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="bounty-ui-theme">
        <WebSocketProvider>
          <NotificationProvider historyLimit={50} soundEnabled={true}>
            <TooltipProvider>
              <Toaster />
              <ToastStack position="top-right" maxVisible={5} />
              <AppContent />
            </TooltipProvider>
          </NotificationProvider>
        </WebSocketProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
