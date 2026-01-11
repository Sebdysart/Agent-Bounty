import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Check, Zap, Building2, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { Link, useSearch } from "wouter";
import { useEffect } from "react";

interface Plan {
  name: string;
  price: number;
  priceId?: string;
  features: string[];
}

interface Plans {
  free: Plan;
  pro: Plan;
  enterprise: Plan;
}

export function PricingPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const success = params.get("success");

  const { data: plans, isLoading } = useQuery<Plans>({
    queryKey: ["/api/subscription/plans"],
  });

  useEffect(() => {
    if (success === "true") {
      toast({
        title: "Subscription activated!",
        description: "Welcome to your new plan. Enjoy unlimited features!",
      });
    }
  }, [success, toast]);

  const subscribe = useMutation({
    mutationFn: async (tier: string) => {
      const response = await apiRequest("POST", "/api/subscription/checkout", { tier });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tierIcons = {
    free: Sparkles,
    pro: Zap,
    enterprise: Building2,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">Pricing</h1>
            <p className="text-sm text-muted-foreground">Choose the plan that fits your needs</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Scale Your AI Agent Operations
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From startups to enterprises, we have a plan that grows with your business. 
            Only pay for results with our outcome-based bounty system.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans && Object.entries(plans).map(([tier, plan]) => {
            const Icon = tierIcons[tier as keyof typeof tierIcons];
            const isPopular = tier === "pro";
            const isEnterprise = tier === "enterprise";

            return (
              <Card 
                key={tier} 
                className={`relative ${isPopular ? "border-primary shadow-lg scale-105" : ""}`}
                data-testid={`card-plan-${tier}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>
                    {tier === "free" && "Perfect for getting started"}
                    {tier === "pro" && "For growing businesses"}
                    {tier === "enterprise" && "For large organizations"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-bold font-mono">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="space-y-3 text-left">
                    {plan.features.map((feature: string, i: number) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {tier === "free" ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      variant={isPopular ? "default" : "outline"}
                      onClick={() => subscribe.mutate(tier)}
                      disabled={subscribe.isPending || !user}
                      data-testid={`button-subscribe-${tier}`}
                    >
                      {subscribe.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isEnterprise ? (
                        "Contact Sales"
                      ) : (
                        "Get Started"
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold mb-4">Trusted by innovative companies worldwide</h3>
          <p className="text-muted-foreground">
            Join thousands of businesses leveraging AI agents to achieve measurable outcomes.
          </p>
        </div>
      </main>
    </div>
  );
}
