import { db } from "./db";
import { 
  analyticsForecasts, riskScores, trendAnalytics,
  bounties, agents, submissions, agentExecutions,
  type AnalyticsForecast, type RiskScore, type TrendAnalytic,
  type InsertAnalyticsForecast, type InsertRiskScore
} from "@shared/schema";
import { eq, and, desc, sql, gte, count, avg } from "drizzle-orm";

export interface ForecastInput {
  entityType: string;
  entityId?: number;
  horizon: "7d" | "30d" | "90d";
  historicalData?: any;
}

export interface RiskFactors {
  historyScore: number;
  completionRateScore: number;
  reviewScore: number;
  activityScore: number;
  paymentScore: number;
}

class PredictiveAnalyticsService {
  async generateBountySuccessForecast(bountyId: number): Promise<AnalyticsForecast> {
    const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
    if (!bounty) throw new Error("Bounty not found");

    const submissionCount = await db.select({ count: count() })
      .from(submissions)
      .where(eq(submissions.bountyId, bountyId));

    const similarBounties = await db.select()
      .from(bounties)
      .where(and(
        eq(bounties.category, bounty.category),
        eq(bounties.status, "completed")
      ))
      .limit(100);

    const successRate = similarBounties.length > 0 
      ? similarBounties.filter(b => b.winnerId !== null).length / similarBounties.length 
      : 0.5;

    const rewardFactor = Math.min(parseFloat(bounty.reward) / 1000, 1);
    const submissionFactor = Math.min(submissionCount[0].count / 5, 1);
    const deadlineDays = Math.max(0, (bounty.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const deadlineFactor = Math.min(deadlineDays / 14, 1);

    const prediction = (successRate * 0.4) + (rewardFactor * 0.2) + (submissionFactor * 0.25) + (deadlineFactor * 0.15);
    const confidence = Math.min(0.5 + (similarBounties.length / 200), 0.95);

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    const [forecast] = await db.insert(analyticsForecasts).values({
      forecastType: "bounty_success",
      entityType: "bounty",
      entityId: bountyId,
      prediction: String(prediction),
      confidence: String(confidence),
      factors: JSON.stringify({
        historicalSuccessRate: successRate,
        rewardFactor,
        submissionFactor,
        deadlineFactor,
        similarBountiesAnalyzed: similarBounties.length,
      }),
      modelVersion: "v1.0",
      horizon: "7d",
      historicalData: JSON.stringify({ category: bounty.category, reward: bounty.reward }),
      validUntil,
    }).returning();

    return forecast;
  }

  async generateAgentPerformanceForecast(agentId: number, horizon: "7d" | "30d" | "90d" = "30d"): Promise<AnalyticsForecast> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
    if (!agent) throw new Error("Agent not found");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSubmissions = await db.select()
      .from(submissions)
      .where(and(
        eq(submissions.agentId, agentId),
        gte(submissions.createdAt, thirtyDaysAgo)
      ));

    const completedCount = recentSubmissions.filter(s => s.status === "approved").length;
    const recentRate = recentSubmissions.length > 0 ? completedCount / recentSubmissions.length : 0;
    
    const historicalRate = parseFloat(agent.completionRate || "0") / 100;
    const trend = recentRate - historicalRate;

    const projectedRate = Math.min(Math.max(historicalRate + (trend * 0.5), 0), 1);
    const confidence = Math.min(0.4 + (recentSubmissions.length / 50), 0.9);

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + parseInt(horizon));

    const [forecast] = await db.insert(analyticsForecasts).values({
      forecastType: "agent_performance",
      entityType: "agent",
      entityId: agentId,
      prediction: String(projectedRate),
      confidence: String(confidence),
      factors: JSON.stringify({
        historicalRate,
        recentRate,
        trend,
        recentSubmissions: recentSubmissions.length,
      }),
      modelVersion: "v1.0",
      horizon,
      historicalData: JSON.stringify({ 
        totalBounties: agent.totalBounties,
        avgRating: agent.avgRating,
      }),
      validUntil,
    }).returning();

    return forecast;
  }

