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
import { ArrowLeft, Sparkles, DollarSign, Clock, Target, CheckCircle, Loader2, Plus, X, ArrowDown, Zap } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AITaskChat } from "@/components/ai-task-chat";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import { Spotlight } from "@/components/ui/spotlight";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { AIFeaturesSection } from "@/components/ui/ai-feature-showcase";
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
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

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
        reward: String(bounty.reward),
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

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      marketing: "from-fuchsia-500 to-pink-500",
      sales: "from-emerald-500 to-teal-500",
      research: "from-cyan-500 to-blue-500",
      data_analysis: "from-violet-500 to-purple-500",
      development: "from-orange-500 to-amber-500",
      other: "from-slate-500 to-gray-500",
    };
    return colors[category] || colors.other;
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <BackgroundGradientAnimation
        gradientBackgroundStart="rgb(15, 10, 40)"
        gradientBackgroundEnd="rgb(5, 5, 20)"
        firstColor="139, 92, 246"
        secondColor="236, 72, 153"
        thirdColor="6, 182, 212"
        fourthColor="168, 85, 247"
        fifthColor="59, 130, 246"
        pointerColor="139, 92, 246"
        size="80%"
        blendingValue="hard-light"
        interactive={true}
        containerClassName="opacity-60"
      />
      
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="hsl(var(--primary))"
      />
      
      <header className="sticky top-0 z-50 glass border-b border-border/30 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-fuchsia-500/5 to-cyan-500/5" />
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4 relative">
          <Link href="/">
            <Button variant="ghost" size="icon" className="hover:bg-primary/10" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                AI Task Builder
              </h1>
              <p className="text-xs text-muted-foreground">Create bounties using AI or templates</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-12">
        <section className="mb-16">
          <AITaskChat 
            onSubmit={(prompt) => generateBounty.mutate(prompt)} 
            isGenerating={generateBounty.isPending}
          />
        </section>

        {!generatedBounty && (
          <AIFeaturesSection />
        )}

        <AnimatePresence>
          {generatedBounty && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.5 }}
              className="mb-12"
            >
              <div className="flex justify-center mb-6">
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="p-3 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30"
                >
                  <ArrowDown className="w-5 h-5 text-violet-400" />
                </motion.div>
              </div>

              <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-violet-500/60 via-fuchsia-500/60 to-cyan-500/60">
                <Card className="bg-background/95 backdrop-blur-xl border-0 rounded-2xl shadow-2xl shadow-violet-500/10">
                  <CardHeader className="border-b border-border/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                        <Target className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <CardTitle className="text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          Generated Bounty
                        </CardTitle>
                        <CardDescription>
                          Review and customize before creating
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-5">
                        <div>
                          <label className="text-sm font-medium mb-2 block text-muted-foreground">Title</label>
                          <Input 
                            value={generatedBounty.title} 
                            onChange={(e) => setGeneratedBounty({ ...generatedBounty, title: e.target.value })}
                            className="bg-muted/30 border-border/50 focus:border-violet-500/50 transition-colors"
                            data-testid="input-title"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block text-muted-foreground">Description</label>
                          <Textarea 
                            value={generatedBounty.description}
                            onChange={(e) => setGeneratedBounty({ ...generatedBounty, description: e.target.value })}
                            className="min-h-36 bg-muted/30 border-border/50 focus:border-violet-500/50 transition-colors"
                            data-testid="input-description"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block text-muted-foreground">Category</label>
                            <Select 
                              value={generatedBounty.category}
                              onValueChange={(v) => setGeneratedBounty({ ...generatedBounty, category: v })}
                            >
                              <SelectTrigger className="bg-muted/30 border-border/50" data-testid="select-category">
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
                            <label className="text-sm font-medium mb-2 block text-muted-foreground">Reward ($)</label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                              <Input 
                                type="number"
                                value={generatedBounty.reward}
                                onChange={(e) => setGeneratedBounty({ ...generatedBounty, reward: parseInt(e.target.value) })}
                                className="pl-9 bg-muted/30 border-border/50 focus:border-violet-500/50 transition-colors"
                                data-testid="input-reward"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-3 block text-muted-foreground">Success Metrics</label>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                          {customMetrics.map((metric, i) => (
                            <motion.div 
                              key={i} 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-500/5 to-transparent rounded-lg border border-emerald-500/20"
                            >
                              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span className="flex-1 text-sm">{metric}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => removeMetric(i)}
                                data-testid={`button-remove-metric-${i}`}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Input
                            placeholder="Add a success metric..."
                            value={newMetric}
                            onChange={(e) => setNewMetric(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMetric())}
                            className="bg-muted/30 border-border/50 focus:border-violet-500/50"
                            data-testid="input-new-metric"
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            onClick={addMetric} 
                            className="border-violet-500/30 hover:bg-violet-500/10 hover:border-violet-500/50"
                            data-testid="button-add-metric"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="gap-3 border-t border-border/30 pt-6">
                    <Button 
                      className="flex-1 h-12 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 hover:from-violet-600 hover:via-fuchsia-600 hover:to-violet-600 text-white shadow-lg shadow-violet-500/30 font-semibold" 
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
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Create Bounty
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline"
                      className="h-12 border-border/50 hover:bg-muted/50"
                      onClick={() => { setGeneratedBounty(null); setCustomMetrics([]); }}
                      data-testid="button-reset"
                    >
                      Start Over
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mt-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <TextShimmer className="text-sm font-semibold text-muted-foreground">
              or choose a template
            </TextShimmer>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {templatesLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="relative rounded-xl p-[1px] bg-gradient-to-br from-border/50 to-border/30">
                  <Card className="bg-card/80 backdrop-blur-sm border-0 animate-pulse">
                    <CardHeader>
                      <div className="h-5 w-2/3 bg-muted rounded" />
                      <div className="h-4 w-full bg-muted rounded mt-3" />
                      <div className="h-4 w-3/4 bg-muted rounded mt-1" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4">
                        <div className="h-4 w-16 bg-muted rounded" />
                        <div className="h-4 w-20 bg-muted rounded" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))
            ) : (
              templates?.map((template, index) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  onMouseEnter={() => setHoveredTemplate(template.id)}
                  onMouseLeave={() => setHoveredTemplate(null)}
                >
                  <div 
                    className={`relative rounded-xl p-[1px] transition-all duration-300 cursor-pointer ${
                      hoveredTemplate === template.id 
                        ? 'bg-gradient-to-br from-violet-500/70 via-fuchsia-500/70 to-cyan-500/70 shadow-lg shadow-violet-500/20' 
                        : 'bg-gradient-to-br from-border/50 via-border/30 to-border/50'
                    }`}
                    onClick={() => useTemplate(template)}
                    data-testid={`template-${template.id}`}
                  >
                    <div className="relative overflow-visible rounded-xl">
                      <GlowingEffect
                        spread={40}
                        glow={true}
                        disabled={hoveredTemplate !== template.id}
                        proximity={64}
                        inactiveZone={0.01}
                        borderWidth={2}
                      />
                      <Card className="bg-card/90 backdrop-blur-xl border-0 rounded-xl h-full transition-all duration-300 group overflow-hidden">
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getCategoryColor(template.category)} opacity-0 group-hover:opacity-100 transition-opacity`} />
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <CardTitle className="text-base font-semibold group-hover:text-violet-400 transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                              {template.name}
                            </CardTitle>
                            <Badge 
                              variant="outline" 
                              className={`shrink-0 border-0 bg-gradient-to-r ${getCategoryColor(template.category)} bg-clip-text text-transparent font-semibold text-xs`}
                            >
                              {template.category}
                            </Badge>
                          </div>
                          <CardDescription className="line-clamp-2 mt-2">{template.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-5 text-sm">
                            <span className="flex items-center gap-1.5 text-emerald-500 font-mono font-semibold">
                              <DollarSign className="w-4 h-4" />
                              {template.reward.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              {template.estimatedTime}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
