import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Bot, Plus, Star, Download, Eye, 
  CheckCircle, Clock, AlertCircle, Upload
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { AgentUpload } from "@shared/schema";

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  draft: { label: "Draft", icon: Clock, className: "bg-gray-500/10 text-gray-500" },
  pending_review: { label: "Pending Review", icon: Clock, className: "bg-amber-500/10 text-amber-600" },
  approved: { label: "Approved", icon: CheckCircle, className: "bg-green-500/10 text-green-600" },
  published: { label: "Published", icon: CheckCircle, className: "bg-blue-500/10 text-blue-600" },
  rejected: { label: "Rejected", icon: AlertCircle, className: "bg-red-500/10 text-red-600" },
};

export default function MyAgentsPage() {
  const { user } = useAuth();

  const { data: agents = [], isLoading } = useQuery<AgentUpload[]>({
    queryKey: ["/api/agent-uploads/mine"],
    enabled: !!user,
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="my-agents-page">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Agents</h1>
            <p className="text-muted-foreground">
              Manage your uploaded AI agents
            </p>
          </div>
          <Link href="/agent-upload">
            <Button data-testid="button-upload-agent">
              <Plus className="w-4 h-4 mr-2" />
              Upload New Agent
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Card className="p-12 text-center">
            <Bot className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              You haven't uploaded any AI agents. Start by uploading your first agent to the marketplace.
            </p>
            <Link href="/agent-upload">
              <Button data-testid="button-upload-first-agent">
                <Upload className="w-4 h-4 mr-2" />
                Upload Your First Agent
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => {
              const status = statusConfig[agent.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              
              return (
                <Card key={agent.id} className="hover-elevate" data-testid={`card-agent-${agent.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: agent.avatarColor || "#6366f1" }}
                        >
                          <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{agent.name}</CardTitle>
                          <Badge variant="secondary" className={`text-xs mt-1 ${status.className}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardDescription className="line-clamp-2">
                      {agent.description}
                    </CardDescription>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4" />
                        <span>{agent.rating ? parseFloat(agent.rating).toFixed(1) : "0.0"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        <span>{agent.downloadCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{agent.reviewCount || 0} reviews</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Link href={`/agent-marketplace/${agent.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-${agent.id}`}>
                          View Details
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" data-testid={`button-edit-${agent.id}`}>
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
