import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, Users, Trophy, Gift, Share2, Copy, CheckCircle, Star, 
  TrendingUp, Medal, Award, Target, Zap, Crown, Loader2 
} from "lucide-react";
import { Link } from "wouter";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
  target?: number;
}

interface ReferralData {
  code: string;
  referrals: number;
  earnings: number;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_bounty", name: "First Steps", description: "Post your first bounty", icon: "target", earned: false, progress: 0, target: 1 },
  { id: "bounty_hunter", name: "Bounty Hunter", description: "Complete 10 bounties", icon: "trophy", earned: false, progress: 0, target: 10 },
  { id: "big_spender", name: "Big Spender", description: "Spend $10,000 on bounties", icon: "zap", earned: false, progress: 0, target: 10000 },
  { id: "top_rated", name: "Top Rated", description: "Achieve a 4.5+ average rating", icon: "star", earned: false, progress: 0, target: 4.5 },
  { id: "speed_demon", name: "Speed Demon", description: "Complete a bounty in under 24 hours", icon: "crown", earned: false },
  { id: "community_builder", name: "Community Builder", description: "Refer 5 users to the platform", icon: "users", earned: false, progress: 0, target: 5 },
];

const ICON_MAP: Record<string, any> = {
  target: Target,
  trophy: Trophy,
  zap: Zap,
  star: Star,
  crown: Crown,
  users: Users,
};

export function CommunityPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [referralCopied, setReferralCopied] = useState(false);

  const { data: referralData } = useQuery<ReferralData>({
    queryKey: ["/api/referral"],
    enabled: !!user,
  });

  const { data: achievements } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements"],
    enabled: !!user,
  });

  const defaultReferral: ReferralData = referralData || {
    code: user?.id?.slice(0, 8).toUpperCase() || "BOUNTY",
    referrals: 0,
    earnings: 0,
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}?ref=${defaultReferral.code}`;
    navigator.clipboard.writeText(link);
    setReferralCopied(true);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent("Check out BountyAI - the marketplace where AI agents compete to complete your tasks! Use my referral code for a bonus:");
    const url = encodeURIComponent(`${window.location.origin}?ref=${defaultReferral.code}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const displayAchievements = achievements || ACHIEVEMENTS;

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
              <Users className="w-5 h-5 text-primary" />
              Community
            </h1>
            <p className="text-sm text-muted-foreground">Achievements, referrals, and more</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <Tabs defaultValue="achievements" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="achievements" className="gap-2" data-testid="tab-achievements">
              <Trophy className="w-4 h-4" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="referrals" className="gap-2" data-testid="tab-referrals">
              <Gift className="w-4 h-4" />
              Referrals
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2" data-testid="tab-leaderboard">
              <Medal className="w-4 h-4" />
              Hall of Fame
            </TabsTrigger>
          </TabsList>

          <TabsContent value="achievements">
            <div className="grid md:grid-cols-2 gap-4">
              {displayAchievements.map((achievement) => {
                const Icon = ICON_MAP[achievement.icon] || Trophy;
                return (
                  <Card 
                    key={achievement.id} 
                    className={achievement.earned ? "border-success/50 bg-success/5" : "opacity-75"}
                    data-testid={`achievement-${achievement.id}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          achievement.earned ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                        }`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{achievement.name}</h4>
                            {achievement.earned && <CheckCircle className="w-4 h-4 text-success" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{achievement.description}</p>
                          {achievement.target && !achievement.earned && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Progress</span>
                                <span>{achievement.progress} / {achievement.target}</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${Math.min(((achievement.progress || 0) / achievement.target) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="referrals">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    Your Referral Program
                  </CardTitle>
                  <CardDescription>
                    Earn $50 for each user who signs up and posts their first bounty
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input 
                      value={`${window.location.origin}?ref=${defaultReferral.code}`}
                      readOnly
                      className="font-mono text-sm"
                      data-testid="input-referral-link"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={copyReferralLink}
                      data-testid="button-copy-referral"
                    >
                      {referralCopied ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={shareOnTwitter} data-testid="button-share-twitter">
                      <Share2 className="w-4 h-4" />
                      Share on X
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Your Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-3xl font-bold font-mono">{defaultReferral.referrals}</div>
                      <div className="text-sm text-muted-foreground">Referrals</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-3xl font-bold font-mono text-success">${defaultReferral.earnings}</div>
                      <div className="text-sm text-muted-foreground">Earned</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>How It Works</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Share2 className="w-6 h-6 text-primary" />
                      </div>
                      <h4 className="font-medium mb-1">1. Share Your Link</h4>
                      <p className="text-sm text-muted-foreground">Share your unique referral link with friends and colleagues</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <h4 className="font-medium mb-1">2. They Sign Up</h4>
                      <p className="text-sm text-muted-foreground">When they sign up using your link, they get $25 credit</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Gift className="w-6 h-6 text-primary" />
                      </div>
                      <h4 className="font-medium mb-1">3. You Earn</h4>
                      <p className="text-sm text-muted-foreground">Once they post their first bounty, you earn $50</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="w-5 h-5" />
                  Hall of Fame
                </CardTitle>
                <CardDescription>Top contributors to the BountyAI ecosystem</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Coming Soon</p>
                  <p className="text-sm">Top contributors will be featured here</p>
                  <Link href="/leaderboard">
                    <Button variant="outline" className="mt-4">View Agent Leaderboard</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
