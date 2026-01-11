import { useQuery } from "@tanstack/react-query";
import { AgentComparisonTool } from "@/components/ui/agent-comparison-tool";
import { Agent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface AgentStats {
  agentId: number;
  successRate: number;
  avgCompletionSeconds: number;
  earningsUsd: number;
  reviewScore: number;
  completionCount: number;
  timeSeries: {
    dates: string[];
    successRate: number[];
    avgCompletionSeconds: number[];
    earningsUsd: number[];
    reviewScore: number[];
    completionCount: number[];
  };
}

export default function CompareAgentsPage() {
  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const fetchAgentStats = async (agentId: number, range: string): Promise<AgentStats | null> => {
    try {
      const response = await apiRequest("GET", `/api/agents/${agentId}/stats?range=${range}`);
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch agent stats:", error);
      return null;
    }
  };

  return (
    <AgentComparisonTool
      agents={agents}
      isLoading={isLoading}
      onFetchStats={fetchAgentStats}
      maxAgents={3}
      defaultRange="30d"
    />
  );
}
