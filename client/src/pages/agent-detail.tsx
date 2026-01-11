import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  ArrowLeft, Star, Download, Verified, TrendingUp, Bot, Loader2, 
  CheckCircle, Code, Zap, Shield, Users, Clock, MessageSquare,
  ThumbsUp, Award, ExternalLink, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { AgentUpload, AgentReview, AgentTool } from "@shared/schema";

interface AgentDetailData extends AgentUpload {
  listing?: {
    title: string;
    shortDescription: string;
    fullDescription: string;
    screenshots: string[];
    demoUrl: string | null;
    documentationUrl: string | null;
    pricingModel: string;
    price: string | null;
    verificationBadges: string[];
  };
}

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const { data: agent, isLoading } = useQuery<AgentDetailData>({
    queryKey: ["/api/agent-uploads", id],
  });

  const { data: reviews } = useQuery<AgentReview[]>({
    queryKey: ["/api/agent-uploads", id, "reviews"],
  });

  const { data: tools } = useQuery<AgentTool[]>({
    queryKey: ["/api/agent-uploads", id, "tools"],
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      return apiRequest(`/api/agent-uploads/${id}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          rating: data.rating,
          comment: data.comment,
          title: `${data.rating} star review`,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-uploads", id, "reviews"] });
      toast({ title: "Review submitted", description: "Thank you for your feedback!" });
      setReviewComment("");
      setReviewRating(5);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit review", variant: "destructive" });
    },
  });

  const formatNumber = (num: number | string | null): string => {
    if (num === null || num === undefined) return "0";
    const n = typeof num === "string" ? parseFloat(num) : num;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getRatingDistribution = () => {
    if (!reviews?.length) return [0, 0, 0, 0, 0];
    const dist = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      const rating = Math.min(5, Math.max(1, r.rating));
      dist[rating - 1]++;
    });
    return dist.reverse();
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Agent not found</h3>
              <p className="text-muted-foreground mb-4">
                This agent may have been removed or doesn't exist.
              </p>
              <Link href="/agent-marketplace">
                <Button data-testid="button-back-to-marketplace">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Marketplace
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const ratingDist = getRatingDistribution();
  const avgRating = parseFloat(agent.rating?.toString() || "0");

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        <Link href="/agent-marketplace">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback style={{ backgroundColor: agent.avatarColor || "#3B82F6" }}>
                      <Bot className="w-8 h-8 text-white" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-2xl">{agent.listing?.title || agent.name}</CardTitle>
                      {agent.status === "published" && (
                        <Badge className="bg-green-500/10 text-green-600">
                          <Verified className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-2">
                      {agent.listing?.shortDescription || agent.description}
                    </CardDescription>
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="font-medium">{avgRating.toFixed(1)}</span>
                        <span className="text-muted-foreground">({reviews?.length || 0} reviews)</span>
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Download className="w-4 h-4" />
                        {formatNumber(agent.downloadCount)} downloads
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        {agent.successRate}% success rate
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="capabilities" data-testid="tab-capabilities">Capabilities</TabsTrigger>
                <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">About this Agent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {agent.listing?.fullDescription || agent.description}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-primary">{agent.totalTests || 0}</div>
                        <div className="text-sm text-muted-foreground">Total Tests</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-green-600">{agent.passedTests || 0}</div>
                        <div className="text-sm text-muted-foreground">Passed Tests</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-blue-600">{agent.successRate || 0}%</div>
                        <div className="text-sm text-muted-foreground">Success Rate</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-amber-600">{avgRating.toFixed(1)}</div>
                        <div className="text-sm text-muted-foreground">Avg Rating</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {tools && tools.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Integrated Tools</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {tools.map((tool: any) => (
                          <Badge key={tool.id} variant="secondary" className="gap-1">
                            <Zap className="w-3 h-3" />
                            {tool.tool?.name || `Tool ${tool.toolId}`}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="capabilities" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Agent Capabilities</CardTitle>
                    <CardDescription>What this agent can do for you</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      {agent.capabilities?.map((cap, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                          <span>{cap}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Target Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {agent.targetCategories?.map((cat, i) => (
                        <Badge key={i} variant="outline">{cat}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Technical Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Runtime</span>
                      <Badge variant="secondary">{agent.runtime || "nodejs"}</Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Upload Type</span>
                      <Badge variant="secondary">{agent.uploadType}</Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Created</span>
                      <span>{formatDate(agent.createdAt)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Last Updated</span>
                      <span>{formatDate(agent.updatedAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Rating Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[5, 4, 3, 2, 1].map((stars, i) => (
                      <div key={stars} className="flex items-center gap-3">
                        <span className="w-8 text-sm text-muted-foreground">{stars} star</span>
                        <Progress 
                          value={reviews?.length ? (ratingDist[i] / reviews.length) * 100 : 0} 
                          className="flex-1 h-2"
                        />
                        <span className="w-8 text-sm text-muted-foreground text-right">{ratingDist[i]}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Write a Review</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Rating</Label>
                      <div className="flex gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            className="p-1 hover-elevate rounded"
                            data-testid={`button-star-${star}`}
                          >
                            <Star 
                              className={`w-6 h-6 ${star <= reviewRating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="review-comment">Your Review</Label>
                      <Textarea
                        id="review-comment"
                        placeholder="Share your experience with this agent..."
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        className="mt-2"
                        rows={4}
                        data-testid="textarea-review"
                      />
                    </div>
                    <Button 
                      onClick={() => submitReviewMutation.mutate({ rating: reviewRating, comment: reviewComment })}
                      disabled={submitReviewMutation.isPending || !reviewComment.trim()}
                      data-testid="button-submit-review"
                    >
                      {submitReviewMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <MessageSquare className="w-4 h-4 mr-2" />
                      )}
                      Submit Review
                    </Button>
                  </CardContent>
                </Card>

                {reviews && reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <Card key={review.id} data-testid={`card-review-${review.id}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback>
                                  <Users className="w-5 h-5" />
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">User</span>
                                  {review.isVerifiedPurchase && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Verified className="w-3 h-3 mr-1" />
                                      Verified
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star 
                                      key={star}
                                      className={`w-3 h-3 ${star <= review.rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                          {review.title && (
                            <h4 className="font-medium mt-3">{review.title}</h4>
                          )}
                          <p className="text-muted-foreground mt-2">{review.comment}</p>
                          <div className="flex items-center gap-4 mt-4">
                            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                              <ThumbsUp className="w-4 h-4" />
                              Helpful ({review.helpfulCount || 0})
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No reviews yet. Be the first to review this agent!</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Deploy This Agent</CardTitle>
                <CardDescription>
                  Add this agent to your bounties
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Pricing</span>
                  <span className="font-semibold text-lg">
                    {agent.listing?.pricingModel === "free" ? (
                      <Badge variant="secondary">Free</Badge>
                    ) : agent.listing?.price ? (
                      `$${agent.listing.price}`
                    ) : (
                      <Badge variant="secondary">Free</Badge>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-medium text-green-600">{agent.successRate || 0}%</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Response Time</span>
                  <span className="font-medium">~2 min</span>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button className="w-full" size="lg" data-testid="button-hire-agent">
                  <Play className="w-4 h-4 mr-2" />
                  Hire for Bounty
                </Button>
                {agent.listing?.demoUrl && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={agent.listing.demoUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Try Demo
                    </a>
                  </Button>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Verification Badges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(agent.listing?.verificationBadges || ["Tested", "Secure"]).map((badge, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Shield className="w-4 h-4 text-green-500" />
                      <span>{badge}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Developer Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      <Code className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">Agent Developer</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      Verified Creator
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
