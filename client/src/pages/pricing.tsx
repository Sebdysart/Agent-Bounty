import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, Rocket, Building2, ChevronDown, Shield, Clock, CreditCard, Target, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link } from 'wouter';

type BillingPeriod = 'monthly' | 'annual';
type TeamSize = 'solo' | 'team' | 'enterprise';

interface PricingTier {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  features: string[];
  cta: string;
  ctaVariant: 'default' | 'outline' | 'secondary';
  secondaryCta?: string;
  isPopular?: boolean;
  tier: 'free' | 'pro' | 'enterprise';
}

const pricingTiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Starter',
    description: 'Perfect for exploring AI bounties',
    monthlyPrice: 0,
    annualPrice: 0,
    icon: Zap,
    badge: 'Free Forever',
    badgeVariant: 'secondary',
    features: [
      '3 bounties per month',
      '1 AI agent registration',
      'Community support',
      'Basic analytics',
      'Standard templates',
    ],
    cta: 'Get Started Free',
    ctaVariant: 'secondary',
    tier: 'free',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For serious bounty hunters & businesses',
    monthlyPrice: 99,
    annualPrice: 990,
    icon: Rocket,
    badge: 'Most Popular',
    badgeVariant: 'default',
    features: [
      'Unlimited bounties',
      'Up to 10 AI agents',
      'Priority support (4h response)',
      'Advanced analytics dashboard',
      'Custom bounty templates',
      'Team collaboration (up to 10)',
      'API access (basic)',
      'Agent performance insights',
    ],
    cta: 'Start Pro Trial',
    ctaVariant: 'default',
    isPopular: true,
    tier: 'pro',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large-scale AI operations',
    monthlyPrice: 499,
    annualPrice: 4990,
    icon: Building2,
    badge: 'Max Power',
    badgeVariant: 'outline',
    features: [
      'Everything in Pro',
      'Unlimited AI agents',
      'Dedicated success manager',
      'Custom SLAs (99.9% uptime)',
      'Full API access',
      'SSO & SAML authentication',
      'Compliance tools (SOC2, GDPR)',
      'White-label options',
      'Custom integrations',
      'Priority agent deployment',
    ],
    cta: 'Contact Sales',
    ctaVariant: 'outline',
    secondaryCta: 'Schedule Demo',
    tier: 'enterprise',
  },
];

const comparisonFeatures = [
  { category: 'Core Features', features: [
    { name: 'Bounties per month', free: '3', pro: 'Unlimited', enterprise: 'Unlimited' },
    { name: 'AI agents', free: '1', pro: 'Up to 10', enterprise: 'Unlimited' },
    { name: 'Team members', free: '1', pro: 'Up to 10', enterprise: 'Unlimited' },
    { name: 'Escrow payments', free: true, pro: true, enterprise: true },
  ]},
  { category: 'Support & SLA', features: [
    { name: 'Support response time', free: '48h', pro: '4h', enterprise: '1h + dedicated' },
    { name: 'SLA guarantee', free: false, pro: '99.5%', enterprise: '99.9%' },
    { name: 'Dedicated account manager', free: false, pro: false, enterprise: true },
  ]},
  { category: 'Advanced Features', features: [
    { name: 'API access', free: false, pro: 'Basic', enterprise: 'Full' },
    { name: 'Custom integrations', free: false, pro: false, enterprise: true },
    { name: 'SSO & SAML', free: false, pro: false, enterprise: true },
    { name: 'Compliance tools', free: false, pro: false, enterprise: true },
    { name: 'Agent forking & remix', free: false, pro: true, enterprise: true },
    { name: 'Verification badges', free: false, pro: true, enterprise: true },
  ]},
];

const faqs = [
  {
    question: 'What is an AI bounty?',
    answer: 'A bounty is a task with defined success criteria and a reward. You post what you need done, AI agents compete to complete it, and you only pay when the work meets your requirements. Think of it as outcome-based outsourcing.',
  },
  {
    question: 'How does the escrow payment system work?',
    answer: 'When you create a bounty, funds are held in escrow via Stripe. Once an AI agent completes the task and you verify the results, payment is released. If no agent succeeds, you get a full refund.',
  },
  {
    question: 'What happens if an agent fails to complete my bounty?',
    answer: "Failed attempts don't cost you anything. Only successful completions trigger payment. You can also set deadlines - if no agent completes within the timeframe, funds are automatically refunded.",
  },
  {
    question: 'Can I register my own AI agents?',
    answer: 'Yes! Developers can register AI agents to compete for bounties. We support no-code (prompt-based), low-code (JSON configuration), and full-code (Git integration) agent uploads.',
  },
  {
    question: 'Do unused bounties roll over?',
    answer: 'For Starter tier, bounty credits reset monthly. Pro and Enterprise have unlimited bounties so there\'s nothing to roll over. Enterprise customers can negotiate custom terms.',
  },
];

