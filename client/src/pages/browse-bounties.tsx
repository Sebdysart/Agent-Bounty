import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BountyCard, BountyCardSkeleton } from "@/components/bounty-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Filter, Target, DollarSign, Clock, TrendingUp, X } from "lucide-react";
import type { Bounty } from "@shared/schema";

interface BountyWithCount extends Bounty {
  submissionCount: number;
}

const categories = [
  "all",
  "data-analysis",
  "content-generation",
  "research",
  "automation",
  "customer-service",
  "coding",
  "marketing",
  "design",
  "other"
];

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "under_review", label: "Under Review" },
];

export function BrowseBountiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const { data: bounties, isLoading } = useQuery<BountyWithCount[]>({
    queryKey: ["/api/bounties"],
  });

  const filteredBounties = bounties?.filter((bounty) => {
    const matchesSearch = 
      bounty.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bounty.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || bounty.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || bounty.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  }).sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
      case "oldest":
        return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
      case "reward-high":
        return Number(b.reward) - Number(a.reward);
      case "reward-low":
        return Number(a.reward) - Number(b.reward);
      case "deadline":
        return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime();
      default:
        return 0;
    }
  });

  const stats = {
    total: bounties?.length || 0,
    open: bounties?.filter(b => b.status === "open").length || 0,
    totalReward: bounties?.reduce((sum, b) => sum + Number(b.reward), 0) || 0,
    avgReward: bounties?.length ? (bounties.reduce((sum, b) => sum + Number(b.reward), 0) / bounties.length) : 0,
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setSortBy("newest");
  };

  const hasActiveFilters = searchQuery || categoryFilter !== "all" || statusFilter !== "all";

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Browse Bounties</h1>
              <p className="text-muted-foreground mt-1">
                Discover opportunities and compete for rewards
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="card-premium">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total Bounties</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="card-premium">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.open}</p>
                    <p className="text-xs text-muted-foreground">Open Now</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="card-premium">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10">
                    <DollarSign className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">${stats.totalReward.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Rewards</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="card-premium">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <Clock className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">${stats.avgReward.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Avg Reward</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search bounties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-bounties"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[180px]" data-testid="select-category">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat === "all" ? "All Categories" : cat.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px]" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[150px]" data-testid="select-sort">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="reward-high">Highest Reward</SelectItem>
                  <SelectItem value="reward-low">Lowest Reward</SelectItem>
                  <SelectItem value="deadline">Deadline</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Search: {searchQuery}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
              </Badge>
            )}
            {categoryFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                {categoryFilter.replace(/-/g, " ")}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setCategoryFilter("all")} />
              </Badge>
            )}
            {statusFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                {statusFilter.replace(/_/g, " ")}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter("all")} />
              </Badge>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredBounties?.length || 0} bounties found
            </p>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <BountyCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredBounties && filteredBounties.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredBounties.map((bounty) => (
                <BountyCard key={bounty.id} bounty={bounty} />
              ))}
            </div>
          ) : (
            <Card className="card-premium">
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No bounties found</h3>
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters 
                    ? "Try adjusting your filters to see more results"
                    : "No bounties have been posted yet"}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default BrowseBountiesPage;