  async generateRevenueForecast(userId: string, horizon: "7d" | "30d" | "90d" = "30d"): Promise<AnalyticsForecast> {
    const daysBack = parseInt(horizon);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const userBounties = await db.select()
      .from(bounties)
      .where(and(
        eq(bounties.posterId, userId),
        gte(bounties.createdAt, startDate)
      ));

    const totalSpent = userBounties.reduce((sum, b) => sum + parseFloat(b.reward), 0);
    const avgPerBounty = userBounties.length > 0 ? totalSpent / userBounties.length : 0;
    const bountyRate = userBounties.length / daysBack;

    const projectedSpend = avgPerBounty * bountyRate * daysBack;
    const confidence = Math.min(0.3 + (userBounties.length / 20), 0.85);

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + daysBack);

    const [forecast] = await db.insert(analyticsForecasts).values({
      userId,
      forecastType: "revenue",
      entityType: "user",
      prediction: String(projectedSpend),
      confidence: String(confidence),
      factors: JSON.stringify({
        historicalSpend: totalSpent,
        avgPerBounty,
        bountyRate,
        bountiesAnalyzed: userBounties.length,
      }),
      modelVersion: "v1.0",
      horizon,
      historicalData: JSON.stringify({ totalBounties: userBounties.length }),
      validUntil,
    }).returning();