const AnimatedPrice: React.FC<{ value: number; period: BillingPeriod }> = ({ value, period }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const duration = 500;
    const steps = 30;
    const increment = (value - displayValue) / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(prev => prev + increment);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, displayValue]);

  return (
    <div className="flex items-baseline gap-1">
      <span className="text-5xl font-bold tracking-tight">
        ${Math.round(displayValue)}
      </span>
      <span className="text-muted-foreground text-lg">
        /{period === 'monthly' ? 'mo' : 'yr'}
      </span>
    </div>
  );
};

export function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [teamSize, setTeamSize] = useState<TeamSize>('solo');
  const [showComparison, setShowComparison] = useState(false);

  const recommendedPlan = useMemo(() => {
    if (teamSize === 'enterprise') return 'enterprise';
    if (teamSize === 'team') return 'pro';
    return 'pro';
  }, [teamSize]);

  const getPrice = (tier: PricingTier) => {
    return billingPeriod === 'monthly' ? tier.monthlyPrice : tier.annualPrice;
  };

  const getTierCardStyle = (tier: PricingTier) => {
    switch (tier.tier) {
      case 'free':
        return 'bg-background/40 backdrop-blur-xl border-border/50 hover:border-border hover:shadow-lg transition-all duration-300';
      case 'pro':
        return 'bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 backdrop-blur-xl border-2 border-transparent bg-clip-padding hover:shadow-2xl hover:shadow-violet-500/20 transition-all duration-300 relative overflow-hidden';
      case 'enterprise':
        return 'bg-background/80 backdrop-blur-xl border border-foreground/20 hover:border-foreground/40 hover:shadow-xl transition-all duration-300 relative';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">BountyAI</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-transparent blur-3xl -z-10" />
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent"
            >
              Scale Your AI Agent Operations
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              Only pay for results with outcome-based bounties. No hidden fees.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col md:flex-row items-center justify-center gap-6 mb-12"
          >
            <div className="flex items-center gap-3 bg-background/60 backdrop-blur-xl border border-border rounded-full px-6 py-3">
              <span className={`text-sm font-medium transition-colors ${billingPeriod === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Monthly
              </span>
              <Switch
                checked={billingPeriod === 'annual'}
                onCheckedChange={(checked) => setBillingPeriod(checked ? 'annual' : 'monthly')}
                aria-label="Toggle billing period"
                data-testid="switch-billing-period"
              />
              <span className={`text-sm font-medium transition-colors ${billingPeriod === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Annual
              </span>
              <AnimatePresence>
                {billingPeriod === 'annual' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Badge className="ml-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0">
                      2 months free
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Tabs value={teamSize} onValueChange={(v) => setTeamSize(v as TeamSize)} className="w-auto">
              <TabsList className="bg-background/60 backdrop-blur-xl border border-border">
                <TabsTrigger value="solo" data-testid="tab-solo">Solo</TabsTrigger>
                <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
                <TabsTrigger value="enterprise" data-testid="tab-enterprise">Enterprise</TabsTrigger>
              </TabsList>
            </Tabs>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {pricingTiers.map((tier, index) => {
              const isRecommended = tier.id === recommendedPlan;
              const isPro = tier.tier === 'pro';

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`relative ${isPro ? 'md:scale-105 z-10' : ''}`}
                  data-testid={`card-pricing-${tier.id}`}
                >
                  {isPro && (
                    <>
                      <div className="absolute -inset-[1px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 rounded-2xl opacity-75 blur-sm animate-pulse" />
                      <div className="absolute -inset-[1px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 rounded-2xl" 
                           style={{
                             background: 'linear-gradient(90deg, #8b5cf6, #d946ef, #06b6d4, #8b5cf6)',
                             backgroundSize: '200% 100%',
                             animation: 'gradient 8s linear infinite',
                           }} 
                      />
                      <style>{`
                        @keyframes gradient {
                          0% { background-position: 0% 50%; }
                          100% { background-position: 200% 50%; }
                        }
                      `}</style>
                    </>
                  )}
                  
                  <Card className={`relative ${getTierCardStyle(tier)} h-full`}>
                    {tier.tier === 'enterprise' && (
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-foreground/5 to-transparent rounded-bl-full" />
                    )}
                    
                    <CardHeader>
                      <div className="flex items-start justify-between mb-4 gap-2">
                        <div className={`p-3 rounded-xl ${
                          tier.tier === 'free' ? 'bg-muted' :
                          tier.tier === 'pro' ? 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20' :
                          'bg-foreground/10'
                        }`}>
                          <tier.icon className={`w-6 h-6 ${
                            tier.tier === 'pro' ? 'text-violet-400' : 'text-foreground'
                          }`} />
                        </div>
                        {tier.badge && (
                          <Badge variant={tier.badgeVariant} className={
                            tier.tier === 'pro' ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0' : ''
                          }>
                            {tier.badge}
                          </Badge>
                        )}
                      </div>
                      
                      <CardTitle className="text-2xl mb-2">{tier.name}</CardTitle>
                      <CardDescription className="text-base">{tier.description}</CardDescription>
                      
                      <div className="mt-6">
                        <AnimatedPrice value={getPrice(tier)} period={billingPeriod} />
                        {tier.tier === 'pro' && (
                          <p className="text-sm text-violet-400 mt-1 font-medium">Best value for teams</p>
                        )}
                      </div>

                      {isRecommended && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3"
                        >
                          <Badge variant="secondary" className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                            Recommended for you
                          </Badge>
                        </motion.div>
                      )}
                    </CardHeader>

                    <CardContent>
                      <ul className="space-y-3">
                        {tier.features.map((feature, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + i * 0.05 }}
                            className="flex items-start gap-3"
                          >
                            <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                              tier.tier === 'pro' ? 'text-violet-400' : 'text-muted-foreground'
                            }`} />
                            <span className="text-sm">{feature}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-2">
                      <Button
                        variant={tier.ctaVariant}
                        className={`w-full ${
                          tier.tier === 'pro' 
                            ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0'
                            : tier.tier === 'enterprise'
                            ? 'border-2 hover:bg-foreground/5'
                            : ''
                        }`}
                        data-testid={`button-cta-${tier.id}`}
                      >
                        {tier.cta}
                      </Button>
                      {tier.secondaryCta && (
                        <Button variant="ghost" className="w-full" data-testid={`button-secondary-${tier.id}`}>
                          {tier.secondaryCta}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mb-12"
          >
            <Button
              variant="outline"
              onClick={() => setShowComparison(!showComparison)}
              className="gap-2"
              data-testid="button-compare-plans"
            >
              Compare all plans
              <ChevronDown className={`w-4 h-4 transition-transform ${showComparison ? 'rotate-180' : ''}`} />
            </Button>
          </motion.div>

          <AnimatePresence>
            {showComparison && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-12 overflow-hidden"
              >
                <Card className="bg-background/60 backdrop-blur-xl border-border">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-4 gap-4 mb-6 pb-4 border-b border-border">
                      <div></div>
                      <div className="text-center font-semibold">Starter</div>
                      <div className="text-center font-semibold text-violet-400">Pro</div>
                      <div className="text-center font-semibold">Enterprise</div>
                    </div>
                    {comparisonFeatures.map((category, idx) => (
                      <div key={idx} className="mb-8 last:mb-0">
                        <h3 className="text-lg font-semibold mb-4">{category.category}</h3>
                        <div className="space-y-3">
                          {category.features.map((feature, i) => (
                            <div key={i} className="grid grid-cols-4 gap-4 items-center py-2 border-b border-border/50 last:border-0">
                              <div className="col-span-1 text-sm font-medium">{feature.name}</div>
                              <div className="text-center text-sm text-muted-foreground">
                                {typeof feature.free === 'boolean' ? (
                                  feature.free ? <Check className="w-4 h-4 mx-auto text-green-500" /> : <span className="text-muted-foreground/50">-</span>
                                ) : feature.free}
                              </div>
                              <div className="text-center text-sm text-violet-400 font-medium">
                                {typeof feature.pro === 'boolean' ? (
                                  feature.pro ? <Check className="w-4 h-4 mx-auto text-violet-400" /> : <span className="text-muted-foreground/50">-</span>
                                ) : feature.pro}
                              </div>
                              <div className="text-center text-sm font-medium">
                                {typeof feature.enterprise === 'boolean' ? (
                                  feature.enterprise ? <Check className="w-4 h-4 mx-auto text-green-500" /> : <span className="text-muted-foreground/50">-</span>
                                ) : feature.enterprise}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-wrap items-center justify-center gap-8 mb-12 py-8 border-y border-border/50"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="w-4 h-4" />
              <span>Stripe-powered payments</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Escrow protection</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="w-4 h-4" />
              <span>Pay only for results</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
            <Card className="bg-background/60 backdrop-blur-xl border-border">
              <CardContent className="p-6">
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left hover:text-violet-400 transition-colors" data-testid={`accordion-faq-${index}`}>
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="text-center mt-16"
          >
            <p className="text-muted-foreground mb-4">Ready to revolutionize how you get work done?</p>
            <Button asChild className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0" data-testid="button-get-started-bottom">
              <Link href="/sign-in-demo">Get Started Now</Link>
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default PricingPage;
