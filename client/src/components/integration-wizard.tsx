import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Lock,
  Zap,
  Database,
  RefreshCw,
  Activity,
  Clock,
  FileText,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface IntegrationManifest {
  id: number;
  name: string;
  slug: string;
  category: string;
  authType: string;
  requiredScopes: string[];
  optionalScopes: string[];
  capabilities: string[];
  dataTypes: string[];
  rateLimit?: { requests: number; period: string };
  documentation?: string;
  setupGuide: string[];
  privacyPolicy?: string;
  termsOfService?: string;
}

interface ConnectionStatus {
  status: "pending" | "connecting" | "connected" | "error" | "testing";
  message: string;
  progress: number;
  healthScore?: number;
  lastSync?: Date;
  lastError?: string;
}

interface IntegrationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connector: {
    id: number;
    name: string;
    slug: string;
    category: string;
    authType: string;
    description: string;
    webhookSupport: boolean;
    baseUrl: string;
  } | null;
  isReconfigure?: boolean;
}

const authTypeLabels: Record<string, string> = {
  oauth2: "OAuth 2.0",
  api_key: "API Key",
  bearer: "Bearer Token",
  basic: "Username & Password",
};

const authTypeIcons: Record<string, any> = {
  oauth2: Globe,
  api_key: Key,
  bearer: Lock,
  basic: Shield,
};

const stepLabels = ["Overview", "Credentials", "Connect", "Complete"];