    return forecast;
  }

  async calculateRiskScore(entityType: "bounty" | "agent" | "user", entityId: number | string): Promise<RiskScore> {
    let factors: RiskFactors = {
      historyScore: 50,
      completionRateScore: 50,
      reviewScore: 50,
      activityScore: 50,
      paymentScore: 50,
    };

    if (entityType === "agent" && typeof entityId === "number") {
      const [agent] = await db.select().from(agents).where(eq(agents.id, entityId));
      if (agent) {
        factors.historyScore = Math.min(agent.totalBounties || 0, 100);
        factors.completionRateScore = 100 - parseFloat(agent.completionRate || "50");
        factors.reviewScore = 100 - (parseFloat(agent.avgRating || "3") * 20);
        factors.activityScore = agent.isVerified ? 20 : 60;
      }
    } else if (entityType === "bounty" && typeof entityId === "number") {
      const [bounty] = await db.select().from(bounties).where(eq(bounties.id, entityId));
      if (bounty) {
        const reward = parseFloat(bounty.reward);
        factors.paymentScore = reward > 5000 ? 30 : reward > 1000 ? 50 : 70;
        
        const daysToDeadline = (bounty.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        factors.historyScore = daysToDeadline < 3 ? 80 : daysToDeadline < 7 ? 50 : 30;
      }
    }

    const overallScore = (
      factors.historyScore * 0.2 +
      factors.completionRateScore * 0.25 +
      factors.reviewScore * 0.2 +
      factors.activityScore * 0.15 +
      factors.paymentScore * 0.2
    );

    const mitigations = [];
    if (factors.historyScore > 60) mitigations.push("Increase track record with smaller bounties");
    if (factors.completionRateScore > 60) mitigations.push("Focus on completion rate improvement");
    if (factors.reviewScore > 60) mitigations.push("Address review feedback");
    if (factors.paymentScore > 60) mitigations.push("Consider escrow protection");

    const [score] = await db.insert(riskScores).values({
      entityType,
      entityId: typeof entityId === "number" ? entityId : parseInt(entityId) || 0,
      overallScore: String(overallScore),
      fraudRisk: String(factors.historyScore),
      deliveryRisk: String(factors.completionRateScore),
      paymentRisk: String(factors.paymentScore),
      reputationRisk: String(factors.reviewScore),
      riskFactors: JSON.stringify(factors),
      mitigationSuggestions: JSON.stringify(mitigations),
    }).returning();

    return score;
  }

  async recordTrendMetric(
    metricName: string,
    metricValue: number,
    period: "hourly" | "daily" | "weekly" | "monthly",
    breakdown?: Record<string, number>
  ): Promise<TrendAnalytic> {
    const previousMetrics = await db.select()
      .from(trendAnalytics)
      .where(and(
        eq(trendAnalytics.metricName, metricName),
        eq(trendAnalytics.period, period)
      ))
      .orderBy(desc(trendAnalytics.recordedAt))
      .limit(1);

    const previousValue = previousMetrics.length > 0 
      ? parseFloat(previousMetrics[0].metricValue) 
      : null;

    const changePercent = previousValue !== null && previousValue !== 0
      ? ((metricValue - previousValue) / previousValue) * 100
      : null;

    const trend = changePercent === null ? "stable" 
      : changePercent > 5 ? "up" 
      : changePercent < -5 ? "down" 
      : "stable";

    const [metric] = await db.insert(trendAnalytics).values({
      metricName,
      metricValue: String(metricValue),
      previousValue: previousValue !== null ? String(previousValue) : null,
      changePercent: changePercent !== null ? String(changePercent) : null,
      trend,
      period,
      breakdown: breakdown ? JSON.stringify(breakdown) : null,
    }).returning();

    return metric;
  }

  async getPlatformTrends(period: "daily" | "weekly" | "monthly" = "daily", limit: number = 30): Promise<TrendAnalytic[]> {
    return db.select()
      .from(trendAnalytics)
      .where(eq(trendAnalytics.period, period))
      .orderBy(desc(trendAnalytics.recordedAt))
      .limit(limit);
  }

  async getForecasts(
    forecastType?: string,
    entityType?: string,
    entityId?: number
  ): Promise<AnalyticsForecast[]> {
    let query = db.select().from(analyticsForecasts);
    
    const conditions = [];
    if (forecastType) conditions.push(eq(analyticsForecasts.forecastType, forecastType as any));
    if (entityType) conditions.push(eq(analyticsForecasts.entityType, entityType));
    if (entityId) conditions.push(eq(analyticsForecasts.entityId, entityId));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query.orderBy(desc(analyticsForecasts.forecastedAt)).limit(100);
  }

  async getRiskScores(entityType?: string): Promise<RiskScore[]> {
    let query = db.select().from(riskScores);
    
    if (entityType) {
      query = query.where(eq(riskScores.entityType, entityType)) as any;
    }

    return query.orderBy(desc(riskScores.lastUpdated)).limit(100);
  }

  async getDashboardInsights(): Promise<{
    avgBountySuccessRate: number;
    avgAgentPerformance: number;
    highRiskEntities: number;
    trendingSummary: { metric: string; trend: string; change: number }[];
  }> {
    const recentForecasts = await db.select()
      .from(analyticsForecasts)
      .where(gte(analyticsForecasts.forecastedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .limit(100);

    const bountyForecasts = recentForecasts.filter(f => f.forecastType === "bounty_success");
    const agentForecasts = recentForecasts.filter(f => f.forecastType === "agent_performance");

    const avgBountySuccess = bountyForecasts.length > 0
      ? bountyForecasts.reduce((sum, f) => sum + parseFloat(f.prediction || "0"), 0) / bountyForecasts.length
      : 0.5;

    const avgAgentPerf = agentForecasts.length > 0
      ? agentForecasts.reduce((sum, f) => sum + parseFloat(f.prediction || "0"), 0) / agentForecasts.length
      : 0.5;

    const highRiskScores = await db.select()
      .from(riskScores)
      .where(gte(riskScores.overallScore, "70"));

    const latestTrends = await db.select()
      .from(trendAnalytics)
      .where(eq(trendAnalytics.period, "daily"))
      .orderBy(desc(trendAnalytics.recordedAt))
      .limit(10);

    return {
      avgBountySuccessRate: avgBountySuccess,
      avgAgentPerformance: avgAgentPerf,
      highRiskEntities: highRiskScores.length,
      trendingSummary: latestTrends.map(t => ({
        metric: t.metricName,
        trend: t.trend,
        change: parseFloat(t.changePercent || "0"),
      })),
    };
  }

  async updateForecastAccuracy(forecastId: number, actualOutcome: number): Promise<AnalyticsForecast> {
    const [forecast] = await db.select()
      .from(analyticsForecasts)
      .where(eq(analyticsForecasts.id, forecastId));

    if (!forecast) throw new Error("Forecast not found");

    const prediction = parseFloat(forecast.prediction || "0");
    const accuracy = 1 - Math.abs(prediction - actualOutcome);

    const [updated] = await db.update(analyticsForecasts)
      .set({
        actualOutcome: String(actualOutcome),
        accuracy: String(accuracy),
      })
      .where(eq(analyticsForecasts.id, forecastId))
      .returning();

    return updated;
  }
}

export const predictiveAnalyticsService = new PredictiveAnalyticsService();
