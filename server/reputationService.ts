import { db } from "./db";
import { 
  agentReputations, reputationEvents, agents, reviews, submissions, disputes,
  type AgentReputation, type ReputationEvent 
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

const TIER_THRESHOLDS = {
  diamond: 90,
  platinum: 80,
  gold: 70,
  silver: 60,
  bronze: 0,
};

const BADGES = {
  fast_responder: { threshold: 300, type: "avgResponseTime" },
  high_quality: { threshold: 90, type: "qualityScore" },
  reliable: { threshold: 95, type: "reliabilityScore" },
  prolific: { threshold: 50, type: "completedBounties" },
  trusted: { threshold: 100, type: "totalReviews" },
  dispute_winner: { threshold: 5, type: "disputesWon" },
};

class ReputationService {
  async initializeReputation(agentId: number): Promise<AgentReputation> {
    const existing = await db.select().from(agentReputations)
      .where(eq(agentReputations.agentId, agentId));
    
    if (existing.length > 0) return existing[0];

    const [reputation] = await db.insert(agentReputations).values({
      agentId,
      overallScore: "50",
      qualityScore: "50",
      reliabilityScore: "50",
      speedScore: "50",
      communicationScore: "50",
      tier: "bronze",
    }).returning();

    return reputation;
  }

  async recordEvent(
    agentId: number,
    eventType: "review" | "completion" | "failure" | "dispute" | "badge" | "penalty",
    scoreChange: number,
    reason?: string,
    relatedId?: number
  ): Promise<ReputationEvent> {
    const [reputation] = await db.select().from(agentReputations)
      .where(eq(agentReputations.agentId, agentId));
    
    const previousScore = reputation ? Number(reputation.overallScore) : 50;
    const newScore = Math.max(0, Math.min(100, previousScore + scoreChange));

    const [event] = await db.insert(reputationEvents).values({
      agentId,
      eventType,
      scoreChange: String(scoreChange),
      previousScore: String(previousScore),
      newScore: String(newScore),
      reason,
      relatedId,
    }).returning();

    await this.recalculateReputation(agentId);

    return event;
  }

  async processReview(
    agentId: number,
    rating: number,
    reviewId: number
  ): Promise<void> {
    let scoreChange = 0;
    let reviewType: "positive" | "neutral" | "negative";

    if (rating >= 4) {
      scoreChange = rating === 5 ? 3 : 2;
      reviewType = "positive";
    } else if (rating === 3) {
      scoreChange = 0;
      reviewType = "neutral";
    } else {
      scoreChange = rating === 1 ? -3 : -2;
      reviewType = "negative";
    }

    await this.recordEvent(agentId, "review", scoreChange, `${reviewType} review (${rating}/5)`, reviewId);

    const updateField = reviewType === "positive" ? "positiveReviews" 
      : reviewType === "negative" ? "negativeReviews" 
      : "neutralReviews";

    await db.update(agentReputations)
      .set({ 
        [updateField]: sql`${agentReputations[updateField]} + 1`,
        totalReviews: sql`${agentReputations.totalReviews} + 1`,
      })
      .where(eq(agentReputations.agentId, agentId));
  }

  async processBountyCompletion(
    agentId: number,
    bountyId: number,
    success: boolean,
    executionTimeSeconds?: number
  ): Promise<void> {
    if (success) {
      await this.recordEvent(agentId, "completion", 5, "Bounty completed successfully", bountyId);
      await db.update(agentReputations)
        .set({ completedBounties: sql`${agentReputations.completedBounties} + 1` })
        .where(eq(agentReputations.agentId, agentId));
    } else {
      await this.recordEvent(agentId, "failure", -5, "Bounty failed", bountyId);
      await db.update(agentReputations)
        .set({ failedBounties: sql`${agentReputations.failedBounties} + 1` })
        .where(eq(agentReputations.agentId, agentId));
    }

    if (executionTimeSeconds) {
      const [rep] = await db.select().from(agentReputations)
        .where(eq(agentReputations.agentId, agentId));
      
      const currentAvg = rep?.avgCompletionTime || 0;
      const totalCompleted = (rep?.completedBounties || 0) + (success ? 1 : 0);
      const newAvg = totalCompleted > 1 
        ? Math.round((currentAvg * (totalCompleted - 1) + executionTimeSeconds) / totalCompleted)
        : executionTimeSeconds;

      await db.update(agentReputations)
        .set({ avgCompletionTime: newAvg })
        .where(eq(agentReputations.agentId, agentId));
    }
  }

  async processDisputeOutcome(
    agentId: number,
    disputeId: number,
    won: boolean
  ): Promise<void> {
    const scoreChange = won ? 2 : -3;
    const field = won ? "disputesWon" : "disputesLost";

    await this.recordEvent(
      agentId, 
      "dispute", 
      scoreChange, 
      won ? "Won dispute" : "Lost dispute", 
      disputeId
    );

    await db.update(agentReputations)
      .set({ [field]: sql`${agentReputations[field]} + 1` })
      .where(eq(agentReputations.agentId, agentId));
  }

  async recalculateReputation(agentId: number): Promise<AgentReputation> {
    const events = await db.select().from(reputationEvents)
      .where(eq(reputationEvents.agentId, agentId))
      .orderBy(desc(reputationEvents.createdAt));

    let overallScore = 50;
    for (const event of events.slice(0, 100)) {
      overallScore += Number(event.scoreChange);
    }
    overallScore = Math.max(0, Math.min(100, overallScore));

    const [rep] = await db.select().from(agentReputations)
      .where(eq(agentReputations.agentId, agentId));

    if (!rep) {
      return this.initializeReputation(agentId);
    }

    const completedBounties = rep.completedBounties || 0;
    const failedBounties = rep.failedBounties || 0;
    const totalBounties = completedBounties + failedBounties;
    
    const reliabilityScore = totalBounties > 0 
      ? Math.round((completedBounties / totalBounties) * 100)
      : 50;

    let tier: "bronze" | "silver" | "gold" | "platinum" | "diamond" = "bronze";
    if (overallScore >= TIER_THRESHOLDS.diamond) tier = "diamond";
    else if (overallScore >= TIER_THRESHOLDS.platinum) tier = "platinum";
    else if (overallScore >= TIER_THRESHOLDS.gold) tier = "gold";
    else if (overallScore >= TIER_THRESHOLDS.silver) tier = "silver";

    const badges = this.calculateBadges(rep, overallScore, reliabilityScore);

    const [updated] = await db.update(agentReputations)
      .set({
        overallScore: String(overallScore),
        reliabilityScore: String(reliabilityScore),
        tier,
        badges,
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentReputations.agentId, agentId))
      .returning();

    return updated;
  }

  private calculateBadges(
    rep: AgentReputation, 
    overallScore: number, 
    reliabilityScore: number
  ): string[] {
    const badges: string[] = [];

    if ((rep.avgResponseTime || Infinity) <= BADGES.fast_responder.threshold) {
      badges.push("fast_responder");
    }
    if (Number(rep.qualityScore) >= BADGES.high_quality.threshold) {
      badges.push("high_quality");
    }
    if (reliabilityScore >= BADGES.reliable.threshold) {
      badges.push("reliable");
    }
    if ((rep.completedBounties || 0) >= BADGES.prolific.threshold) {
      badges.push("prolific");
    }
    if ((rep.totalReviews || 0) >= BADGES.trusted.threshold) {
      badges.push("trusted");
    }
    if ((rep.disputesWon || 0) >= BADGES.dispute_winner.threshold) {
      badges.push("dispute_winner");
    }

    return badges;
  }

  async getReputation(agentId: number): Promise<AgentReputation | null> {
    const [rep] = await db.select().from(agentReputations)
      .where(eq(agentReputations.agentId, agentId));
    return rep || null;
  }

  async getReputationHistory(agentId: number, limit: number = 50): Promise<ReputationEvent[]> {
    return db.select().from(reputationEvents)
      .where(eq(reputationEvents.agentId, agentId))
      .orderBy(desc(reputationEvents.createdAt))
      .limit(limit);
  }

  async getLeaderboard(limit: number = 20): Promise<AgentReputation[]> {
    return db.select().from(agentReputations)
      .orderBy(desc(agentReputations.overallScore))
      .limit(limit);
  }

  async getAgentsByTier(tier: "bronze" | "silver" | "gold" | "platinum" | "diamond"): Promise<AgentReputation[]> {
    return db.select().from(agentReputations)
      .where(eq(agentReputations.tier, tier))
      .orderBy(desc(agentReputations.overallScore));
  }
}

export const reputationService = new ReputationService();
