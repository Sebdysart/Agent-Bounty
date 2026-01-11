import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Sparkles, Wand2, FileText, DollarSign, Clock, Target, CheckCircle, Loader2, Copy, Plus, X } from "lucide-react";
import { Link, useLocation } from "wouter";

const promptSchema = z.object({
  prompt: z.string().min(10, "Describe your task in more detail"),
});

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  reward: number;
  successMetrics: string[];
  estimatedTime: string;
}

interface GeneratedBounty {
  title: string;
  description: string;
  category: string;
  reward: number;
  deadline: string;
  successMetrics: string;
  verificationCriteria?: string;
}

export function TaskBuilderPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [generatedBounty, setGeneratedBounty] = useState<GeneratedBounty | null>(null);
  const [customMetrics, setCustomMetrics] = useState<string[]>([]);
  const [newMetric, setNewMetric] = useState("");

  const form = useForm<z.infer<typeof promptSchema>>({
    resolver: zodResolver(promptSchema),
    defaultValues: { prompt: "" },
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["/api/bounty-templates"],
  });

  const generateBounty = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest("POST", "/api/ai/generate-bounty", { prompt });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedBounty(data);
      const metrics = typeof data.successMetrics === 'string' 
        ? data.successMetrics.split('\n').filter((m: string) => m.trim())
        : (data.successMetrics || []);
      setCustomMetrics(metrics);
      toast({
        title: "Bounty generated!",
        description: "Review and customize the generated bounty details",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate bounty",
        variant: "destructive",
      });
    },
  });

  const createBounty = useMutation({
    mutationFn: async (bounty: GeneratedBounty) => {
      const response = await apiRequest("POST", "/api/bounties", {
        ...bounty,
        successMetrics: customMetrics.join("\n"),
        verificationCriteria: bounty.verificationCriteria || "Output must meet all success metrics. Reviewer will verify completion against stated requirements.",
        deadline: bounty.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bounties"] });
      toast({
        title: "Bounty created!",
        description: "Your bounty is now live and ready for agents",
      });
      navigate(`/bounties/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Failed to create bounty",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const useTemplate = (template: Template) => {
    const metricsString = Array.isArray(template.successMetrics) 
      ? template.successMetrics.join("\n") 
      : template.successMetrics;
    setGeneratedBounty({
      title: template.name,
      description: template.description,
      category: template.category,
      reward: template.reward,
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      successMetrics: metricsString,
      verificationCriteria: "Output must meet all success metrics. Reviewer will verify completion against stated requirements.",
    });
    const metricsArray = Array.isArray(template.successMetrics) 
      ? template.successMetrics 
      : template.successMetrics.split("\n").filter((m: string) => m.trim());
    setCustomMetrics(metricsArray);
  };

  const addMetric = () => {
    if (newMetric.trim()) {
      setCustomMetrics([...customMetrics, newMetric.trim()]);
      setNewMetric("");
    }
  };

  const removeMetric = (index: number) => {
    setCustomMetrics(customMetrics.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Task Builder
            </h1>
            <p className="text-sm text-muted-foreground">Create bounties using AI or templates</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5" />
                  Describe Your Task
                </CardTitle>
                <CardDescription>
                  Tell us what you need done in plain English. Our AI will generate a complete bounty with success metrics.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => generateBounty.mutate(data.prompt))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="prompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What do you need accomplished?</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Example: I need to research and analyze our top 10 competitors in the SaaS project management space, including their pricing, features, and market positioning..."
                              className="min-h-32 resize-none"
                              {...field}
                              data-testid="input-prompt"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={generateBounty.isPending}
                      data-testid="button-generate"
                    >
                      {generateBounty.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Bounty with AI
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Industry Templates
                </CardTitle>
                <CardDescription>
                  Start from a pre-built template and customize
                </CardDescription>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates?.map((template) => (
                      <div
                        key={template.id}
                        className="p-4 border rounded-lg hover-elevate cursor-pointer"
                        onClick={() => useTemplate(template)}
                        data-testid={`template-${template.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-medium">{template.name}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-1">{template.description}</p>
                          </div>
                          <Badge variant="outline">{template.category}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${template.reward.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {template.estimatedTime}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className={generatedBounty ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  {generatedBounty ? "Generated Bounty" : "Preview"}
                </CardTitle>
                <CardDescription>
                  {generatedBounty 
                    ? "Review and customize before creating" 
                    : "Your generated bounty will appear here"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generatedBounty ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Title</label>
                      <Input 
                        value={generatedBounty.title} 
                        onChange={(e) => setGeneratedBounty({ ...generatedBounty, title: e.target.value })}
                        data-testid="input-title"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea 
                        value={generatedBounty.description}
                        onChange={(e) => setGeneratedBounty({ ...generatedBounty, description: e.target.value })}
                        className="min-h-24"
                        data-testid="input-description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Category</label>
                        <Select 
                          value={generatedBounty.category}
                          onValueChange={(v) => setGeneratedBounty({ ...generatedBounty, category: v })}
                        >
                          <SelectTrigger data-testid="select-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="sales">Sales</SelectItem>
                            <SelectItem value="research">Research</SelectItem>
                            <SelectItem value="data_analysis">Data Analysis</SelectItem>
                            <SelectItem value="development">Development</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Reward</label>
                        <Input 
                          type="number"
                          value={generatedBounty.reward}
                          onChange={(e) => setGeneratedBounty({ ...generatedBounty, reward: parseInt(e.target.value) })}
                          data-testid="input-reward"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Success Metrics</label>
                      <div className="space-y-2">
                        {customMetrics.map((metric, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <CheckCircle className="w-4 h-4 text-success shrink-0" />
                            <span className="flex-1 text-sm">{metric}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMetric(i)}
                              data-testid={`button-remove-metric-${i}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a success metric..."
                            value={newMetric}
                            onChange={(e) => setNewMetric(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMetric())}
                            data-testid="input-new-metric"
                          />
                          <Button type="button" variant="outline" size="icon" onClick={addMetric} data-testid="button-add-metric">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Describe your task or select a template to get started</p>
                  </div>
                )}
              </CardContent>
              {generatedBounty && (
                <CardFooter className="gap-3">
                  <Button 
                    className="flex-1" 
                    onClick={() => createBounty.mutate(generatedBounty)}
                    disabled={createBounty.isPending}
                    data-testid="button-create-bounty"
                  >
                    {createBounty.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Create Bounty"
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => { setGeneratedBounty(null); setCustomMetrics([]); }}
                    data-testid="button-reset"
                  >
                    Start Over
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
