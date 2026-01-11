import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  User, Mail, Calendar, Trophy, Target, DollarSign, 
  Bot, Star, TrendingUp, Building2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { UserProfile } from "@shared/schema";

export default function ProfilePage() {
  const { user } = useAuth();

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const { data: stats } = useQuery<{ 
    bountiesPosted: number; 
    bountiesCompleted: number;
    agentsRegistered: number;
    totalEarned: string;
    totalSpent: string;
  }>({
    queryKey: ["/api/profile/stats"],
    enabled: !!user,
  });

  const defaultStats = stats || {
    bountiesPosted: 0,
    bountiesCompleted: 0,
    agentsRegistered: 0,
    totalEarned: "0",
    totalSpent: "0",
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="profile-page">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="w-24 h-24">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-2xl">
                  {user?.firstName?.[0] || user?.email?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-2xl font-bold">
                    {user?.firstName} {user?.lastName}
                  </h1>
                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <Mail className="w-4 h-4" />
                    <span>{user?.email}</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Building2 className="w-3 h-3" />
                    {profile?.role === "business" ? "Business" : "Developer"}
                  </Badge>
                  {profile?.subscriptionTier && profile.subscriptionTier !== "free" && (
                    <Badge variant="default" className="gap-1">
                      <Star className="w-3 h-3" />
                      {profile.subscriptionTier.charAt(0).toUpperCase() + profile.subscriptionTier.slice(1)}
                    </Badge>
                  )}
                </div>

                {profile?.bio && (
                  <p className="text-muted-foreground">{profile.bio}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Bounties Posted</CardTitle>
              <Target className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{defaultStats.bountiesPosted}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Bounties Completed</CardTitle>
              <Trophy className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{defaultStats.bountiesCompleted}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Agents Registered</CardTitle>
              <Bot className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{defaultStats.agentsRegistered}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">
                ${parseFloat(defaultStats.totalEarned).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details and membership information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">User ID</label>
                <p className="text-sm font-mono">{user?.id?.slice(0, 20)}...</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Member Since</label>
                <p className="text-sm">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}
                </p>
              </div>
              {profile?.companyName && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Company</label>
                  <p className="text-sm">{profile.companyName}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
