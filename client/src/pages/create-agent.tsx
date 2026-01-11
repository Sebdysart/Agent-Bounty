import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Bot, X, Plus } from "lucide-react";
import { Link } from "wouter";

const colorOptions = [
  "#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#14B8A6", "#06B6D4", "#6366F1",
];

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(50, "Name must be less than 50 characters"),
  description: z.string().min(20, "Description must be at least 20 characters").max(500, "Description must be less than 500 characters"),
  capabilities: z.array(z.string()).min(1, "Add at least one capability").max(10, "Maximum 10 capabilities"),
  avatarColor: z.string(),
});

type FormData = z.infer<typeof formSchema>;

export function CreateAgentPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [capabilityInput, setCapabilityInput] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      capabilities: [],
      avatarColor: colorOptions[0],
    },
  });

  const createAgent = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/agents", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Agent registered!",
        description: "Your AI agent is now ready to compete for bounties.",
      });
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to register agent",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createAgent.mutate(data);
  };

  const addCapability = () => {
    const trimmed = capabilityInput.trim();
    if (trimmed && !form.getValues("capabilities").includes(trimmed)) {
      form.setValue("capabilities", [...form.getValues("capabilities"), trimmed]);
      setCapabilityInput("");
    }
  };

  const removeCapability = (cap: string) => {
    form.setValue(
      "capabilities",
      form.getValues("capabilities").filter((c) => c !== cap)
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-2xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">Register Agent</h1>
            <p className="text-sm text-muted-foreground">Add your AI agent to the marketplace</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Agent Identity</CardTitle>
                <CardDescription>Give your agent a name and appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-6">
                  <div className="space-y-2">
                    <FormLabel>Avatar Color</FormLabel>
                    <div className="grid grid-cols-5 gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => form.setValue("avatarColor", color)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            form.watch("avatarColor") === color ? "ring-2 ring-offset-2 ring-primary" : ""
                          }`}
                          style={{ backgroundColor: color }}
                          data-testid={`button-color-${color}`}
                        >
                          <Bot className="w-5 h-5 text-white" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div
                      className="w-20 h-20 rounded-xl flex items-center justify-center mx-auto"
                      style={{ backgroundColor: form.watch("avatarColor") }}
                    >
                      <Bot className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-center text-sm text-muted-foreground mt-2">Preview</p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., LeadGen Pro, DataMiner X" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormDescription>A memorable name for your agent</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what your agent does, its strengths, and what kind of bounties it excels at..."
                          className="min-h-[100px] resize-y"
                          {...field}
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormDescription>{field.value.length}/500 characters</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Capabilities</CardTitle>
                <CardDescription>What can your agent do? Add tags to describe its skills.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="capabilities"
                  render={() => (
                    <FormItem>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g., Lead Generation, Data Analysis, Web Scraping"
                          value={capabilityInput}
                          onChange={(e) => setCapabilityInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCapability();
                            }
                          }}
                          data-testid="input-capability"
                        />
                        <Button type="button" variant="outline" onClick={addCapability} data-testid="button-add-capability">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <FormDescription>Press Enter or click + to add</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-2">
                  {form.watch("capabilities").map((cap) => (
                    <Badge key={cap} variant="secondary" className="gap-1 pr-1">
                      {cap}
                      <button
                        type="button"
                        onClick={() => removeCapability(cap)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                        data-testid={`button-remove-${cap}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {form.watch("capabilities").length === 0 && (
                    <span className="text-sm text-muted-foreground">No capabilities added yet</span>
                  )}
                </div>

                <div className="pt-4">
                  <p className="text-sm text-muted-foreground mb-2">Popular capabilities:</p>
                  <div className="flex flex-wrap gap-2">
                    {["Lead Generation", "Market Research", "Data Analysis", "Web Scraping", "Content Writing", "SEO Optimization"].map((cap) => (
                      <Badge
                        key={cap}
                        variant="outline"
                        className="cursor-pointer hover-elevate"
                        onClick={() => {
                          if (!form.getValues("capabilities").includes(cap)) {
                            form.setValue("capabilities", [...form.getValues("capabilities"), cap]);
                          }
                        }}
                        data-testid={`badge-suggestion-${cap}`}
                      >
                        + {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate("/")} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createAgent.isPending} data-testid="button-submit">
                {createAgent.isPending ? "Registering..." : "Register Agent"}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
