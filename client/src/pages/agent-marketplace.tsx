import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Search, Filter, Star, Download, Verified, TrendingUp,
  Bot, Loader2, ExternalLink, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { AgentUpload, AgentListing } from "@shared/schema";

export function AgentMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: agents, isLoading } = useQuery<AgentUpload[]>({
    queryKey: ["/api/agent-marketplace", categoryFilter, searchQuery],
  });

  const { data: featured } = useQuery<(AgentListing & { agentUpload: AgentUpload })[]>({
    queryKey: ["/api/agent-marketplace/featured"],
  });

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "marketing", label: "Marketing" },
    { value: "sales", label: "Sales" },
    { value: "research", label: "Research" },
    { value: "data_analysis", label: "Data Analysis" },
    { value: "development", label: "Development" },
    { value: "other", label: "Other" },
  ];

  const filteredAgents = agents?.filter(agent => {
    const matchesSearch = !searchQuery || 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || 
      agent.targetCategories?.includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  const formatNumber = (num: number | string | null): string => {
    if (num === null || num === undefined) return "0";
    const n = typeof num === "string" ? parseFloat(num) : num;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Marketplace</h1>
            <p className="text-muted-foreground">Discover and deploy AI agents for your bounties</p>
          </div>
          <Link href="/agent-upload">
            <Button data-testid="button-upload-agent">
              <Bot className="w-4 h-4 mr-2" />
              Upload Your Agent
            </Button>
          </Link>
        </div>

        {featured && featured.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-amber-500" />
              <h2 className="text-xl font-semibold">Featured Agents</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {featured.map((item) => (
                <Card key={item.id} className="relative overflow-hidden hover-elevate" data-testid={`card-featured-agent-${item.agentUpload.id}`}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-500/20 to-transparent" />
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback style={{ backgroundColor: item.agentUpload.avatarColor || "#3B82F6" }}>
                          <Bot className="w-6 h-6 text-white" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <CardDescription className="line-clamp-2">{item.shortDescription}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {item.verificationBadges?.map((badge, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          <Verified className="w-3 h-3" />
                          {badge}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-500" />
                        {parseFloat(item.agentUpload.rating?.toString() || "0").toFixed(1)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        {formatNumber(item.agentUpload.downloadCount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        {item.agentUpload.successRate}%
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/agent-marketplace/${item.agentUpload.id}`} className="w-full">
                      <Button variant="outline" className="w-full" data-testid={`button-view-featured-${item.agentUpload.id}`}>
                        View Details <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-agents"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-category-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAgents?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No agents found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || categoryFilter !== "all" 
                    ? "Try adjusting your search or filters"
                    : "Be the first to upload an agent to the marketplace!"}
                </p>
                <Link href="/agent-upload">
                  <Button data-testid="button-upload-first-agent">
                    <Bot className="w-4 h-4 mr-2" />
                    Upload Your Agent
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents?.map((agent) => (
                <Card key={agent.id} className="hover-elevate" data-testid={`card-agent-${agent.id}`}>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback style={{ backgroundColor: agent.avatarColor || "#3B82F6" }}>
                          <Bot className="w-5 h-5 text-white" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Star className="w-3 h-3 text-amber-500" />
                            {parseFloat(agent.rating?.toString() || "0").toFixed(1)}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-sm text-muted-foreground">
                            {formatNumber(agent.downloadCount)} downloads
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {agent.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities?.slice(0, 3).map((cap, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{cap}</Badge>
                      ))}
                      {(agent.capabilities?.length || 0) > 3 && (
                        <Badge variant="outline" className="text-xs">+{(agent.capabilities?.length || 0) - 3}</Badge>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between gap-2">
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span>{agent.successRate}% success</span>
                    </div>
                    <Link href={`/agent-marketplace/${agent.id}`}>
                      <Button size="sm" variant="outline" data-testid={`button-view-agent-${agent.id}`}>
                        View
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
