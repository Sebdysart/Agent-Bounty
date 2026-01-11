import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import {
  Target,
  Clock,
  DollarSign,
  Star,
  Zap,
  TrendingUp,
  Award,
  AlertCircle,
  X,
  Search,
  RefreshCw,
  GitCompareArrows,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Agent {
  id: number;
  name: string;
  description: string;
  capabilities: string[];
  developerId: string;
  avatarColor: string;
  completionRate: string;
  totalEarnings: string;
  totalBounties: number;
  avgRating: string;
}

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

interface MetricDefinition {
  name: string;
  formula: string;
  unit: string;
  scaleMin: number;
  scaleMax: number;
  clampBehavior: string;
  winCondition?: string;
}

interface MetricBaseline {
  bands: {
    successRate: { p0: number; p50: number; p100: number };
    avgCompletionSeconds: { p0: number; p50: number; p100: number };
    earningsUsd: { p0: number; p50: number; p100: number };
    reviewScore: { p0: number; p50: number; p100: number };
    completionCount: { p0: number; p50: number; p100: number };
    speedScore: { p0: number; p50: number; p100: number };
    consistencyScore: { p0: number; p50: number; p100: number };
  };
}

const CACHE_TTL_MS = 60000;

const DEFAULT_METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  successRate: {
    name: "Success Rate",
    formula: "completed_successfully / total_attempts",
    unit: "percentage (0-100%)",
    scaleMin: 0,
    scaleMax: 1,
    clampBehavior: "Hard clamp [0, 1]",
    winCondition: "Higher is better",
  },
  avgCompletionSeconds: {
    name: "Avg Completion Time",
    formula: "median(completion_times_seconds)",
    unit: "seconds",
    scaleMin: 0,
    scaleMax: Infinity,
    clampBehavior: "No upper clamp",
    winCondition: "Lower is better (faster)",
  },
  earningsUsd: {
    name: "Earnings (Gross)",
    formula: "sum(bounty_payouts_usd)",
    unit: "USD",
    scaleMin: 0,
    scaleMax: Infinity,
    clampBehavior: "No upper clamp",
    winCondition: "Higher is better",
  },
  reviewScore: {
    name: "Review Score (Weighted)",
    formula: "weighted_avg(ratings) where count >= 5",
    unit: "stars (0-5)",
    scaleMin: 0,
    scaleMax: 5,
    clampBehavior: "Hard clamp [0, 5], requires minimum 5 reviews",
    winCondition: "Higher is better",
  },
  completionCount: {
    name: "Completion Count",
    formula: "count(completed_bounties)",
    unit: "count",
    scaleMin: 0,
    scaleMax: Infinity,
    clampBehavior: "No upper clamp",
    winCondition: "Higher is better (volume)",
  },
  speedScore: {
    name: "Speed Score",
    formula: "100 * (1000s - time) / (1000s - 100s), clamped [0, 100]",
    unit: "score (0-100)",
    scaleMin: 0,
    scaleMax: 100,
    clampBehavior: "Hard clamp [0, 100]",
    winCondition: "Higher is better",
  },
  consistencyScore: {
    name: "Consistency Score",
    formula: "100 - (100 * coefficient_of_variation), clamped [0, 100]",
    unit: "score (0-100)",
    scaleMin: 0,
    scaleMax: 100,
    clampBehavior: "Hard clamp [0, 100]",
    winCondition: "Higher is better",
  },
};

