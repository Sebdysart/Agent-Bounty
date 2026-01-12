import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Users, Gift, DollarSign, TrendingUp, Copy, Share2, 
  CheckCircle, Clock, Link2, Award, Sparkles 
} from "lucide-react";

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: string;
  pendingEarnings: string;
  conversionRate: string;
}

interface Payout {
  id: number;
  amount: string;
  sourceType: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export default function ReferralDashboardPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: stats } = useQuery<ReferralStats>({
    queryKey: ["/api/referrals/stats"],
  });

  const { data: codeData } = useQuery<{ code: string | null }>({
    queryKey: ["/api/referrals/code"],
  });

  const { data: payouts = [] } = useQuery<Payout[]>({
    queryKey: ["/api/referrals/payouts"],
  });

  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/referrals/generate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/code"] });
      toast({ title: "Referral code generated!" });
    },
  });

  const referralCode = codeData?.code;
  const referralLink = referralCode 
    ? `${window.location.origin}?ref=${referralCode}` 
    : null;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const statCards = [
    { 
      title: "Total Referrals", 
      value: stats?.totalReferrals || 0, 
      icon: Users, 
      gradient: "from-violet-500 to-fuchsia-500" 
    },
    { 
      title: "Active Referrals", 
      value: stats?.activeReferrals || 0, 
      icon: CheckCircle, 
      gradient: "from-green-500 to-emerald-500" 
    },
    { 
      title: "Total Earnings", 
      value: `$${stats?.totalEarnings || "0.00"}`, 
      icon: DollarSign, 
      gradient: "from-cyan-500 to-blue-500" 
    },
    { 
      title: "Pending Earnings", 
      value: `$${stats?.pendingEarnings || "0.00"}`, 
      icon: Clock, 
      gradient: "from-yellow-500 to-orange-500" 
    },
  ];

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-500/30">
            <Gift className="w-6 h-6 text-fuchsia-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Referral Program</h1>
            <p className="text-muted-foreground">Earn rewards by inviting others</p>
          </div>
        </div>
        <Badge className="bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border-violet-500/30 text-violet-300">
          <Sparkles className="w-3 h-3 mr-1" />
          10% Commission
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="bg-card/50 border-border/50 hover-elevate">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} bg-opacity-20`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-violet-400" />
              Your Referral Link
            </CardTitle>
            <CardDescription>Share this link to earn commissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {referralCode ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Referral Code</label>
                    <div className="flex gap-2 mt-1">
                      <Input 
                        value={referralCode} 
                        readOnly 
                        className="font-mono bg-background/50"
                        data-testid="input-referral-code"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(referralCode)}
                        data-testid="button-copy-code"
                      >
                        {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Referral Link</label>
                    <div className="flex gap-2 mt-1">
                      <Input 
                        value={referralLink || ""} 
                        readOnly 
                        className="font-mono text-xs bg-background/50"
                        data-testid="input-referral-link"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => referralLink && copyToClipboard(referralLink)}
                        data-testid="button-copy-link"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Generate your referral code to start earning</p>
                <Button
                  onClick={() => generateCodeMutation.mutate()}
                  disabled={generateCodeMutation.isPending}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                  data-testid="button-generate-code"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Referral Code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-cyan-400" />
              Commission Tiers
            </CardTitle>
            <CardDescription>Earn more as you refer more users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { tier: "Standard", referrals: "0-10", rate: "10%", active: true },
                { tier: "Silver", referrals: "11-25", rate: "12%", active: false },
                { tier: "Gold", referrals: "26-50", rate: "15%", active: false },
                { tier: "Platinum", referrals: "51+", rate: "20%", active: false },
              ].map((tier) => (
                <div 
                  key={tier.tier}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    tier.active 
                      ? "bg-violet-500/10 border-violet-500/30" 
                      : "bg-background/50 border-border/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={tier.active ? "default" : "outline"}
                      className={tier.active ? "bg-gradient-to-r from-violet-600 to-fuchsia-600" : ""}
                    >
                      {tier.tier}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{tier.referrals} referrals</span>
                  </div>
                  <span className="font-bold text-lg">{tier.rate}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Payout History
          </CardTitle>
          <CardDescription>Track your commission earnings</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length > 0 ? (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div 
                  key={payout.id} 
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/30"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      payout.status === "completed" ? "bg-green-500/20" : "bg-yellow-500/20"
                    }`}>
                      <DollarSign className={`w-4 h-4 ${
                        payout.status === "completed" ? "text-green-400" : "text-yellow-400"
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">${payout.amount}</p>
                      <p className="text-sm text-muted-foreground">
                        From {payout.sourceType} • {new Date(payout.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline"
                    className={payout.status === "completed" 
                      ? "bg-green-500/10 text-green-400 border-green-500/30"
                      : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                    }
                  >
                    {payout.status === "completed" ? (
                      <><CheckCircle className="w-3 h-3 mr-1" />Paid</>
                    ) : (
                      <><Clock className="w-3 h-3 mr-1" />Pending</>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No payouts yet. Start referring to earn commissions!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
