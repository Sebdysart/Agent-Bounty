import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Cpu, Zap, Settings, Save, RefreshCw, CheckCircle,
  Server, Brain, Sparkles, ArrowRightLeft
} from "lucide-react";

interface LlmConfig {
  id: number;
  agentUploadId: number;
  primaryProvider: string;
  fallbackProvider: string | null;
  primaryModel: string;
  fallbackModel: string | null;
  maxTokens: number;
  temperature: string;
  customEndpoint: string | null;
}

interface ProvidersData {
  providers: string[];
  models: Record<string, string[]>;
}

interface AgentUpload {
  id: number;
  name: string;
}

const PROVIDER_ICONS: Record<string, typeof Cpu> = {
  openai: Brain,
  anthropic: Sparkles,
  groq: Zap,
  custom: Server,
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  groq: "Groq",
  custom: "Custom",
};

export default function LlmConfigPage() {
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [formData, setFormData] = useState({
    primaryProvider: "openai",
    fallbackProvider: "",
    primaryModel: "gpt-4o-mini",
    fallbackModel: "",
    maxTokens: 4096,
    temperature: 0.7,
    customEndpoint: "",
  });

  const { data: agents = [] } = useQuery<AgentUpload[]>({
    queryKey: ["/api/agent-uploads"],
  });

  const { data: providersData } = useQuery<ProvidersData>({
    queryKey: ["/api/llm/providers"],
  });

  const { data: currentConfig, refetch: refetchConfig } = useQuery<LlmConfig | null>({
    queryKey: ["/api/llm/config", selectedAgent],
    enabled: !!selectedAgent,
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/llm/config/${selectedAgent}`, {
        primaryProvider: formData.primaryProvider,
        fallbackProvider: formData.fallbackProvider || null,
        primaryModel: formData.primaryModel,
        fallbackModel: formData.fallbackModel || null,
        maxTokens: formData.maxTokens,
        temperature: formData.temperature,
        customEndpoint: formData.customEndpoint || null,
      });
      return res.json();
    },
    onSuccess: () => {
      refetchConfig();
      toast({ title: "Configuration saved" });
    },
  });

  const providers = providersData?.providers || [];
  const models = providersData?.models || {};

  const handleAgentChange = (agentId: string) => {
    setSelectedAgent(agentId);
    if (currentConfig) {
      setFormData({
        primaryProvider: currentConfig.primaryProvider,
        fallbackProvider: currentConfig.fallbackProvider || "",
        primaryModel: currentConfig.primaryModel,
        fallbackModel: currentConfig.fallbackModel || "",
        maxTokens: currentConfig.maxTokens,
        temperature: parseFloat(currentConfig.temperature),
        customEndpoint: currentConfig.customEndpoint || "",
      });
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30">
          <Cpu className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Multi-LLM Configuration</h1>
          <p className="text-muted-foreground">Configure AI providers for your agents</p>
        </div>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Select Agent</CardTitle>
          <CardDescription>Choose an agent to configure its LLM settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedAgent} onValueChange={handleAgentChange}>
            <SelectTrigger data-testid="select-agent">
              <SelectValue placeholder="Choose an agent..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id.toString()}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedAgent && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-violet-400" />
                  Primary Provider
                </CardTitle>
                <CardDescription>Main AI provider for this agent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Provider</Label>
                  <Select 
                    value={formData.primaryProvider} 
                    onValueChange={(v) => {
                      setFormData(prev => ({ 
                        ...prev, 
                        primaryProvider: v,
                        primaryModel: models[v]?.[0] || ""
                      }));
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-primary-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => {
                        const Icon = PROVIDER_ICONS[provider] || Server;
                        return (
                          <SelectItem key={provider} value={provider}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {PROVIDER_LABELS[provider] || provider}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Model</Label>
                  <Select 
                    value={formData.primaryModel} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, primaryModel: v }))}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-primary-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(models[formData.primaryProvider] || []).map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                  Fallback Provider
                </CardTitle>
                <CardDescription>Backup if primary fails</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Provider</Label>
                  <Select 
                    value={formData.fallbackProvider} 
                    onValueChange={(v) => {
                      setFormData(prev => ({ 
                        ...prev, 
                        fallbackProvider: v,
                        fallbackModel: models[v]?.[0] || ""
                      }));
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-fallback-provider">
                      <SelectValue placeholder="No fallback" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No fallback</SelectItem>
                      {providers.filter(p => p !== formData.primaryProvider).map((provider) => {
                        const Icon = PROVIDER_ICONS[provider] || Server;
                        return (
                          <SelectItem key={provider} value={provider}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {PROVIDER_LABELS[provider] || provider}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {formData.fallbackProvider && (
                  <div>
                    <Label>Model</Label>
                    <Select 
                      value={formData.fallbackModel} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, fallbackModel: v }))}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-fallback-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(models[formData.fallbackProvider] || []).map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-fuchsia-400" />
                Model Parameters
              </CardTitle>
              <CardDescription>Fine-tune model behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={formData.maxTokens}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 4096 }))}
                    className="mt-1"
                    data-testid="input-max-tokens"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Maximum response length</p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label>Temperature</Label>
                    <Badge variant="outline">{formData.temperature.toFixed(1)}</Badge>
                  </div>
                  <Slider
                    value={[formData.temperature]}
                    onValueChange={([v]) => setFormData(prev => ({ ...prev, temperature: v }))}
                    min={0}
                    max={2}
                    step={0.1}
                    className="mt-3"
                    data-testid="slider-temperature"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Higher = more creative, Lower = more focused</p>
                </div>
              </div>

              {formData.primaryProvider === "custom" && (
                <div>
                  <Label>Custom Endpoint</Label>
                  <Input
                    value={formData.customEndpoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, customEndpoint: e.target.value }))}
                    placeholder="https://your-api.example.com/v1/chat/completions"
                    className="mt-1 font-mono text-sm"
                    data-testid="input-custom-endpoint"
                  />
                </div>
              )}

              <Button
                onClick={() => saveConfigMutation.mutate()}
                disabled={saveConfigMutation.isPending}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                data-testid="button-save-config"
              >
                {saveConfigMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Save Configuration</>
                )}
              </Button>
            </CardContent>
          </Card>

          {currentConfig && (
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="font-medium text-green-400">Configuration Active</p>
                    <p className="text-sm text-muted-foreground">
                      Using {PROVIDER_LABELS[currentConfig.primaryProvider]} ({currentConfig.primaryModel})
                      {currentConfig.fallbackProvider && (
                        <> with {PROVIDER_LABELS[currentConfig.fallbackProvider]} fallback</>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