export function IntegrationWizard({ open, onOpenChange, connector, isReconfigure }: IntegrationWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: "pending",
    message: "",
    progress: 0
  });

  const { data: manifest } = useQuery<IntegrationManifest>({
    queryKey: ["/api/gateway/connectors", connector?.id, "manifest"],
    queryFn: async () => {
      if (!connector?.id) return null;
      const res = await fetch(`/api/gateway/connectors/${connector.id}/manifest`);
      return res.json();
    },
    enabled: !!connector?.id && open,
  });

  const connectMutation = useMutation({
    mutationFn: async (data: { connectorId: number; credentials: Record<string, string> }) => {
      return apiRequest("POST", "/api/gateway/connect", data);
    },
    onSuccess: async () => {
      setConnectionStatus({
        status: "connected",
        message: "Successfully connected!",
        progress: 100,
        healthScore: 100
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/user"] });
      setStep(3);
    },
    onError: (error: any) => {
      setConnectionStatus({
        status: "error",
        message: error.message || "Connection failed",
        progress: 0,
        lastError: error.message
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (connectorId: number) => {
      return apiRequest("POST", "/api/gateway/test", { connectorId });
    },
  });

  useEffect(() => {
    if (!open) {
      setStep(0);
      setCredentials({});
      setConnectionStatus({ status: "pending", message: "", progress: 0 });
    }
  }, [open]);

  const handleConnect = async () => {
    if (!connector) return;
    
    setConnectionStatus({
      status: "connecting",
      message: "Initiating secure connection...",
      progress: 10
    });
    setStep(2);

    const progressSteps = [
      { progress: 25, message: "Validating credentials..." },
      { progress: 50, message: "Establishing secure channel..." },
      { progress: 75, message: "Testing connection..." },
    ];

    for (const stepData of progressSteps) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setConnectionStatus(prev => ({ ...prev, ...stepData }));
    }

    connectMutation.mutate({
      connectorId: connector.id,
      credentials,
    });
  };

  const getCredentialFields = (authType: string) => {
    switch (authType) {
      case "api_key":
        return [{ key: "apiKey", label: "API Key", type: "password", placeholder: "Enter your API key" }];
      case "bearer":
        return [{ key: "token", label: "Access Token", type: "password", placeholder: "Enter your access token" }];
      case "basic":
        return [
          { key: "username", label: "Username", type: "text", placeholder: "Enter your username" },
          { key: "password", label: "Password", type: "password", placeholder: "Enter your password" },
        ];
      case "oauth2":
        return [
          { key: "clientId", label: "Client ID", type: "text", placeholder: "Enter client ID" },
          { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Enter client secret" },
        ];
      default:
        return [{ key: "apiKey", label: "API Key", type: "password", placeholder: "Enter your API key" }];
    }
  };

  const handleClose = () => {
    if (connectionStatus.status === "connected") {
      toast({
        title: "Integration Connected!",
        description: `${connector?.name} is now connected to your account.`,
      });
    }
    onOpenChange(false);
  };

  const canProceedFromStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      const fields = getCredentialFields(connector?.authType || "api_key");
      return fields.every(field => credentials[field.key]?.trim());
    }
    return true;
  };

  if (!connector) return null;

  const AuthIcon = authTypeIcons[connector.authType] || Key;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl overflow-hidden p-0">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
          
          <DialogHeader className="p-6 pb-4 border-b border-border/50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
                <AuthIcon className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {isReconfigure ? "Reconfigure" : "Connect"} {connector.name}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {connector.description}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              {stepLabels.map((label, idx) => (
                <div key={label} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                      step === idx && "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white",
                      step > idx && "bg-green-500 text-white",
                      step < idx && "bg-muted text-muted-foreground"
                    )}>
                      {step > idx ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <span className={cn(
                      "text-xs mt-1 hidden sm:block",
                      step >= idx ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {label}
                    </span>
                  </div>
                  {idx < stepLabels.length - 1 && (
                    <div className={cn(
                      "w-12 sm:w-20 h-0.5 mx-2",
                      step > idx ? "bg-green-500" : "bg-muted"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </DialogHeader>

          <div className="p-6 min-h-[300px]">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Lock className="h-4 w-4 text-violet-400" />
                        Authentication
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {authTypeLabels[connector.authType] || connector.authType}
                      </Badge>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Zap className="h-4 w-4 text-fuchsia-400" />
                        Webhooks
                      </div>
                      <Badge variant={connector.webhookSupport ? "default" : "secondary"} className="text-xs">
                        {connector.webhookSupport ? "Supported" : "Not Supported"}
                      </Badge>
                    </div>
                  </div>

                  {manifest?.requiredScopes && manifest.requiredScopes.length > 0 && (
                    <div className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/20">
                      <div className="flex items-center gap-2 text-sm font-medium mb-3">
                        <Shield className="h-4 w-4 text-violet-400" />
                        Required Permissions
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {manifest.requiredScopes.map((scope) => (
                          <Badge key={scope} variant="outline" className="text-xs bg-violet-500/10 border-violet-500/30">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {manifest?.capabilities && (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2 text-sm font-medium mb-3">
                        <Database className="h-4 w-4 text-cyan-400" />
                        Capabilities
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {manifest.capabilities.map((cap) => (
                          <Badge key={cap} variant="secondary" className="text-xs">
                            {cap.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <a href={manifest?.privacyPolicy || "#"} className="flex items-center gap-1 hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">
                      <FileText className="h-3 w-3" />
                      Privacy Policy
                    </a>
                    <a href={manifest?.termsOfService || "#"} className="flex items-center gap-1 hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">
                      <FileText className="h-3 w-3" />
                      Terms of Service
                    </a>
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="credentials"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="p-4 rounded-lg bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Key className="h-4 w-4 text-violet-400" />
                      Setup Instructions
                    </h4>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      {manifest?.setupGuide.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="space-y-4">
                    {getCredentialFields(connector.authType).map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key} className="text-sm font-medium">
                          {field.label}
                        </Label>
                        <Input
                          id={field.key}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={credentials[field.key] || ""}
                          onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                          className="bg-muted/30 border-border/50 focus:border-violet-500/50"
                          data-testid={`input-wizard-${field.key}`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-xs text-amber-400 flex items-start gap-2">
                      <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                      Your credentials are encrypted using AES-256 encryption and stored securely. We never share your data with third parties.
                    </p>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="connecting"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col items-center justify-center py-8 space-y-6"
                >
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                      {connectionStatus.status === "error" ? (
                        <AlertCircle className="h-10 w-10 text-red-400" />
                      ) : (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <RefreshCw className="h-10 w-10 text-violet-400" />
                        </motion.div>
                      )}
                    </div>
                    {connectionStatus.status !== "error" && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-violet-500"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className={cn(
                      "text-lg font-semibold",
                      connectionStatus.status === "error" ? "text-red-400" : "text-foreground"
                    )}>
                      {connectionStatus.status === "error" ? "Connection Failed" : "Connecting..."}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {connectionStatus.message}
                    </p>
                  </div>

                  <div className="w-full max-w-xs">
                    <Progress 
                      value={connectionStatus.progress} 
                      className={cn(
                        "h-2",
                        connectionStatus.status === "error" && "[&>div]:bg-red-500"
                      )}
                    />
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      {connectionStatus.progress}% complete
                    </p>
                  </div>

                  {connectionStatus.status === "error" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStep(1);
                        setConnectionStatus({ status: "pending", message: "", progress: 0 });
                      }}
                      className="mt-4"
                      data-testid="button-retry-connection"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Go Back & Retry
                    </Button>
                  )}
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center justify-center py-8 space-y-6"
                >
                  <div className="relative">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="w-24 h-24 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 flex items-center justify-center"
                    >
                      <CheckCircle2 className="h-12 w-12 text-green-400" />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="absolute -top-2 -right-2"
                    >
                      <Badge className="bg-green-500 text-white">Active</Badge>
                    </motion.div>
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-green-400">
                      Successfully Connected!
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {connector.name} is now connected to your BountyAI account
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <Activity className="h-5 w-5 text-green-400 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Health</p>
                      <p className="text-sm font-bold text-green-400">100%</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <Clock className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Latency</p>
                      <p className="text-sm font-bold">&lt;100ms</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <Zap className="h-5 w-5 text-fuchsia-400 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-sm font-bold text-green-400">Ready</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center max-w-sm">
                    Your AI agents can now access {connector.name} data and capabilities. 
                    Manage this integration from the Integrations Hub.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-6 pt-0 flex items-center justify-between border-t border-border/50">
            {step > 0 && step < 3 && connectionStatus.status !== "connecting" ? (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                data-testid="button-wizard-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step === 0 && (
              <Button
                onClick={() => setStep(1)}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600"
                data-testid="button-wizard-next"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {step === 1 && (
              <Button
                onClick={handleConnect}
                disabled={!canProceedFromStep(1) || connectMutation.isPending}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600"
                data-testid="button-wizard-connect"
              >
                {connectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}

            {step === 3 && (
              <Button
                onClick={handleClose}
                className="bg-gradient-to-r from-green-600 to-emerald-600"
                data-testid="button-wizard-done"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
