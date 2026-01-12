import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Search, Plug, Link2, Cloud, Database, MessageSquare, 
  BarChart3, FolderOpen, Cpu, DollarSign, Briefcase,
  Check, ExternalLink, Star, Key, Loader2, AlertCircle, Settings
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const categoryIcons: Record<string, any> = {
  crm: Briefcase,
  marketing: BarChart3,
  data: Database,
  devops: Cloud,
  ai_ml: Cpu,
  finance: DollarSign,
  communication: MessageSquare,
  productivity: FolderOpen,
  analytics: BarChart3,
  storage: FolderOpen,
};

const categoryLabels: Record<string, string> = {
  crm: "CRM",
  marketing: "Marketing",
  data: "Data & DB",
  devops: "DevOps",
  ai_ml: "AI / ML",
  finance: "Finance",
  communication: "Communication",
  productivity: "Productivity",
  analytics: "Analytics",
  storage: "Storage",
};

const authTypeLabels: Record<string, string> = {
  oauth2: "OAuth 2.0",
  api_key: "API Key",
  bearer: "Bearer Token",
  basic: "Username & Password",
};

interface Connector {
  id: number;
  name: string;
  slug: string;
  description: string;
  category: string;
  authType: string;
  webhookSupport: boolean;
  isPremium: boolean;
  baseUrl: string;
}