const DEFAULT_BASELINE: MetricBaseline = {
  bands: {
    successRate: { p0: 0.5, p50: 0.75, p100: 0.95 },
    avgCompletionSeconds: { p0: 1000, p50: 400, p100: 100 },
    earningsUsd: { p0: 10000, p50: 75000, p100: 200000 },
    reviewScore: { p0: 2.5, p50: 4.0, p100: 5.0 },
    completionCount: { p0: 50, p50: 200, p100: 500 },
    speedScore: { p0: 0, p50: 50, p100: 100 },
    consistencyScore: { p0: 0, p50: 70, p100: 100 },
  },
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}m ${secs}s`;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const calculateSpeedScore = (seconds: number): number => {
  const maxSeconds = 1000;
  const minSeconds = 100;
  const normalized = Math.max(
    0,
    Math.min(1, (maxSeconds - seconds) / (maxSeconds - minSeconds))
  );
  return Math.round(normalized * 100);
};

const calculateConsistencyScore = (timeSeries: number[]): number => {
  if (timeSeries.length === 0) return 0;
  const mean = timeSeries.reduce((a, b) => a + b, 0) / timeSeries.length;
  const variance =
    timeSeries.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    timeSeries.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? stdDev / mean : 0;
  return Math.max(0, Math.min(100, Math.round(100 - cv * 100)));
};

const MetricInfoDrawer: React.FC<{
  metricKey: string | null;
  definitions: Record<string, MetricDefinition>;
  onClose: () => void;
}> = ({ metricKey, definitions, onClose }) => {
  if (!metricKey) return null;

  const def = definitions[metricKey];
  if (!def) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-background/95 backdrop-blur-xl border border-violet-500/30 rounded-lg p-6 max-w-md w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              {def.name}
            </h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">
                Formula:
              </span>
              <code className="block mt-1 p-2 bg-violet-500/10 border border-violet-500/20 rounded text-xs text-violet-200">
                {def.formula}
              </code>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Unit:</span>
              <span className="ml-2">{def.unit}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Scale:</span>
              <span className="ml-2">
                [{def.scaleMin},{" "}
                {def.scaleMax === Infinity ? "Infinity" : def.scaleMax}]
              </span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">
                Clamp Behavior:
              </span>
              <p className="mt-1 text-xs text-muted-foreground">
                {def.clampBehavior}
              </p>
            </div>
            {def.winCondition && (
              <div>
                <span className="font-medium text-muted-foreground">
                  Win Condition:
                </span>
                <span className="ml-2 text-cyan-400">{def.winCondition}</span>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  isBest?: boolean;
  isTied?: boolean;
  color: string;
  metricKey?: string;
  onInfoClick?: (key: string) => void;
}> = ({ icon, label, value, isBest, isTied, color, metricKey, onInfoClick }) => {
  return (
    <div className="relative p-4 rounded-lg bg-background/40 backdrop-blur-sm border border-border/50 hover:border-violet-500/30 transition-all">
      {isBest && (
        <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0">
          <Award className="w-3 h-3 mr-1" />
          {isTied ? "Tied" : "Best"}
        </Badge>
      )}
      <div className={cn("flex items-center gap-2 mb-2", color)}>
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
        {metricKey && onInfoClick && (
          <button
            onClick={() => onInfoClick(metricKey)}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Learn more about ${label}`}
            data-testid={`info-${metricKey}`}
          >
            <AlertCircle className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
};

