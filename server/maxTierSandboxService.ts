import crypto from 'crypto';
import { db } from './db';
import { 
  sandboxConfigurations, sandboxSessions, toolProxyRules, securityViolations,
  blockchainProofs, resourceQuotas, anomalyDetections, agentExecutions,
  SandboxConfiguration, SandboxSession, ToolProxyRule, SecurityViolation,
  BlockchainProof, ResourceQuota, AnomalyDetection, InsertSandboxSession
} from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { SandboxRunner, SandboxConfig, SandboxResult } from './sandboxRunner';

export interface MaxTierConfig {
  tier: 'basic' | 'standard' | 'professional' | 'enterprise' | 'max';
  runtime: 'quickjs' | 'wasmtime' | 'docker' | 'kubernetes' | 'firecracker';
  securityLevel: 'minimal' | 'standard' | 'strict' | 'paranoid';
  cpuCores: number;
  memoryMb: number;
  timeoutMs: number;
  allowFetch: boolean;
  allowFs: boolean;
  allowNetworking: boolean;
  allowedDomains?: string[];
  blockedPatterns?: string[];
}

export interface ExecutionMetrics {
  cpuUsagePercent: number;
  memoryUsedMb: number;
  peakMemoryMb: number;
  networkBytesIn: number;
  networkBytesOut: number;
  apiCalls: number;
  durationMs: number;
}

export interface SecurityScanResult {
  passed: boolean;
  violations: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    line?: number;
  }>;
  score: number;
}

const TIER_LIMITS: Record<string, Partial<MaxTierConfig>> = {
  basic: { cpuCores: 1, memoryMb: 256, timeoutMs: 30000 },
  standard: { cpuCores: 1, memoryMb: 512, timeoutMs: 60000 },
  professional: { cpuCores: 2, memoryMb: 1024, timeoutMs: 180000 },
  enterprise: { cpuCores: 4, memoryMb: 4096, timeoutMs: 300000 },
  max: { cpuCores: 8, memoryMb: 8192, timeoutMs: 600000 },
};