export default function IntegrationsHub() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const { data: connectors = [], isLoading } = useQuery<Connector[]>({
    queryKey: ["/api/integrations/connectors", searchQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      const res = await fetch(`/api/integrations/connectors?${params}`);
      return res.json();
    },
  });

  const { data: categoryStats = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/integrations/categories/stats"],
  });

  const { data: userIntegrations = [] } = useQuery<any[]>({
    queryKey: ["/api/integrations/user"],
  });

  const { data: popularConnectors = [] } = useQuery<Connector[]>({
    queryKey: ["/api/integrations/connectors/popular"],
  });

  const connectMutation = useMutation({
    mutationFn: async (data: { connectorId: number; credentials: Record<string, string> }) => {
      return apiRequest("POST", "/api/integrations/connect", {
        connectorId: data.connectorId,
        credentials: data.credentials,
        config: {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/user"] });
      toast({
        title: "Integration connected!",
        description: `Successfully connected to ${selectedConnector?.name}`,
      });
      setConnectDialogOpen(false);
      setSelectedConnector(null);
      setCredentials({});
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect integration",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      return apiRequest("DELETE", `/api/integrations/${integrationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/user"] });
      toast({
        title: "Disconnected",
        description: "Integration has been disconnected",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect integration",
        variant: "destructive",
      });
    },
  });

  const connectedIds = new Set(userIntegrations.map((i: any) => i.connectorId));
  const getUserIntegration = (connectorId: number) => 
    userIntegrations.find((i: any) => i.connectorId === connectorId);

  const handleConnectClick = (connector: Connector) => {
    setSelectedConnector(connector);
    setCredentials({});
    setConnectDialogOpen(true);
  };

  const handleConnect = () => {
    if (!selectedConnector) return;
    connectMutation.mutate({
      connectorId: selectedConnector.id,
      credentials,
    });
  };

  const handleDisconnect = (integrationId: number) => {
    if (confirm("Are you sure you want to disconnect this integration?")) {
      disconnectMutation.mutate(integrationId);
    }
  };

  const getCredentialFields = (authType: string) => {
    switch (authType) {
      case "api_key":
        return [{ key: "apiKey", label: "API Key", type: "password" }];
      case "bearer":
        return [{ key: "token", label: "Access Token", type: "password" }];
      case "basic":
        return [
          { key: "username", label: "Username", type: "text" },
          { key: "password", label: "Password", type: "password" },
        ];
      case "oauth2":
        return [
          { key: "clientId", label: "Client ID", type: "text" },
          { key: "clientSecret", label: "Client Secret", type: "password" },
        ];
      default:
        return [{ key: "apiKey", label: "API Key", type: "password" }];
    }
  };

  const categories = [
    "all",
    "crm",
    "marketing",
    "data",
    "devops",
    "ai_ml",
    "finance",
    "communication",
    "productivity",
    "analytics",
    "storage",
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
          Integrations Hub
        </h1>
        <p className="text-muted-foreground mt-2">
          Connect your favorite tools and services to supercharge your AI agents
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Connectors</p>
                <p className="text-2xl font-bold">{Object.values(categoryStats).reduce((a: number, b: number) => a + b, 0) || 50}+</p>
              </div>
              <Plug className="h-8 w-8 text-violet-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{Object.keys(categoryStats).length || 10}</p>
              </div>
              <FolderOpen className="h-8 w-8 text-fuchsia-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Connected</p>
                <p className="text-2xl font-bold">{userIntegrations.length}</p>
              </div>
              <Link2 className="h-8 w-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{userIntegrations.filter((i: any) => i.isActive).length}</p>
              </div>
              <Check className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search connectors..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-connectors"
          />
        </div>
      </div>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="browse" data-testid="tab-browse">Browse</TabsTrigger>
          <TabsTrigger value="popular" data-testid="tab-popular">Popular</TabsTrigger>
          <TabsTrigger value="connected" data-testid="tab-connected">My Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => {
              const Icon = cat === "all" ? Plug : categoryIcons[cat];
              return (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className={selectedCategory === cat ? "bg-gradient-to-r from-violet-600 to-fuchsia-600" : ""}
                  data-testid={`button-category-${cat}`}
                >
                  {Icon && <Icon className="h-4 w-4 mr-1" />}
                  {cat === "all" ? "All" : categoryLabels[cat] || cat}
                  {cat !== "all" && categoryStats[cat] && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {categoryStats[cat]}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-3/4 mt-2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectors.map((connector) => {
                const Icon = categoryIcons[connector.category] || Plug;
                const isConnected = connectedIds.has(connector.id);
                const userIntegration = getUserIntegration(connector.id);
                return (
                  <Card
                    key={connector.id}
                    className={`hover-elevate transition-all ${
                      isConnected ? "border-green-500/50" : "border-border"
                    }`}
                    data-testid={`card-connector-${connector.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10">
                            <Icon className="h-5 w-5 text-violet-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {connector.name}
                              {connector.isPremium && (
                                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                              )}
                            </CardTitle>
                            <Badge variant="outline" className="text-xs mt-1">
                              {categoryLabels[connector.category] || connector.category}
                            </Badge>
                          </div>
                        </div>
                        {isConnected && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <Check className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm mb-4">
                        {connector.description}
                      </CardDescription>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {connector.authType}
                          </Badge>
                          {connector.webhookSupport && (
                            <Badge variant="secondary" className="text-xs">
                              Webhooks
                            </Badge>
                          )}
                        </div>
                        {isConnected ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConnectClick(connector)}
                              data-testid={`button-configure-${connector.id}`}
                            >
                              <Settings className="h-3 w-3 mr-1" />
                              Configure
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => userIntegration && handleDisconnect(userIntegration.id)}
                              disabled={disconnectMutation.isPending}
                              data-testid={`button-disconnect-${connector.id}`}
                            >
                              Disconnect
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-violet-600 to-fuchsia-600"
                            onClick={() => handleConnectClick(connector)}
                            data-testid={`button-connect-${connector.id}`}
                          >
                            Connect
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="popular">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularConnectors.map((connector, index) => {
              const Icon = categoryIcons[connector.category] || Plug;
              const isConnected = connectedIds.has(connector.id);
              return (
                <Card key={connector.id} className="hover-elevate" data-testid={`card-popular-${connector.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10">
                        <Icon className="h-5 w-5 text-violet-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{connector.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {(connector as any).usageCount?.toLocaleString() || 0} users
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm mb-4">
                      {connector.description}
                    </CardDescription>
                    <Button
                      size="sm"
                      className={isConnected ? "" : "bg-gradient-to-r from-violet-600 to-fuchsia-600"}
                      variant={isConnected ? "outline" : "default"}
                      onClick={() => handleConnectClick(connector)}
                      data-testid={`button-connect-popular-${connector.id}`}
                    >
                      {isConnected ? "Configure" : "Connect"}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="connected">
          {userIntegrations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No integrations connected</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Browse the available connectors to connect your first integration
                </p>
                <Button onClick={() => setSelectedCategory("all")} data-testid="button-browse-integrations">
                  Browse Integrations
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userIntegrations.map((integration: any) => {
                const Icon = categoryIcons[integration.connector?.category] || Plug;
                return (
                  <Card key={integration.id} className="hover-elevate" data-testid={`card-integration-${integration.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10">
                            <Icon className="h-5 w-5 text-violet-400" />
                          </div>
                          <CardTitle className="text-base">
                            {integration.connector?.name || "Unknown"}
                          </CardTitle>
                        </div>
                        <Badge
                          className={
                            integration.isActive
                              ? "bg-green-500/20 text-green-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }
                        >
                          {integration.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Last used: {integration.lastUsedAt 
                          ? new Date(integration.lastUsedAt).toLocaleDateString() 
                          : "Never"}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => integration.connector && handleConnectClick(integration.connector)}
                          data-testid={`button-configure-integration-${integration.id}`}
                        >
                          Configure
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => handleDisconnect(integration.id)}
                          disabled={disconnectMutation.isPending}
                          data-testid={`button-disconnect-integration-${integration.id}`}
                        >
                          {disconnectMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Disconnect"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Connect Integration Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10">
                <Key className="h-5 w-5 text-violet-400" />
              </div>
              Connect to {selectedConnector?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your credentials to connect this integration. Your credentials are encrypted and stored securely.
            </DialogDescription>
          </DialogHeader>

          {selectedConnector && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Authentication type: <span className="font-medium text-foreground">{authTypeLabels[selectedConnector.authType] || selectedConnector.authType}</span>
                </p>
              </div>

              {getCredentialFields(selectedConnector.authType).map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type={field.type}
                    placeholder={`Enter your ${field.label.toLowerCase()}`}
                    value={credentials[field.key] || ""}
                    onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                    data-testid={`input-credential-${field.key}`}
                  />
                </div>
              ))}

              {selectedConnector.authType === "oauth2" && (
                <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <p className="text-sm text-violet-300">
                    For OAuth2 integrations, you'll need to configure your app in the {selectedConnector.name} developer console and obtain client credentials.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConnectDialogOpen(false)}
              data-testid="button-cancel-connect"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={connectMutation.isPending || Object.keys(credentials).length === 0}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600"
              data-testid="button-confirm-connect"
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
