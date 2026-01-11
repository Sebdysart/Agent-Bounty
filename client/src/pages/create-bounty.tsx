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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, CalendarIcon, Target, DollarSign, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters").max(100, "Title must be less than 100 characters"),
  description: z.string().min(50, "Description must be at least 50 characters").max(2000, "Description must be less than 2000 characters"),
  category: z.enum(["marketing", "sales", "research", "data_analysis", "development", "other"]),
  reward: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 100 && num <= 100000;
  }, "Reward must be between $100 and $100,000"),
  successMetrics: z.string().min(20, "Success metrics must be at least 20 characters"),
  verificationCriteria: z.string().min(20, "Verification criteria must be at least 20 characters"),
  deadline: z.date().min(new Date(), "Deadline must be in the future"),
});

type FormData = z.infer<typeof formSchema>;

export function CreateBountyPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: undefined,
      reward: "",
      successMetrics: "",
      verificationCriteria: "",
      deadline: undefined,
    },
  });

  const createBounty = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/bounties", {
        ...data,
        reward: data.reward,
        deadline: data.deadline.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bounties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Bounty created!",
        description: "Your bounty has been posted and is now open for agents.",
      });
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create bounty",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createBounty.mutate(data);
  };

  const steps = [
    { number: 1, title: "Basic Info" },
    { number: 2, title: "Requirements" },
    { number: 3, title: "Review" },
  ];

  const canProceed = () => {
    if (step === 1) {
      const { title, description, category, reward } = form.getValues();
      return title.length >= 10 && description.length >= 50 && category && parseFloat(reward) >= 100;
    }
    if (step === 2) {
      const { successMetrics, verificationCriteria, deadline } = form.getValues();
      return successMetrics.length >= 20 && verificationCriteria.length >= 20 && deadline;
    }
    return true;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-3xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">Create Bounty</h1>
            <p className="text-sm text-muted-foreground">Post a new challenge for AI agents</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.number} className="flex items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors",
                step >= s.number ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {step > s.number ? <CheckCircle className="w-5 h-5" /> : s.number}
              </div>
              <span className={cn(
                "ml-3 text-sm font-medium hidden sm:block",
                step >= s.number ? "text-foreground" : "text-muted-foreground"
              )}>
                {s.title}
              </span>
              {i < steps.length - 1 && (
                <div className={cn(
                  "w-12 sm:w-24 h-1 mx-4 rounded",
                  step > s.number ? "bg-primary" : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Tell us about the challenge you want to solve</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bounty Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Generate 100 qualified B2B leads in SaaS sector" {...field} data-testid="input-title" />
                        </FormControl>
                        <FormDescription>A clear, concise title that describes the task</FormDescription>
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
                            placeholder="Provide detailed information about the task, context, and any specific requirements..."
                            className="min-h-[120px] resize-y"
                            {...field}
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormDescription>{field.value.length}/2000 characters</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-category">
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="marketing">Marketing</SelectItem>
                              <SelectItem value="sales">Sales</SelectItem>
                              <SelectItem value="research">Research</SelectItem>
                              <SelectItem value="data_analysis">Data Analysis</SelectItem>
                              <SelectItem value="development">Development</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reward"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reward Amount (USD)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                type="number"
                                placeholder="1000"
                                className="pl-9 font-mono"
                                {...field}
                                data-testid="input-reward"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>Between $100 and $100,000</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Requirements & Verification</CardTitle>
                  <CardDescription>Define how success will be measured</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="successMetrics"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Success Metrics</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="List the specific, measurable outcomes that define success (one per line):&#10;- 100 leads with valid email addresses&#10;- Each lead must be in the SaaS industry&#10;- Decision-maker level contacts only"
                            className="min-h-[120px] resize-y"
                            {...field}
                            data-testid="input-success-metrics"
                          />
                        </FormControl>
                        <FormDescription>Be specific - these metrics determine payout</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="verificationCriteria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Criteria</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="How will you verify the work? What proof do you need?&#10;- CSV file with contact details&#10;- LinkedIn profile URLs for each lead&#10;- Company website verification"
                            className="min-h-[120px] resize-y"
                            {...field}
                            data-testid="input-verification"
                          />
                        </FormControl>
                        <FormDescription>Describe the verification process</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deadline"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Deadline</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full sm:w-[280px] pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                data-testid="button-deadline"
                              >
                                {field.value ? format(field.value, "PPP") : "Pick a deadline"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>When should agents complete this bounty?</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Your Bounty</CardTitle>
                  <CardDescription>Make sure everything looks correct before posting</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Title</div>
                        <div className="font-medium">{form.getValues("title")}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Reward</div>
                        <div className="text-2xl font-bold font-mono text-success">
                          ${parseFloat(form.getValues("reward") || "0").toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="text-sm text-muted-foreground mb-1">Category</div>
                        <div className="font-medium capitalize">{form.getValues("category")?.replace("_", " ")}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="text-sm text-muted-foreground mb-1">Deadline</div>
                        <div className="font-medium">
                          {form.getValues("deadline") ? format(form.getValues("deadline"), "PPP") : "Not set"}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-2">Description</div>
                      <div className="text-sm whitespace-pre-wrap">{form.getValues("description")}</div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-2">Success Metrics</div>
                      <div className="text-sm whitespace-pre-wrap">{form.getValues("successMetrics")}</div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-2">Verification Criteria</div>
                      <div className="text-sm whitespace-pre-wrap">{form.getValues("verificationCriteria")}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-4 rounded-lg bg-success/10 border border-success/20">
                    <Target className="w-5 h-5 text-success" />
                    <span className="text-sm">
                      Your bounty will be live and open for agent submissions immediately after posting.
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between gap-4">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)} data-testid="button-prev">
                  Previous
                </Button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <Button type="button" onClick={() => setStep(step + 1)} disabled={!canProceed()} data-testid="button-next">
                  Continue
                </Button>
              ) : (
                <Button type="submit" disabled={createBounty.isPending} data-testid="button-submit">
                  {createBounty.isPending ? "Posting..." : "Post Bounty"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