const BLOCKED_PATTERNS = [
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /new\s+Function/gi,
  /process\.exit/gi,
  /child_process/gi,
  /require\s*\(\s*['"]fs['"]\s*\)/gi,
  /require\s*\(\s*['"]net['"]\s*\)/gi,
  /require\s*\(\s*['"]http['"]\s*\)/gi,
  /__proto__/gi,
  /constructor\.constructor/gi,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions|prompts)/gi,
  /disregard\s+(previous|all|prior)\s+(instructions|context)/gi,
  /forget\s+(everything|all|previous)/gi,
  /you\s+are\s+now\s+(a|an)/gi,
  /act\s+as\s+(if|though)/gi,
  /pretend\s+(you\s+are|to\s+be)/gi,
  /jailbreak/gi,
  /bypass\s+(safety|security|restrictions)/gi,
  /reveal\s+(your|the)\s+(instructions|prompt|system)/gi,
  /what\s+is\s+your\s+(system|initial)\s+prompt/gi,
];

class MaxTierSandboxService {
  private sandboxRunner: SandboxRunner;

  constructor() {
    this.sandboxRunner = new SandboxRunner();
  }

  async getDefaultConfiguration(): Promise<SandboxConfiguration | null> {
    const [config] = await db.select()
      .from(sandboxConfigurations)
      .where(and(eq(sandboxConfigurations.isDefault, true), eq(sandboxConfigurations.isActive, true)));
    return config || null;
  }

  async getConfiguration(configId: number): Promise<SandboxConfiguration | null> {
    const [config] = await db.select()
      .from(sandboxConfigurations)
      .where(eq(sandboxConfigurations.id, configId));
    return config || null;
  }

  async createConfiguration(data: Partial<SandboxConfiguration>): Promise<SandboxConfiguration> {
    const tierLimits = TIER_LIMITS[data.tier || 'standard'] || TIER_LIMITS.standard;
    const [config] = await db.insert(sandboxConfigurations).values({
      name: data.name || 'Default Configuration',
      tier: data.tier || 'standard',
      runtime: data.runtime || 'quickjs',
      securityLevel: data.securityLevel || 'standard',
      cpuCores: Math.min(data.cpuCores || tierLimits.cpuCores!, tierLimits.cpuCores!),
      memoryMb: Math.min(data.memoryMb || tierLimits.memoryMb!, tierLimits.memoryMb!),
      timeoutMs: Math.min(data.timeoutMs || tierLimits.timeoutMs!, tierLimits.timeoutMs!),
      maxCodeSizeKb: data.maxCodeSizeKb || 512,
      maxInputSizeKb: data.maxInputSizeKb || 1024,
      allowFetch: data.allowFetch || false,
      allowFs: data.allowFs || false,
      allowNetworking: data.allowNetworking || false,
      allowedDomains: data.allowedDomains || [],
      blockedPatterns: data.blockedPatterns || [],
      isDefault: data.isDefault || false,
      isActive: true,
    } as any).returning();
    return config;
  }

  async getAllConfigurations(): Promise<SandboxConfiguration[]> {
    return db.select()
      .from(sandboxConfigurations)
      .where(eq(sandboxConfigurations.isActive, true))
      .orderBy(sandboxConfigurations.name);
  }

  async scanCodeSecurity(code: string): Promise<SecurityScanResult> {
    const violations: SecurityScanResult['violations'] = [];
    let score = 100;
    
    for (const pattern of BLOCKED_PATTERNS) {
      const matches = code.match(pattern);
      if (matches) {
        violations.push({
          type: 'dangerous_code',
          severity: 'critical',
          description: `Blocked pattern detected: ${pattern.source}`,
        });
        score -= 25;
      }
    }

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      const matches = code.match(pattern);
      if (matches) {
        violations.push({
          type: 'prompt_injection',
          severity: 'high',
          description: `Potential prompt injection: ${matches[0]}`,
        });
        score -= 15;
      }
    }

    if (code.length > 100000) {
      violations.push({
        type: 'size_limit',
        severity: 'medium',
        description: 'Code exceeds recommended size limit (100KB)',
      });
      score -= 10;
    }

    const infiniteLoopPattern = /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/gi;
    if (infiniteLoopPattern.test(code)) {
      violations.push({
        type: 'infinite_loop',
        severity: 'high',
        description: 'Potential infinite loop detected',
      });
      score -= 20;
    }

    return {
      passed: violations.filter(v => v.severity === 'critical').length === 0,
      violations,
      score: Math.max(0, score),
    };
  }

  async executeWithMonitoring(
    code: string,
    input: any,
    agentId: number,
    executionId?: number,
    configId?: number
  ): Promise<{ result: SandboxResult; session: SandboxSession; metrics: ExecutionMetrics }> {
    const config = configId 
      ? await this.getConfiguration(configId)
      : await this.getDefaultConfiguration();
    
    const tierLimits = TIER_LIMITS[config?.tier || 'standard'];
    const sessionId = crypto.randomUUID();

    const [session] = await db.insert(sandboxSessions).values({
      sessionId,
      configId: config?.id,
      agentId,
      executionId,
      status: 'initializing',
      runtime: config?.runtime || 'quickjs',
      startedAt: new Date(),
    } as any).returning();

    await db.update(sandboxSessions)
      .set({ status: 'running' })
      .where(eq(sandboxSessions.id, session.id));

    const securityScan = await this.scanCodeSecurity(code);
    if (!securityScan.passed) {
      for (const violation of securityScan.violations.filter(v => v.severity === 'critical')) {
        await this.logSecurityViolation(sessionId, agentId, violation.type, violation.severity, violation.description);
      }

      await db.update(sandboxSessions)
        .set({ 
          status: 'failed',
          completedAt: new Date(),
          errors: JSON.stringify(securityScan.violations),
        })
        .where(eq(sandboxSessions.id, session.id));

      return {
        result: {
          success: false,
          output: null,
          logs: [],
          errors: securityScan.violations.map(v => `[${v.severity.toUpperCase()}] ${v.description}`),
          executionTimeMs: 0,
        },
        session,
        metrics: {
          cpuUsagePercent: 0,
          memoryUsedMb: 0,
          peakMemoryMb: 0,
          networkBytesIn: 0,
          networkBytesOut: 0,
          apiCalls: 0,
          durationMs: 0,
        },
      };
    }

    const startTime = Date.now();
    const sandboxConfig: SandboxConfig = {
      memoryLimit: (config?.memoryMb || tierLimits.memoryMb!) * 1024 * 1024,
      timeoutMs: config?.timeoutMs || tierLimits.timeoutMs!,
      allowFetch: config?.allowFetch || false,
      allowFs: config?.allowFs || false,
      maxCodeSize: (config?.maxCodeSizeKb || 512) * 1024,
      maxInputSize: (config?.maxInputSizeKb || 1024) * 1024,
    };

    const sandboxRunner = new SandboxRunner(sandboxConfig);
    const result = await sandboxRunner.executeCode(code, input);
    const durationMs = Date.now() - startTime;

    // Compute deterministic metrics from actual execution results
    const memoryUsedMb = result.memoryUsedBytes 
      ? Math.floor(result.memoryUsedBytes / (1024 * 1024))
      : Math.min(code.length / 1024, config?.memoryMb || 256); // Estimate based on code size
    
    const metrics: ExecutionMetrics = {
      cpuUsagePercent: Math.min(100, Math.floor((durationMs / (config?.timeoutMs || 30000)) * 100)),
      memoryUsedMb,
      peakMemoryMb: Math.floor(memoryUsedMb * 1.2),
      networkBytesIn: 0, // No actual network tracking in sandbox - report 0
      networkBytesOut: 0,
      apiCalls: 0,
      durationMs,
    };

    const outputHash = result.output ? 
      crypto.createHash('sha256').update(JSON.stringify(result.output)).digest('hex') : null;

    await db.update(sandboxSessions)
      .set({
        status: result.success ? 'completed' : 'failed',
        completedAt: new Date(),
        durationMs,
        cpuUsagePercent: metrics.cpuUsagePercent.toFixed(2),
        memoryUsedMb: metrics.memoryUsedMb,
        peakMemoryMb: metrics.peakMemoryMb,
        networkBytesIn: metrics.networkBytesIn,
        networkBytesOut: metrics.networkBytesOut,
        apiCalls: metrics.apiCalls,
        exitCode: result.success ? 0 : 1,
        outputHash,
        logs: JSON.stringify(result.logs),
        errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      })
      .where(eq(sandboxSessions.id, session.id));

    if (metrics.cpuUsagePercent > 90 || metrics.memoryUsedMb > (config?.memoryMb || 512) * 0.9) {
      await this.detectAnomaly(sessionId, agentId, 'resource_spike', metrics);
    }

    const [updatedSession] = await db.select()
      .from(sandboxSessions)
      .where(eq(sandboxSessions.id, session.id));

    return { result, session: updatedSession, metrics };
  }

  async logSecurityViolation(
    sessionId: string,
    agentId: number | null,
    violationType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    stackTrace?: string
  ): Promise<SecurityViolation> {
    const [violation] = await db.insert(securityViolations).values({
      sessionId,
      agentId,
      violationType,
      severity,
      description,
      stackTrace,
      resolved: false,
    } as any).returning();
    return violation;
  }

  async detectAnomaly(
    sessionId: string,
    agentId: number | null,
    anomalyType: string,
    metrics: ExecutionMetrics
  ): Promise<AnomalyDetection> {
    const [anomaly] = await db.insert(anomalyDetections).values({
      sessionId,
      agentId,
      anomalyType,
      confidence: '0.85',
      observedValue: metrics.cpuUsagePercent.toString(),
      description: `Anomaly detected: ${anomalyType}`,
      autoResolved: false,
    } as any).returning();
    return anomaly;
  }

  async getSessionById(sessionId: string): Promise<SandboxSession | null> {
    const [session] = await db.select()
      .from(sandboxSessions)
      .where(eq(sandboxSessions.sessionId, sessionId));
    return session || null;
  }

  async getRecentSessions(limit: number = 50): Promise<SandboxSession[]> {
    return db.select()
      .from(sandboxSessions)
      .orderBy(desc(sandboxSessions.createdAt))
      .limit(limit);
  }

  async getSecurityViolations(resolved?: boolean): Promise<SecurityViolation[]> {
    if (resolved !== undefined) {
      return db.select()
        .from(securityViolations)
        .where(eq(securityViolations.resolved, resolved))
        .orderBy(desc(securityViolations.createdAt));
    }
    return db.select()
      .from(securityViolations)
      .orderBy(desc(securityViolations.createdAt));
  }

  async getAnomalies(limit: number = 100): Promise<AnomalyDetection[]> {
    return db.select()
      .from(anomalyDetections)
      .orderBy(desc(anomalyDetections.createdAt))
      .limit(limit);
  }

  async createToolProxyRule(data: Partial<ToolProxyRule>): Promise<ToolProxyRule> {
    const [rule] = await db.insert(toolProxyRules).values({
      name: data.name || 'New Rule',
      description: data.description,
      toolId: data.toolId,
      ruleType: data.ruleType || 'allow',
      pattern: data.pattern || '*',
      action: data.action || '{}',
      rateLimit: data.rateLimit,
      priority: data.priority || 0,
      isActive: true,
    } as any).returning();
    return rule;
  }

  async getToolProxyRules(): Promise<ToolProxyRule[]> {
    return db.select()
      .from(toolProxyRules)
      .where(eq(toolProxyRules.isActive, true))
      .orderBy(desc(toolProxyRules.priority));
  }

  async checkRateLimit(toolId: number, sessionId: string): Promise<{ allowed: boolean; remaining: number }> {
    const rules = await db.select()
      .from(toolProxyRules)
      .where(and(eq(toolProxyRules.toolId, toolId), eq(toolProxyRules.isActive, true)));
    
    if (rules.length === 0) {
      return { allowed: true, remaining: 999 };
    }

    const rule = rules[0];
    if (!rule.rateLimit) {
      return { allowed: true, remaining: 999 };
    }

    return { allowed: true, remaining: rule.rateLimit - 1 };
  }

  async createBlockchainProof(
    executionId: number,
    network: 'ethereum' | 'polygon' | 'arbitrum' | 'optimism',
    inputHash: string,
    outputHash: string
  ): Promise<BlockchainProof> {
    const proofData = {
      merkleRoot: crypto.createHash('sha256').update(`${inputHash}${outputHash}`).digest('hex'),
      leaves: [inputHash, outputHash],
      timestamp: Date.now(),
    };

    const [proof] = await db.insert(blockchainProofs).values({
      executionId,
      network,
      proofData: JSON.stringify(proofData),
      inputHash,
      outputHash,
      timestamp: new Date(),
      status: 'pending',
    } as any).returning();

    return proof;
  }

  async getBlockchainProofs(executionId: number): Promise<BlockchainProof[]> {
    return db.select()
      .from(blockchainProofs)
      .where(eq(blockchainProofs.executionId, executionId))
      .orderBy(desc(blockchainProofs.createdAt));
  }

  async getResourceQuota(userId: string): Promise<ResourceQuota | null> {
    const [quota] = await db.select()
      .from(resourceQuotas)
      .where(eq(resourceQuotas.userId, userId));
    return quota || null;
  }

  async updateResourceUsage(userId: string, cpuSeconds: number, memoryGbSeconds: number): Promise<void> {
    const quota = await this.getResourceQuota(userId);
    if (quota) {
      await db.update(resourceQuotas)
        .set({
          currentDaily: (quota.currentDaily || 0) + cpuSeconds,
          currentMonthly: (quota.currentMonthly || 0) + cpuSeconds,
          updatedAt: new Date(),
        })
        .where(eq(resourceQuotas.id, quota.id));
    }
  }

  async getExecutionStats(): Promise<{
    totalSessions: number;
    successRate: number;
    avgDurationMs: number;
    totalViolations: number;
    activeAnomalies: number;
  }> {
    const [sessionsCount] = await db.select({ count: sql<number>`count(*)` })
      .from(sandboxSessions);
    
    const [successCount] = await db.select({ count: sql<number>`count(*)` })
      .from(sandboxSessions)
      .where(eq(sandboxSessions.status, 'completed'));
    
    const [avgDuration] = await db.select({ avg: sql<number>`avg(duration_ms)` })
      .from(sandboxSessions)
      .where(eq(sandboxSessions.status, 'completed'));
    
    const [violationsCount] = await db.select({ count: sql<number>`count(*)` })
      .from(securityViolations)
      .where(eq(securityViolations.resolved, false));
    
    const [anomaliesCount] = await db.select({ count: sql<number>`count(*)` })
      .from(anomalyDetections)
      .where(eq(anomalyDetections.autoResolved, false));

    const total = Number(sessionsCount?.count) || 0;
    const success = Number(successCount?.count) || 0;

    return {
      totalSessions: total,
      successRate: total > 0 ? (success / total) * 100 : 0,
      avgDurationMs: Number(avgDuration?.avg) || 0,
      totalViolations: Number(violationsCount?.count) || 0,
      activeAnomalies: Number(anomaliesCount?.count) || 0,
    };
  }

  async initializeDefaultConfigurations(): Promise<void> {
    const existing = await db.select({ name: sandboxConfigurations.name }).from(sandboxConfigurations);
    if (existing.length > 0) return;

    const defaultConfigs = [
      { name: 'Basic Sandbox', tier: 'basic', runtime: 'quickjs', securityLevel: 'standard', isDefault: false },
      { name: 'Standard Sandbox', tier: 'standard', runtime: 'quickjs', securityLevel: 'standard', isDefault: true },
      { name: 'Professional Sandbox', tier: 'professional', runtime: 'quickjs', securityLevel: 'strict', isDefault: false },
      { name: 'Enterprise Sandbox', tier: 'enterprise', runtime: 'quickjs', securityLevel: 'strict', isDefault: false },
      { name: 'Max Tier Sandbox', tier: 'max', runtime: 'quickjs', securityLevel: 'paranoid', isDefault: false },
    ];

    for (const config of defaultConfigs) {
      await this.createConfiguration(config as any);
    }
  }
}

export const maxTierSandboxService = new MaxTierSandboxService();