const AgentSelector: React.FC<{
  agents: Agent[];
  selectedAgents: Agent[];
  onSelect: (agent: Agent) => void;
  onRemove: (agentId: number) => void;
  maxAgents: number;
  isLoading?: boolean;
}> = ({ agents, selectedAgents, onSelect, onRemove, maxAgents, isLoading }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const availableAgents = agents.filter(
    (agent) => !selectedAgents.find((s) => s.id === agent.id)
  );

  return (
    <div className="flex flex-wrap gap-2">
      {selectedAgents.map((agent) => (
        <motion.div
          key={agent.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/30"
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: agent.avatarColor }}
          >
            {agent.name.charAt(0)}
          </div>
          <span className="text-sm font-medium">{agent.name}</span>
          <button
            onClick={() => onRemove(agent.id)}
            className="ml-1 hover:text-destructive transition-colors"
            aria-label={`Remove ${agent.name}`}
            data-testid={`remove-agent-${agent.id}`}
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      ))}

      {selectedAgents.length < maxAgents && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="border-dashed border-2 hover:border-violet-500/50 hover:bg-violet-500/5"
              disabled={isLoading}
              data-testid="add-agent-button"
            >
              <Search className="w-4 h-4 mr-2" />
              Add Agent
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search agents..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>No agents found.</CommandEmpty>
                <CommandGroup>
                  {availableAgents.map((agent) => (
                    <CommandItem
                      key={agent.id}
                      onSelect={() => {
                        onSelect(agent);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="flex items-center gap-3 p-3"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: agent.avatarColor }}
                      >
                        {agent.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {agent.description}
                        </div>
                      </div>
                      {agent.capabilities[0] && (
                        <Badge variant="secondary" className="text-xs">
                          {agent.capabilities[0]}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

interface AgentComparisonToolProps {
  agents: Agent[];
  initialAgentIds?: number[];
  maxAgents?: number;
  defaultRange?: "7d" | "30d" | "90d";
  isLoading?: boolean;
  onFetchStats?: (
    agentId: number,
    range: string
  ) => Promise<AgentStats | null>;
}

export function AgentComparisonTool({
  agents,
  initialAgentIds = [],
  maxAgents = 3,
  defaultRange = "30d",
  isLoading = false,
  onFetchStats,
}: AgentComparisonToolProps) {
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [range, setRange] = useState<"7d" | "30d" | "90d">(defaultRange);
  const [performanceOverlay, setPerformanceOverlay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statsCache, setStatsCache] = useState<
    Map<string, { data: AgentStats; timestamp: number }>
  >(new Map());
  const [primaryMetric, setPrimaryMetric] = useState<
    | "successRate"
    | "avgCompletionSeconds"
    | "earningsUsd"
    | "reviewScore"
    | "completionCount"
  >("successRate");
  const [normalizationMode, setNormalizationMode] = useState<"global" | "local">(
    "global"
  );
  const [showMetricInfo, setShowMetricInfo] = useState<string | null>(null);
  const [baseline] = useState<MetricBaseline>(DEFAULT_BASELINE);
  const [metricDefinitions] = useState<Record<string, MetricDefinition>>(
    DEFAULT_METRIC_DEFINITIONS
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (initialAgentIds.length > 0 && agents.length > 0) {
      const selected = agents
        .filter((a) => initialAgentIds.includes(a.id))
        .slice(0, maxAgents);
      setSelectedAgents(selected);
    }
  }, [initialAgentIds, agents, maxAgents]);

  useEffect(() => {
    if (selectedAgents.length === 0 || !onFetchStats) return;

    const fetchStats = async () => {
      const now = Date.now();
      const newCache = new Map(statsCache);
      let needsUpdate = false;

      for (const agent of selectedAgents) {
        const cacheKey = `${agent.id}-${range}`;
        const cached = newCache.get(cacheKey);

        const isStale = !cached || now - cached.timestamp > CACHE_TTL_MS;

        if (isStale) {
          needsUpdate = true;
          if (!cached) {
            setLoading(true);
          }

          try {
            const stats = await onFetchStats(agent.id, range);
            if (stats) {
              newCache.set(cacheKey, { data: stats, timestamp: now });
            }
          } catch (err) {
            console.error(`Failed to fetch stats for ${agent.id}:`, err);
          }
        }
      }

      if (needsUpdate) {
        setStatsCache(newCache);
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedAgents, range, onFetchStats]);

  const handleSelectAgent = (agent: Agent) => {
    if (selectedAgents.length < maxAgents) {
      setSelectedAgents([...selectedAgents, agent]);
    }
  };

  const handleRemoveAgent = (agentId: number) => {
    setSelectedAgents(selectedAgents.filter((a) => a.id !== agentId));
  };

  const handleManualRefresh = async () => {
    if (isRefreshing || selectedAgents.length === 0 || !onFetchStats) return;

    setIsRefreshing(true);
    setStatsCache(new Map());

    const now = Date.now();
    const newCache = new Map<string, { data: AgentStats; timestamp: number }>();

    for (const agent of selectedAgents) {
      try {
        const stats = await onFetchStats(agent.id, range);
        if (stats) {
          newCache.set(`${agent.id}-${range}`, { data: stats, timestamp: now });
        }
      } catch (err) {
        console.error(`Failed to refresh ${agent.id}:`, err);
      }
    }

    setStatsCache(newCache);
    setIsRefreshing(false);
  };

  const agentColors = ["#8b5cf6", "#ec4899", "#06b6d4"];

  const currentStats = useMemo(() => {
    return selectedAgents
      .map((agent) => {
        const cacheKey = `${agent.id}-${range}`;
        const entry = statsCache.get(cacheKey);
        return entry?.data;
      })
      .filter(Boolean) as AgentStats[];
  }, [selectedAgents, range, statsCache]);

  const normalizeToGlobal = (
    value: number,
    key: keyof typeof baseline.bands
  ): number => {
    const bands = baseline.bands[key];
    const { p0, p100 } = bands;
    const normalized = ((value - p0) / (p100 - p0)) * 100;
    return Math.min(100, Math.max(0, normalized));
  };

  const normalizeToLocal = (value: number, values: number[]): number => {
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max === min) return 50;
    return ((value - min) / (max - min)) * 100;
  };

  const radarData = useMemo(() => {
    if (currentStats.length === 0) return [];

    const metrics = [
      "Success Rate",
      "Speed",
      "Earnings",
      "Reviews",
      "Completions",
      "Consistency",
    ];

    return metrics.map((metric) => {
      const dataPoint: Record<string, string | number> = { metric };

      currentStats.forEach((stats, idx) => {
        const agent = selectedAgents[idx];
        let value = 0;

        switch (metric) {
          case "Success Rate":
            if (normalizationMode === "global") {
              value = normalizeToGlobal(stats.successRate, "successRate");
            } else {
              value = normalizeToLocal(
                stats.successRate,
                currentStats.map((s) => s.successRate)
              );
            }
            break;
          case "Speed":
            const speedScore = calculateSpeedScore(stats.avgCompletionSeconds);
            if (normalizationMode === "global") {
              value = normalizeToGlobal(speedScore, "speedScore");
            } else {
              value = normalizeToLocal(
                speedScore,
                currentStats.map((s) =>
                  calculateSpeedScore(s.avgCompletionSeconds)
                )
              );
            }
            break;
          case "Earnings":
            if (normalizationMode === "global") {
              value = normalizeToGlobal(stats.earningsUsd, "earningsUsd");
            } else {
              value = normalizeToLocal(
                stats.earningsUsd,
                currentStats.map((s) => s.earningsUsd)
              );
            }
            break;
          case "Reviews":
            if (normalizationMode === "global") {
              value = normalizeToGlobal(stats.reviewScore, "reviewScore");
            } else {
              value = normalizeToLocal(
                stats.reviewScore,
                currentStats.map((s) => s.reviewScore)
              );
            }
            break;
          case "Completions":
            if (normalizationMode === "global") {
              value = normalizeToGlobal(stats.completionCount, "completionCount");
            } else {
              value = normalizeToLocal(
                stats.completionCount,
                currentStats.map((s) => s.completionCount)
              );
            }
            break;
          case "Consistency":
            const consistencyScore = calculateConsistencyScore(
              stats.timeSeries.successRate
            );
            if (normalizationMode === "global") {
              value = normalizeToGlobal(consistencyScore, "consistencyScore");
            } else {
              value = normalizeToLocal(
                consistencyScore,
                currentStats.map((s) =>
                  calculateConsistencyScore(s.timeSeries.successRate)
                )
              );
            }
            break;
        }

        dataPoint[agent.name] = Math.min(100, Math.max(0, value));
      });

      return dataPoint;
    });
  }, [currentStats, selectedAgents, normalizationMode, baseline]);

  const trendData = useMemo(() => {
    if (currentStats.length === 0) return [];

    const dates = currentStats[0]?.timeSeries?.dates || [];

    return dates.map((date, idx) => {
      const dataPoint: Record<string, string | number> = {
        date: new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      };

      currentStats.forEach((stats, agentIdx) => {
        const agent = selectedAgents[agentIdx];
        let value = 0;

        switch (primaryMetric) {
          case "successRate":
            value = (stats.timeSeries.successRate[idx] || 0) * 100;
            break;
          case "avgCompletionSeconds":
            value = stats.timeSeries.avgCompletionSeconds[idx] || 0;
            break;
          case "earningsUsd":
            value = stats.timeSeries.earningsUsd[idx] || 0;
            break;
          case "reviewScore":
            value = stats.timeSeries.reviewScore[idx] || 0;
            break;
          case "completionCount":
            value = stats.timeSeries.completionCount[idx] || 0;
            break;
        }

        dataPoint[agent.name] = value;
      });

      return dataPoint;
    });
  }, [currentStats, selectedAgents, primaryMetric]);

  const getBestPerformers = (
    metricKey: string
  ): { bestIds: number[]; isTied: boolean } => {
    if (currentStats.length < 2) return { bestIds: [], isTied: false };

    let values: { id: number; value: number }[] = [];

    currentStats.forEach((stats, idx) => {
      const agent = selectedAgents[idx];
      let value = 0;

      switch (metricKey) {
        case "successRate":
          value = stats.successRate;
          break;
        case "avgCompletionSeconds":
          value = -stats.avgCompletionSeconds;
          break;
        case "earningsUsd":
          value = stats.earningsUsd;
          break;
        case "reviewScore":
          value = stats.reviewScore;
          break;
        case "completionCount":
          value = stats.completionCount;
          break;
      }

      values.push({ id: agent.id, value });
    });

    const maxValue = Math.max(...values.map((v) => v.value));
    const bestIds = values.filter((v) => v.value === maxValue).map((v) => v.id);

    return { bestIds, isTied: bestIds.length > 1 };
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-violet-950/20 p-6">
        <MetricInfoDrawer
          metricKey={showMetricInfo}
          definitions={metricDefinitions}
          onClose={() => setShowMetricInfo(null)}
        />

        <div className="max-w-7xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
                <GitCompareArrows className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                  Agent Comparison
                </h1>
                <p className="text-sm text-muted-foreground">
                  Compare up to {maxAgents} agents side-by-side
                </p>
              </div>
            </div>

            <Card className="p-4 bg-background/40 backdrop-blur-sm border-border/50">
              <div className="flex flex-wrap items-center gap-4">
                <AgentSelector
                  agents={agents}
                  selectedAgents={selectedAgents}
                  onSelect={handleSelectAgent}
                  onRemove={handleRemoveAgent}
                  maxAgents={maxAgents}
                  isLoading={isLoading}
                />

                <div className="flex items-center gap-2 ml-auto">
                  <select
                    value={range}
                    onChange={(e) =>
                      setRange(e.target.value as "7d" | "30d" | "90d")
                    }
                    className="px-3 py-2 rounded-lg bg-background border border-border text-sm"
                    aria-label="Select time range"
                    data-testid="range-selector"
                  >
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                  </select>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleManualRefresh}
                    disabled={isRefreshing || selectedAgents.length === 0}
                    data-testid="refresh-button"
                  >
                    <RefreshCw
                      className={cn(
                        "w-4 h-4",
                        isRefreshing && "animate-spin"
                      )}
                    />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>

          {selectedAgents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="p-4 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 mb-4">
                <GitCompareArrows className="w-12 h-12 text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Agents Selected</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Select up to {maxAgents} agents to compare their performance
                metrics, success rates, and earnings.
              </p>
            </motion.div>
          ) : loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Label htmlFor="normalization" className="text-sm">
                    Normalization:
                  </Label>
                  <select
                    id="normalization"
                    value={normalizationMode}
                    onChange={(e) =>
                      setNormalizationMode(e.target.value as "global" | "local")
                    }
                    className="px-3 py-1 rounded-lg bg-background border border-border text-sm"
                    data-testid="normalization-selector"
                  >
                    <option value="global">Global Baseline</option>
                    <option value="local">Selected Agents</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <Switch
                    id="performance-overlay"
                    checked={performanceOverlay}
                    onCheckedChange={setPerformanceOverlay}
                    data-testid="performance-overlay-toggle"
                  />
                  <Label htmlFor="performance-overlay" className="text-sm">
                    Show Trend Analysis
                  </Label>
                </div>
              </div>

              {currentStats.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="p-6 mb-6 bg-background/40 backdrop-blur-sm border-border/50">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Target className="w-5 h-5 text-violet-400" />
                      Performance Radar
                    </h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis
                          dataKey="metric"
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 12,
                          }}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 100]}
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 10,
                          }}
                        />
                        {selectedAgents.map((agent, idx) => (
                          <Radar
                            key={agent.id}
                            name={agent.name}
                            dataKey={agent.name}
                            stroke={agentColors[idx]}
                            fill={agentColors[idx]}
                            fillOpacity={0.2}
                            strokeWidth={2}
                          />
                        ))}
                        <Legend />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Card>
                </motion.div>
              )}

              <AnimatePresence>
                {performanceOverlay && currentStats.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="p-6 mb-6 bg-background/40 backdrop-blur-sm border-border/50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Clock className="w-5 h-5 text-cyan-400" />
                          Trend Analysis
                        </h3>
                        <select
                          value={primaryMetric}
                          onChange={(e) => setPrimaryMetric(e.target.value as typeof primaryMetric)}
                          className="px-3 py-2 rounded-lg bg-background border border-border text-sm"
                          aria-label="Select metric for trend analysis"
                          data-testid="trend-metric-selector"
                        >
                          <option value="successRate">Success Rate</option>
                          <option value="avgCompletionSeconds">
                            Completion Time
                          </option>
                          <option value="earningsUsd">Earnings</option>
                          <option value="reviewScore">Review Score</option>
                          <option value="completionCount">
                            Completion Count
                          </option>
                        </select>
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={trendData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                          />
                          <XAxis
                            dataKey="date"
                            tick={{
                              fill: "hsl(var(--muted-foreground))",
                              fontSize: 12,
                            }}
                          />
                          <YAxis
                            tick={{
                              fill: "hsl(var(--muted-foreground))",
                              fontSize: 12,
                            }}
                          />
                          {selectedAgents.map((agent, idx) => (
                            <Line
                              key={agent.id}
                              type="monotone"
                              dataKey={agent.name}
                              stroke={agentColors[idx]}
                              strokeWidth={2}
                              dot={{ fill: agentColors[idx], r: 4 }}
                            />
                          ))}
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {selectedAgents.map((agent, idx) => {
                    const stats = currentStats[idx];
                    if (!stats) return null;

                    const consistencyScore = calculateConsistencyScore(
                      stats.timeSeries.successRate
                    );

                    const successRateBest = getBestPerformers("successRate");
                    const completionTimeBest = getBestPerformers(
                      "avgCompletionSeconds"
                    );
                    const earningsBest = getBestPerformers("earningsUsd");
                    const reviewBest = getBestPerformers("reviewScore");
                    const completionsBest = getBestPerformers("completionCount");

                    return (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: idx * 0.1 }}
                        data-testid={`agent-card-${agent.id}`}
                      >
                        <Card className="p-6 bg-background/40 backdrop-blur-sm border-border/50 hover:border-violet-500/50 transition-all">
                          <div className="flex items-center gap-3 mb-6">
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ring-2 ring-violet-500/30"
                              style={{ backgroundColor: agent.avatarColor }}
                            >
                              {agent.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">
                                {agent.name}
                              </h3>
                              <p className="text-sm text-muted-foreground truncate">
                                {agent.capabilities[0] || "AI Agent"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <StatCard
                              icon={<Target className="w-4 h-4" />}
                              label="Success Rate"
                              value={`${(stats.successRate * 100).toFixed(1)}%`}
                              isBest={successRateBest.bestIds.includes(agent.id)}
                              isTied={successRateBest.isTied}
                              color="text-violet-400"
                              metricKey="successRate"
                              onInfoClick={setShowMetricInfo}
                            />
                            <StatCard
                              icon={<Clock className="w-4 h-4" />}
                              label="Avg Completion"
                              value={formatTime(stats.avgCompletionSeconds)}
                              isBest={completionTimeBest.bestIds.includes(
                                agent.id
                              )}
                              isTied={completionTimeBest.isTied}
                              color="text-cyan-400"
                              metricKey="avgCompletionSeconds"
                              onInfoClick={setShowMetricInfo}
                            />
                            <StatCard
                              icon={<DollarSign className="w-4 h-4" />}
                              label="Earnings"
                              value={formatCurrency(stats.earningsUsd)}
                              isBest={earningsBest.bestIds.includes(agent.id)}
                              isTied={earningsBest.isTied}
                              color="text-fuchsia-400"
                              metricKey="earningsUsd"
                              onInfoClick={setShowMetricInfo}
                            />
                            <StatCard
                              icon={<Star className="w-4 h-4" />}
                              label="Review Score"
                              value={`${stats.reviewScore.toFixed(1)} / 5.0`}
                              isBest={reviewBest.bestIds.includes(agent.id)}
                              isTied={reviewBest.isTied}
                              color="text-yellow-400"
                              metricKey="reviewScore"
                              onInfoClick={setShowMetricInfo}
                            />
                            <StatCard
                              icon={<Zap className="w-4 h-4" />}
                              label="Completions"
                              value={stats.completionCount}
                              isBest={completionsBest.bestIds.includes(agent.id)}
                              isTied={completionsBest.isTied}
                              color="text-green-400"
                              metricKey="completionCount"
                              onInfoClick={setShowMetricInfo}
                            />
                            <StatCard
                              icon={<TrendingUp className="w-4 h-4" />}
                              label="Consistency"
                              value={`${consistencyScore}/100`}
                              color="text-orange-400"
                              metricKey="consistencyScore"
                              onInfoClick={setShowMetricInfo}
                            />
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default AgentComparisonTool;
