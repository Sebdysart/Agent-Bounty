interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  userOverrides: Map<string, boolean>;
  description: string;
}

interface FlagEvaluation {
  flag: string;
  enabled: boolean;
  reason: 'default' | 'user_override' | 'rollout' | 'disabled';
  userId?: string;
  timestamp: number;
}

const DEFAULT_FLAGS: Record<string, Omit<FeatureFlag, 'userOverrides'>> = {
  USE_WASMTIME_SANDBOX: {
    name: 'USE_WASMTIME_SANDBOX',
    enabled: false,
    rolloutPercentage: 0,
    description: 'Use Wasmtime for agent sandbox execution'
  },
  USE_UPSTASH_REDIS: {
    name: 'USE_UPSTASH_REDIS',
    enabled: false,
    rolloutPercentage: 0,
    description: 'Use Upstash Redis for caching and rate limiting'
  },
  USE_UPSTASH_KAFKA: {
    name: 'USE_UPSTASH_KAFKA',
    enabled: false,
    rolloutPercentage: 0,
    description: 'Use Upstash Kafka for job queue processing'
  },
  USE_R2_STORAGE: {
    name: 'USE_R2_STORAGE',
    enabled: false,
    rolloutPercentage: 0,
    description: 'Use Cloudflare R2 for file storage'
  }
};

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private evaluationLog: FlagEvaluation[] = [];
  private maxLogSize = 1000;

  constructor() {
    this.initializeFlags();
  }

  private initializeFlags(): void {
    for (const [key, config] of Object.entries(DEFAULT_FLAGS)) {
      this.flags.set(key, {
        ...config,
        userOverrides: new Map()
      });
    }
  }

  isEnabled(flagName: string, userId?: string): boolean {
    const flag = this.flags.get(flagName);

    if (!flag) {
      this.logEvaluation(flagName, false, 'default', userId);
      return false;
    }

    if (userId && flag.userOverrides.has(userId)) {
      const overrideValue = flag.userOverrides.get(userId)!;
      this.logEvaluation(flagName, overrideValue, 'user_override', userId);
      return overrideValue;
    }

    if (!flag.enabled) {
      this.logEvaluation(flagName, false, 'disabled', userId);
      return false;
    }

    if (flag.rolloutPercentage >= 100) {
      this.logEvaluation(flagName, true, 'rollout', userId);
      return true;
    }

    if (flag.rolloutPercentage <= 0) {
      this.logEvaluation(flagName, false, 'rollout', userId);
      return false;
    }

    const enabled = this.calculateRollout(flagName, userId, flag.rolloutPercentage);
    this.logEvaluation(flagName, enabled, 'rollout', userId);
    return enabled;
  }

  private calculateRollout(flagName: string, userId: string | undefined, percentage: number): boolean {
    const seed = userId ? `${flagName}:${userId}` : `${flagName}:${Date.now()}`;
    const hash = this.hashString(seed);
    return (hash % 100) < percentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private logEvaluation(flag: string, enabled: boolean, reason: FlagEvaluation['reason'], userId?: string): void {
    const evaluation: FlagEvaluation = {
      flag,
      enabled,
      reason,
      userId,
      timestamp: Date.now()
    };

    this.evaluationLog.push(evaluation);

    if (this.evaluationLog.length > this.maxLogSize) {
      this.evaluationLog = this.evaluationLog.slice(-this.maxLogSize / 2);
    }
  }

  setEnabled(flagName: string, enabled: boolean): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      return false;
    }
    flag.enabled = enabled;
    return true;
  }

  setRolloutPercentage(flagName: string, percentage: number): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      return false;
    }
    flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
    return true;
  }

  setUserOverride(flagName: string, userId: string, enabled: boolean): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      return false;
    }
    flag.userOverrides.set(userId, enabled);
    return true;
  }

  removeUserOverride(flagName: string, userId: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      return false;
    }
    return flag.userOverrides.delete(userId);
  }

  getAllFlags(): Record<string, { enabled: boolean; rolloutPercentage: number; description: string; overrideCount: number }> {
    const result: Record<string, { enabled: boolean; rolloutPercentage: number; description: string; overrideCount: number }> = {};

    for (const [key, flag] of this.flags) {
      result[key] = {
        enabled: flag.enabled,
        rolloutPercentage: flag.rolloutPercentage,
        description: flag.description,
        overrideCount: flag.userOverrides.size
      };
    }

    return result;
  }

  getFlag(flagName: string): FeatureFlag | undefined {
    return this.flags.get(flagName);
  }

  getEvaluationLog(limit: number = 100): FlagEvaluation[] {
    return this.evaluationLog.slice(-limit);
  }

  clearEvaluationLog(): void {
    this.evaluationLog = [];
  }

  registerFlag(name: string, config: { enabled?: boolean; rolloutPercentage?: number; description?: string }): void {
    if (this.flags.has(name)) {
      return;
    }

    this.flags.set(name, {
      name,
      enabled: config.enabled ?? false,
      rolloutPercentage: config.rolloutPercentage ?? 0,
      description: config.description ?? '',
      userOverrides: new Map()
    });
  }

  reset(): void {
    this.flags.clear();
    this.evaluationLog = [];
    this.initializeFlags();
  }
}

export const featureFlags = new FeatureFlagService();
