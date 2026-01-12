import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Terminal,
  FileJson,
  Activity,
  Cpu,
  Timer,
  ArrowLeft
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { motion, AnimatePresence } from 'framer-motion';
import type { Agent, AgentExecution } from '@shared/schema';

const statusColors: Record<string, string> = {
  queued: 'bg-slate-500',
  initializing: 'bg-blue-500',
  running: 'bg-violet-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  timeout: 'bg-amber-500',
  cancelled: 'bg-slate-400',
};

const statusIcons: Record<string, JSX.Element> = {
  queued: <Clock className="w-4 h-4" />,
  initializing: <Activity className="w-4 h-4 animate-pulse" />,
  running: <Cpu className="w-4 h-4 animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
  failed: <XCircle className="w-4 h-4" />,
  timeout: <Timer className="w-4 h-4" />,
  cancelled: <Square className="w-4 h-4" />,
};

export default function ExecutionMonitor() {
  const params = useParams();
  const [, navigate] = useLocation();
  const agentId = params.agentId ? parseInt(params.agentId) : null;
  const [testInput, setTestInput] = useState('{\n  "task": "example task",\n  "data": {}\n}');
  const [activeTab, setActiveTab] = useState('logs');

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['/api/agents/mine'],
  });

  const { data: executions, refetch: refetchExecutions } = useQuery<AgentExecution[]>({
    queryKey: ['/api/executions/agent', agentId],
    enabled: !!agentId,
    refetchInterval: 3000,
  });

  const selectedAgent = agents?.find(a => a.id === agentId);
  const latestExecution = executions?.[0];
  const isRunning = latestExecution && ['queued', 'initializing', 'running'].includes(latestExecution.status);

  const testSandboxMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/sandbox/test');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/executions/agent', agentId] });
    },
  });

  const executeAgentMutation = useMutation({
    mutationFn: async (data: { agentId: number; input: string }) => {
      const res = await apiRequest('POST', '/api/executions', {
        submissionId: 0,
        agentId: data.agentId,
        bountyId: 0,
        input: data.input,
      });
      return res.json();
    },
    onSuccess: () => {
      refetchExecutions();
    },
  });

  const cancelExecutionMutation = useMutation({
    mutationFn: async (executionId: number) => {
      const res = await apiRequest('POST', `/api/executions/${executionId}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      refetchExecutions();
    },
  });

  const retryExecutionMutation = useMutation({
    mutationFn: async (executionId: number) => {
      const res = await apiRequest('POST', `/api/executions/${executionId}/retry`);
      return res.json();
    },
    onSuccess: () => {
      refetchExecutions();
    },
  });

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => refetchExecutions(), 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, refetchExecutions]);

  const handleExecute = () => {
    if (!agentId) return;
    executeAgentMutation.mutate({ agentId, input: testInput });
  };

  const formatTime = (ms: number | null | undefined) => {
    if (!ms) return '--';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '--';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/agent-upload')}
          data-testid="button-back-agents"
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Agents
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Execution Monitor
            </h1>
            <p className="text-muted-foreground mt-1">
              Test and monitor your AI agent executions in a secure sandbox
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => testSandboxMutation.mutate()}
              disabled={testSandboxMutation.isPending}
              data-testid="button-test-sandbox"
            >
              <Terminal className="w-4 h-4 mr-2" />
              Test Sandbox
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Your Agents</CardTitle>
              <CardDescription>Select an agent to test</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {agents?.map((agent) => (
                    <motion.div
                      key={agent.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        variant={agentId === agent.id ? 'secondary' : 'ghost'}
                        className="w-full justify-start gap-3 h-auto py-3"
                        onClick={() => navigate(`/execution-monitor/${agent.id}`)}
                        data-testid={`button-select-agent-${agent.id}`}
                      >
                        <div 
                          className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: '#8B5CF6' }}
                        >
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {agent.totalBounties || 0} bounties
                          </div>
                        </div>
                      </Button>
                    </motion.div>
                  ))}
                  {!agents?.length && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No agents found. Create an agent first.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="w-5 h-5 text-violet-400" />
                Test Console
              </CardTitle>
              <CardDescription>
                {selectedAgent 
                  ? `Testing: ${selectedAgent.name}`
                  : 'Select an agent to begin testing'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Test Input (JSON)</label>
                <Textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder='{"task": "analyze", "data": {}}'
                  className="font-mono text-sm h-32"
                  data-testid="textarea-test-input"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleExecute}
                  disabled={!agentId || isRunning || executeAgentMutation.isPending}
                  data-testid="button-execute-agent"
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  Execute
                </Button>
                {isRunning && (
                  <Button
                    variant="destructive"
                    onClick={() => latestExecution && cancelExecutionMutation.mutate(latestExecution.id)}
                    disabled={cancelExecutionMutation.isPending}
                    data-testid="button-cancel-execution"
                    className="gap-2"
                  >
                    <Square className="w-4 h-4" />
                    Cancel
                  </Button>
                )}
                {latestExecution && ['failed', 'cancelled', 'timeout'].includes(latestExecution.status) && (
                  <Button
                    variant="outline"
                    onClick={() => retryExecutionMutation.mutate(latestExecution.id)}
                    disabled={retryExecutionMutation.isPending}
                    data-testid="button-retry-execution"
                    className="gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retry
                  </Button>
                )}
              </div>

              {testSandboxMutation.data && (
                <Alert className="border-violet-500/50 bg-violet-500/10">
                  <Terminal className="w-4 h-4" />
                  <AlertDescription>
                    <div className="font-mono text-sm">
                      <div>Sandbox test: {testSandboxMutation.data.success ? '✓ Passed' : '✗ Failed'}</div>
                      <div>Execution time: {formatTime(testSandboxMutation.data.executionTimeMs)}</div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {latestExecution && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">Execution #{latestExecution.id}</CardTitle>
                    <Badge className={`${statusColors[latestExecution.status]} text-white gap-1`}>
                      {statusIcons[latestExecution.status]}
                      {latestExecution.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Timer className="w-4 h-4" />
                      {formatTime(latestExecution.executionTimeMs)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(latestExecution.queuedAt)}
                    </div>
                  </div>
                </div>
                {isRunning && (
                  <Progress 
                    value={latestExecution.status === 'queued' ? 10 : latestExecution.status === 'initializing' ? 30 : 60}
                    className="mt-4 h-2"
                  />
                )}
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="logs" data-testid="tab-logs">
                      <Terminal className="w-4 h-4 mr-2" />
                      Logs
                    </TabsTrigger>
                    <TabsTrigger value="output" data-testid="tab-output">
                      <FileJson className="w-4 h-4 mr-2" />
                      Output
                    </TabsTrigger>
                    <TabsTrigger value="metrics" data-testid="tab-metrics">
                      <Activity className="w-4 h-4 mr-2" />
                      Metrics
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="logs" className="mt-4">
                    <ScrollArea className="h-[300px] rounded-md border bg-black/50 p-4">
                      <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">
                        {latestExecution.logs || 'No logs available'}
                      </pre>
                      {latestExecution.errorMessage && (
                        <pre className="font-mono text-sm text-red-400 mt-4 whitespace-pre-wrap">
                          Error: {latestExecution.errorMessage}
                        </pre>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="output" className="mt-4">
                    <ScrollArea className="h-[300px] rounded-md border bg-slate-950 p-4">
                      <pre className="font-mono text-sm text-cyan-400 whitespace-pre-wrap">
                        {latestExecution.output 
                          ? JSON.stringify(JSON.parse(latestExecution.output), null, 2)
                          : 'No output available'
                        }
                      </pre>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="metrics" className="mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold text-violet-400">
                            {formatTime(latestExecution.executionTimeMs)}
                          </div>
                          <p className="text-xs text-muted-foreground">Execution Time</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold text-fuchsia-400">
                            {latestExecution.timeoutMs ? `${latestExecution.timeoutMs / 1000}s` : '30s'}
                          </div>
                          <p className="text-xs text-muted-foreground">Timeout Limit</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold text-cyan-400">
                            {latestExecution.retryCount || 0}
                          </div>
                          <p className="text-xs text-muted-foreground">Retry Count</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold text-green-400">
                            128MB
                          </div>
                          <p className="text-xs text-muted-foreground">Memory Limit</p>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {executions && executions.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {executions.slice(1).map((exec) => (
                    <div 
                      key={exec.id}
                      className="flex items-center justify-between p-3 rounded-md border bg-card/50 hover-elevate"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className={`${statusColors[exec.status]} text-white`}>
                          {exec.status}
                        </Badge>
                        <span className="text-sm font-mono">#{exec.id}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatTime(exec.executionTimeMs)}</span>
                        <span>{formatDate(exec.queuedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
