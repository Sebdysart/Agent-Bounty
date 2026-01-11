import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Wand2, Code2, GitBranch, ArrowRight, ArrowLeft, Check, 
  Play, Loader2, Upload, Settings, FileJson, Terminal,
  Globe, Link, BarChart, FileText, Mail, Brain, Database, Image,
  Plus, X, Sparkles, CheckCircle2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { AgentUpload, AgentTool, AgentTest } from "@shared/schema";

const toolIcons: Record<string, any> = {
  Globe, Link, BarChart, FileText, Mail, Brain, Database, Image
};

type UploadType = "no_code" | "low_code" | "full_code";

interface GeneratedAgent {
  name: string;
  description: string;
  capabilities: string[];
  configJson: string;
  targetCategories: string[];
  suggestedTools?: string[];
  runtime: string;
}

export function AgentUploadPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [uploadType, setUploadType] = useState<UploadType | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generatedAgent, setGeneratedAgent] = useState<GeneratedAgent | null>(null);
  const [selectedTools, setSelectedTools] = useState<number[]>([]);
  const [createdUpload, setCreatedUpload] = useState<AgentUpload | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    capabilities: [] as string[],
    configJson: "",
    manifestJson: "",
    repoUrl: "",
    entryPoint: "index.js",
    runtime: "nodejs",
    targetCategories: [] as string[],
    isPublic: true,
    price: "0",
  });

  const [newCapability, setNewCapability] = useState("");

  const { data: tools, isLoading: toolsLoading } = useQuery<AgentTool[]>({
    queryKey: ["/api/agent-tools"],
  });

  const { data: myUploads } = useQuery<AgentUpload[]>({
    queryKey: ["/api/agent-uploads"],
  });

  const generateAgent = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest("POST", "/api/ai/generate-agent", { prompt });
      return response.json();
    },
    onSuccess: (data: GeneratedAgent) => {
      setGeneratedAgent(data);
      setFormData(prev => ({
        ...prev,
        name: data.name,
        description: data.description,
        capabilities: data.capabilities,
        configJson: data.configJson,
        targetCategories: data.targetCategories,
        runtime: data.runtime,
      }));
      toast({
        title: "Agent generated!",
        description: "Review and customize the configuration",
      });
    },
    onError: () => {
      toast({
        title: "Generation failed",
        description: "Could not generate agent configuration",
        variant: "destructive",
      });
    },
  });

  const createUpload = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/agent-uploads", {
        ...formData,
        uploadType,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCreatedUpload(data);
      queryClient.invalidateQueries({ queryKey: ["/api/agent-uploads"] });
      setStep(4);
      toast({
        title: "Agent created!",
        description: "Now let's test it in the sandbox",
      });
    },
    onError: () => {
      toast({
        title: "Creation failed",
        description: "Could not create agent upload",
        variant: "destructive",
      });
    },
  });

  const runTest = useMutation({
    mutationFn: async () => {
      if (!createdUpload) return;
      const response = await apiRequest("POST", `/api/agent-uploads/${createdUpload.id}/test`, {
        testName: "Sandbox Test",
        testType: "functional",
        input: "Sample test input",
      });
      return response.json();
    },
    onSuccess: () => {
      if (createdUpload) {
        queryClient.invalidateQueries({ queryKey: ["/api/agent-uploads", createdUpload.id, "tests"] });
      }
      toast({
        title: "Test started!",
        description: "The sandbox test is running. You'll be notified when it completes.",
      });
    },
  });

  const publishAgent = useMutation({
    mutationFn: async () => {
      if (!createdUpload) return;
      const response = await apiRequest("POST", `/api/agent-uploads/${createdUpload.id}/publish`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Agent published!",
        description: "Your agent is now live on the marketplace",
      });
      navigate("/agent-marketplace");
    },
  });

  const { data: tests } = useQuery<AgentTest[]>({
    queryKey: ["/api/agent-uploads", createdUpload?.id, "tests"],
    enabled: !!createdUpload,
    refetchInterval: createdUpload ? 2000 : false,
  });

  const addCapability = () => {
    if (newCapability.trim()) {
      setFormData(prev => ({
        ...prev,
        capabilities: [...prev.capabilities, newCapability.trim()],
      }));
      setNewCapability("");
    }
  };

  const removeCapability = (index: number) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.filter((_, i) => i !== index),
    }));
  };

  const toggleCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      targetCategories: prev.targetCategories.includes(category)
        ? prev.targetCategories.filter(c => c !== category)
        : [...prev.targetCategories, category],
    }));
  };

  const categories = ["marketing", "sales", "research", "data_analysis", "development", "other"];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8" data-testid="step-indicator">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              s < step ? "bg-primary text-primary-foreground" : 
              s === step ? "bg-primary text-primary-foreground" : 
              "bg-muted text-muted-foreground"
            }`}
          >
            {s < step ? <Check className="w-4 h-4" /> : s}
          </div>
          {s < 4 && <div className={`w-12 h-0.5 ${s < step ? "bg-primary" : "bg-muted"}`} />}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Choose Your Upload Method</h2>
        <p className="text-muted-foreground">Select how you want to create your AI agent</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card 
          className={`cursor-pointer transition-all hover-elevate ${uploadType === "no_code" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setUploadType("no_code")}
          data-testid="card-nocode-option"
        >
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4">
              <Wand2 className="w-8 h-8 text-white" />
            </div>
            <CardTitle>No-Code</CardTitle>
            <CardDescription>Describe your agent in plain language</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> Natural language input
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> AI generates config
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> Ready in minutes
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Badge variant="secondary" className="w-full justify-center">Best for beginners</Badge>
          </CardFooter>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover-elevate ${uploadType === "low_code" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setUploadType("low_code")}
          data-testid="card-lowcode-option"
        >
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4">
              <FileJson className="w-8 h-8 text-white" />
            </div>
            <CardTitle>Low-Code</CardTitle>
            <CardDescription>Import JSON manifest or use visual editor</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> JSON/YAML import
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> Visual configuration
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> Flexible customization
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Badge variant="secondary" className="w-full justify-center">Intermediate users</Badge>
          </CardFooter>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover-elevate ${uploadType === "full_code" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setUploadType("full_code")}
          data-testid="card-fullcode-option"
        >
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-4">
              <GitBranch className="w-8 h-8 text-white" />
            </div>
            <CardTitle>Full-Code</CardTitle>
            <CardDescription>Connect Git repository or upload code</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> Git integration
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> Custom frameworks
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> Full control
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Badge variant="secondary" className="w-full justify-center">Advanced developers</Badge>
          </CardFooter>
        </Card>
      </div>

      <div className="flex justify-end mt-8">
        <Button 
          onClick={() => setStep(2)} 
          disabled={!uploadType}
          data-testid="button-continue-step1"
        >
          Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setStep(1)} data-testid="button-back-step2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Configure Your Agent</h2>
          <p className="text-muted-foreground">
            {uploadType === "no_code" && "Describe what you want your agent to do"}
            {uploadType === "low_code" && "Import or create your agent configuration"}
            {uploadType === "full_code" && "Connect your repository or upload code"}
          </p>
        </div>
      </div>

      {uploadType === "no_code" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI Agent Generator
            </CardTitle>
            <CardDescription>Describe your agent and AI will generate the configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="prompt">Describe your agent</Label>
              <Textarea
                id="prompt"
                placeholder="I want an agent that can scrape websites for competitor pricing data, analyze trends, and generate weekly reports..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-32"
                data-testid="textarea-agent-prompt"
              />
            </div>
            <Button 
              onClick={() => generateAgent.mutate(prompt)}
              disabled={prompt.length < 10 || generateAgent.isPending}
              data-testid="button-generate-agent"
            >
              {generateAgent.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Agent
                </>
              )}
            </Button>

            {generatedAgent && (
              <div className="mt-6 p-4 bg-muted rounded-lg space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Agent Generated Successfully!</span>
                </div>
                <div className="grid gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input 
                      value={formData.name} 
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-agent-name"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea 
                      value={formData.description} 
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      data-testid="textarea-agent-description"
                    />
                  </div>
                  <div>
                    <Label>Capabilities</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.capabilities.map((cap, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          {cap}
                          <button onClick={() => removeCapability(i)} className="ml-1 hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {uploadType === "low_code" && (
        <Tabs defaultValue="form">
          <TabsList>
            <TabsTrigger value="form">Visual Editor</TabsTrigger>
            <TabsTrigger value="json">JSON Import</TabsTrigger>
          </TabsList>
          <TabsContent value="form">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Agent Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="My AI Agent"
                      data-testid="input-agent-name-lowcode"
                    />
                  </div>
                  <div>
                    <Label htmlFor="runtime">Runtime</Label>
                    <Select 
                      value={formData.runtime} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, runtime: v }))}
                    >
                      <SelectTrigger data-testid="select-runtime">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nodejs">Node.js</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what your agent does..."
                    data-testid="textarea-agent-description-lowcode"
                  />
                </div>
                <div>
                  <Label>Capabilities</Label>
                  <div className="flex gap-2 mt-2">
                    <Input 
                      value={newCapability}
                      onChange={(e) => setNewCapability(e.target.value)}
                      placeholder="Add a capability..."
                      onKeyDown={(e) => e.key === "Enter" && addCapability()}
                      data-testid="input-new-capability"
                    />
                    <Button variant="outline" onClick={addCapability} data-testid="button-add-capability">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.capabilities.map((cap, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {cap}
                        <button onClick={() => removeCapability(i)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Target Categories</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {categories.map((cat) => (
                      <Badge 
                        key={cat}
                        variant={formData.targetCategories.includes(cat) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleCategory(cat)}
                        data-testid={`badge-category-${cat}`}
                      >
                        {cat.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="json">
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="manifestJson">Manifest JSON</Label>
                <Textarea
                  id="manifestJson"
                  value={formData.manifestJson}
                  onChange={(e) => setFormData(prev => ({ ...prev, manifestJson: e.target.value }))}
                  placeholder='{"name": "My Agent", "version": "1.0.0", ...}'
                  className="font-mono min-h-64"
                  data-testid="textarea-manifest-json"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {uploadType === "full_code" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My AI Agent"
                  data-testid="input-agent-name-fullcode"
                />
              </div>
              <div>
                <Label htmlFor="runtime">Runtime</Label>
                <Select 
                  value={formData.runtime} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, runtime: v }))}
                >
                  <SelectTrigger data-testid="select-runtime-fullcode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nodejs">Node.js</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what your agent does..."
                data-testid="textarea-agent-description-fullcode"
              />
            </div>
            <div>
              <Label htmlFor="repoUrl">Git Repository URL</Label>
              <Input
                id="repoUrl"
                value={formData.repoUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, repoUrl: e.target.value }))}
                placeholder="https://github.com/username/my-agent"
                data-testid="input-repo-url"
              />
            </div>
            <div>
              <Label htmlFor="entryPoint">Entry Point</Label>
              <Input
                id="entryPoint"
                value={formData.entryPoint}
                onChange={(e) => setFormData(prev => ({ ...prev, entryPoint: e.target.value }))}
                placeholder="index.js or main.py"
                data-testid="input-entry-point"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={() => setStep(1)} data-testid="button-back-step2-bottom">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button 
          onClick={() => setStep(3)} 
          disabled={!formData.name || !formData.description}
          data-testid="button-continue-step2"
        >
          Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setStep(2)} data-testid="button-back-step3">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Select Tools</h2>
          <p className="text-muted-foreground">Choose which tools your agent can use</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {toolsLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          tools?.map((tool) => {
            const IconComponent = toolIcons[tool.iconName || "Settings"] || Settings;
            const isSelected = selectedTools.includes(tool.id);
            return (
              <Card 
                key={tool.id}
                className={`cursor-pointer transition-all hover-elevate ${isSelected ? "ring-2 ring-primary" : ""}`}
                onClick={() => {
                  setSelectedTools(prev => 
                    isSelected ? prev.filter(id => id !== tool.id) : [...prev, tool.id]
                  );
                }}
                data-testid={`card-tool-${tool.id}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{tool.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {tool.category.replace("_", " ")}
                      </Badge>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-primary shrink-0" />}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={() => setStep(2)} data-testid="button-back-step3-bottom">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button 
          onClick={() => createUpload.mutate()}
          disabled={createUpload.isPending}
          data-testid="button-create-agent"
        >
          {createUpload.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Create Agent <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderStep4 = () => {
    const latestTest = tests?.[0];
    const testPassed = latestTest?.status === "passed";
    const testFailed = latestTest?.status === "failed";
    const testRunning = latestTest?.status === "running" || latestTest?.status === "pending";

    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Agent Created!</h2>
          <p className="text-muted-foreground">Now let's test it in the sandbox before publishing</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Sandbox Testing
            </CardTitle>
            <CardDescription>Run your agent in a safe, isolated environment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!tests?.length ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No tests run yet. Start a sandbox test to verify your agent works correctly.</p>
                <Button onClick={() => runTest.mutate()} disabled={runTest.isPending} data-testid="button-run-test">
                  {runTest.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run Sandbox Test
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {tests.map((test) => (
                  <div key={test.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{test.testName}</span>
                      <Badge variant={
                        test.status === "passed" ? "default" : 
                        test.status === "failed" ? "destructive" : 
                        "secondary"
                      }>
                        {test.status === "running" || test.status === "pending" ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : test.status === "passed" ? (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        ) : (
                          <AlertCircle className="w-3 h-3 mr-1" />
                        )}
                        {test.status}
                      </Badge>
                    </div>
                    {test.logs && (
                      <pre className="text-xs bg-muted p-3 rounded font-mono overflow-x-auto whitespace-pre-wrap">
                        {test.logs}
                      </pre>
                    )}
                    {test.score && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Score:</span>
                        <Badge variant="outline">{test.score}%</Badge>
                      </div>
                    )}
                  </div>
                ))}

                <Button 
                  onClick={() => runTest.mutate()} 
                  disabled={runTest.isPending || testRunning}
                  variant="outline"
                  data-testid="button-run-another-test"
                >
                  {runTest.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run Another Test
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between mt-8">
          <Button 
            variant="outline" 
            onClick={() => {
              toast({
                title: "Draft saved!",
                description: "Your agent has been saved as a draft. You can find it in My Agents.",
              });
              navigate("/my-agents");
            }} 
            data-testid="button-save-draft"
          >
            Save as Draft
          </Button>
          <Button 
            onClick={() => publishAgent.mutate()}
            disabled={publishAgent.isPending || (!testPassed && !createdUpload?.status?.includes("approved"))}
            data-testid="button-publish-agent"
          >
            {publishAgent.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Publish to Marketplace
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        {renderStepIndicator()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </DashboardLayout>
  );
}
