import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Sparkles, DollarSign, Clock, Target, CheckCircle, Loader2, Plus, X, ArrowDown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AITaskChat } from "@/components/ai-task-chat";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { motion, AnimatePresence } from "framer-motion";

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
      : (template.successMetrics as string).split("\n").filter((m: string) => m.trim());
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
    <DottedSurface className="min-h-screen bg-black">
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80 pointer-events-none" />
      
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
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

      <main className="relative max-w-6xl mx-auto px-4 md:px-6 py-12">
        <section className="mb-16">
          <AITaskChat 
            onSubmit={(prompt) => generateBounty.mutate(prompt)} 
            isGenerating={generateBounty.isPending}
          />
        </section>

        <AnimatePresence>
          {generatedBounty && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <div className="flex justify-center mb-6">
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="p-2 rounded-full bg-primary/10 border border-primary/20"
                >
                  <ArrowDown className="w-5 h-5 text-primary" />
                </motion.div>
              </div>

              <Card className="border-primary/50 bg-card/80 backdrop-blur-sm shadow-xl shadow-violet-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Generated Bounty
                  </CardTitle>
                  <CardDescription>
                    Review and customize before creating
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Title</label>
                        <Input 
                          value={generatedBounty.title} 
                          onChange={(e) => setGeneratedBounty({ ...generatedBounty, title: e.target.value })}
                          data-testid="input-title"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Description</label>
                        <Textarea 
                          value={generatedBounty.description}
                          onChange={(e) => setGeneratedBounty({ ...generatedBounty, description: e.target.value })}
                          className="min-h-32"
                          data-testid="input-description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Category</label>
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
                          <label className="text-sm font-medium mb-1.5 block">Reward ($)</label>
                          <Input 
                            type="number"
                            value={generatedBounty.reward}
                            onChange={(e) => setGeneratedBounty({ ...generatedBounty, reward: parseInt(e.target.value) })}
                            data-testid="input-reward"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-3 block">Success Metrics</label>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {customMetrics.map((metric, i) => (
                          <motion.div 
                            key={i} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border/50"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="flex-1 text-sm">{metric}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeMetric(i)}
                              data-testid={`button-remove-metric-${i}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
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
                </CardContent>
                <CardFooter className="gap-3 border-t pt-6">
                  <Button 
                    className="flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white shadow-lg shadow-violet-500/25" 
                    onClick={() => createBounty.mutate(generatedBounty)}
                    disabled={createBounty.isPending}
                    data-testid="button-create-bounty"
                  >
                    {createBounty.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating...
                      </>
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
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted-foreground font-medium">or choose a template</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templatesLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-5 w-2/3 bg-muted rounded" />
                    <div className="h-4 w-full bg-muted rounded mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                      <div className="h-4 w-16 bg-muted rounded" />
                      <div className="h-4 w-20 bg-muted rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              templates?.map((template) => (
                <motion.div
                  key={template.id}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card 
                    className="cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-violet-500/5 transition-all h-full"
                    onClick={() => useTemplate(template)}
                    data-testid={`template-${template.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <Badge variant="outline" className="shrink-0">{template.category}</Badge>
                      </div>
                      <CardDescription className="line-clamp-2">{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                          ${template.reward.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {template.estimatedTime}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </main>
    </DottedSurface>
  );
}
