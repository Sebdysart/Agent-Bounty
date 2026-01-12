import { db } from "./db";
import { 
  enterpriseSubscriptions,
  type EnterpriseSubscription 
} from "@shared/schema";
import { eq } from "drizzle-orm";

interface TierConfig {
  name: string;
  price: number;
  features: string[];
  limits: {
    maxAgents: number;
    maxBounties: number;
    monthlyCredits: number;
    apiRateLimit: number;
  };
  sla: {
    responseTimeSla: number;
    uptimeGuarantee: number;
    dedicatedSupport: boolean;
    customVerification: boolean;
    priorityExecution: boolean;
  };
}

const TIER_CONFIGS: Record<string, TierConfig> = {
  starter: {
    name: "Starter",
    price: 0,
    features: [
      "Up to 3 agents",
      "Up to 10 bounties/month",
      "Community support",
      "Basic analytics",
    ],
    limits: {
      maxAgents: 3,
      maxBounties: 10,
      monthlyCredits: 100,
      apiRateLimit: 100,
    },
    sla: {
      responseTimeSla: 1440,
      uptimeGuarantee: 99.0,
      dedicatedSupport: false,
      customVerification: false,
      priorityExecution: false,
    },
  },
  professional: {
    name: "Professional",
    price: 49,
    features: [
      "Up to 10 agents",
      "Up to 50 bounties/month",
      "Priority email support",
      "Advanced analytics",
      "API access",
    ],
    limits: {
      maxAgents: 10,
      maxBounties: 50,
      monthlyCredits: 500,
      apiRateLimit: 500,
    },
    sla: {
      responseTimeSla: 240,
      uptimeGuarantee: 99.5,
      dedicatedSupport: false,
      customVerification: false,
      priorityExecution: false,
    },
  },
  business: {
    name: "Business",
    price: 199,
    features: [
      "Up to 50 agents",
      "Unlimited bounties",
      "Priority support with 4hr response",
      "Custom verification workflows",
      "Priority execution queue",
      "Team management",
    ],
    limits: {
      maxAgents: 50,
      maxBounties: -1,
      monthlyCredits: 2500,
      apiRateLimit: 2000,
    },
    sla: {
      responseTimeSla: 60,
      uptimeGuarantee: 99.9,
      dedicatedSupport: false,
      customVerification: true,
      priorityExecution: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    price: 999,
    features: [
      "Unlimited agents",
      "Unlimited bounties",
      "Dedicated account manager",
      "Custom SLA agreements",
      "Custom integrations",
      "On-premise deployment option",
      "SOC 2 compliance",
    ],
    limits: {
      maxAgents: -1,
      maxBounties: -1,
      monthlyCredits: -1,
      apiRateLimit: 10000,
    },
    sla: {
      responseTimeSla: 15,
      uptimeGuarantee: 99.99,
      dedicatedSupport: true,
      customVerification: true,
      priorityExecution: true,
    },
  },
};

class EnterpriseTierService {
  getTierConfigs(): Record<string, TierConfig> {
    return TIER_CONFIGS;
  }

  getTierConfig(tier: string): TierConfig | null {
    return TIER_CONFIGS[tier] || null;
  }

  async getSubscription(userId: string): Promise<EnterpriseSubscription | null> {
    const [sub] = await db.select().from(enterpriseSubscriptions)
      .where(eq(enterpriseSubscriptions.userId, userId));
    return sub || null;
  }

  async createSubscription(
    userId: string,
    tier: "starter" | "professional" | "business" | "enterprise" = "starter",
    stripeSubscriptionId?: string
  ): Promise<EnterpriseSubscription> {
    const config = TIER_CONFIGS[tier];
    if (!config) throw new Error("Invalid tier");

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const [sub] = await db.insert(enterpriseSubscriptions).values({
      userId,
      tier,
      slaLevel: tier === "enterprise" ? "dedicated" : tier === "business" ? "premium" : "standard",
      responseTimeSla: config.sla.responseTimeSla,
      uptimeGuarantee: String(config.sla.uptimeGuarantee),
      dedicatedSupport: config.sla.dedicatedSupport,
      customVerification: config.sla.customVerification,
      priorityExecution: config.sla.priorityExecution,
      apiRateLimit: config.limits.apiRateLimit,
      maxAgents: config.limits.maxAgents,
      maxBounties: config.limits.maxBounties,
      monthlyCredits: config.limits.monthlyCredits,
      usedCredits: 0,
      stripeSubscriptionId,
      status: tier === "starter" ? "active" : "trial",
      trialEndsAt: tier !== "starter" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : undefined,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    }).returning();

    return sub;
  }

  async upgradeTier(
    userId: string,
    newTier: "starter" | "professional" | "business" | "enterprise",
    stripeSubscriptionId?: string
  ): Promise<EnterpriseSubscription> {
    const config = TIER_CONFIGS[newTier];
    if (!config) throw new Error("Invalid tier");

    const existing = await this.getSubscription(userId);
    if (!existing) {
      return this.createSubscription(userId, newTier, stripeSubscriptionId);
    }

    const [sub] = await db.update(enterpriseSubscriptions)
      .set({
        tier: newTier,
        slaLevel: newTier === "enterprise" ? "dedicated" : newTier === "business" ? "premium" : "standard",
        responseTimeSla: config.sla.responseTimeSla,
        uptimeGuarantee: String(config.sla.uptimeGuarantee),
        dedicatedSupport: config.sla.dedicatedSupport,
        customVerification: config.sla.customVerification,
        priorityExecution: config.sla.priorityExecution,
        apiRateLimit: config.limits.apiRateLimit,
        maxAgents: config.limits.maxAgents,
        maxBounties: config.limits.maxBounties,
        monthlyCredits: config.limits.monthlyCredits,
        stripeSubscriptionId,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(enterpriseSubscriptions.userId, userId))
      .returning();

    return sub;
  }

  async useCredits(userId: string, amount: number): Promise<boolean> {
    const sub = await this.getSubscription(userId);
    if (!sub) return false;

    const monthlyLimit = sub.monthlyCredits ?? 0;
    if (monthlyLimit !== -1 && (sub.usedCredits || 0) + amount > monthlyLimit) {
      return false;
    }

    await db.update(enterpriseSubscriptions)
      .set({ usedCredits: (sub.usedCredits || 0) + amount })
      .where(eq(enterpriseSubscriptions.userId, userId));

    return true;
  }

  async checkLimit(
    userId: string,
    limitType: "agents" | "bounties" | "credits" | "api"
  ): Promise<{ allowed: boolean; current: number; max: number }> {
    const sub = await this.getSubscription(userId);
    if (!sub) {
      const starterConfig = TIER_CONFIGS.starter;
      return {
        allowed: true,
        current: 0,
        max: starterConfig.limits[
          limitType === "api" ? "apiRateLimit" : 
          limitType === "credits" ? "monthlyCredits" :
          limitType === "bounties" ? "maxBounties" : "maxAgents"
        ],
      };
    }

    const limitField = limitType === "api" ? "apiRateLimit" : 
      limitType === "credits" ? "monthlyCredits" :
      limitType === "bounties" ? "maxBounties" : "maxAgents";
    
    const max = sub[limitField] || 0;
    const current = limitType === "credits" ? (sub.usedCredits || 0) : 0;

    return {
      allowed: max === -1 || current < max,
      current,
      max: max === -1 ? Infinity : max,
    };
  }

  async cancelSubscription(userId: string): Promise<EnterpriseSubscription> {
    const [sub] = await db.update(enterpriseSubscriptions)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(enterpriseSubscriptions.userId, userId))
      .returning();

    return sub;
  }

  async resetMonthlyCredits(): Promise<number> {
    const result = await db.update(enterpriseSubscriptions)
      .set({ usedCredits: 0 })
      .where(eq(enterpriseSubscriptions.status, "active"));

    return 0;
  }

  async getUsageStats(userId: string): Promise<{
    tier: string;
    credits: { used: number; total: number };
    daysRemaining: number;
  }> {
    const sub = await this.getSubscription(userId);
    if (!sub) {
      return {
        tier: "starter",
        credits: { used: 0, total: TIER_CONFIGS.starter.limits.monthlyCredits },
        daysRemaining: 30,
      };
    }

    const daysRemaining = sub.currentPeriodEnd 
      ? Math.max(0, Math.ceil((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 30;

    return {
      tier: sub.tier,
      credits: {
        used: sub.usedCredits || 0,
        total: sub.monthlyCredits === -1 ? Infinity : (sub.monthlyCredits || 0),
      },
      daysRemaining,
    };
  }
}

export const enterpriseTierService = new EnterpriseTierService();
