import { db } from "./db";
import { 
  finopsMetrics, costBudgets, finopsOptimizations, agentExecutions,
  type FinopsMetric, type CostBudget, type FinopsOptimization,
  type InsertFinopsMetric, type InsertCostBudget
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, sum } from "drizzle-orm";

export interface TokenPricing {
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

const TOKEN_PRICING: TokenPricing[] = [
  { provider: "openai", model: "gpt-4o", inputPricePerMillion: 2.5, outputPricePerMillion: 10 },
  { provider: "openai", model: "gpt-4o-mini", inputPricePerMillion: 0.15, outputPricePerMillion: 0.6 },
  { provider: "openai", model: "gpt-4-turbo", inputPricePerMillion: 10, outputPricePerMillion: 30 },
  { provider: "openai", model: "gpt-3.5-turbo", inputPricePerMillion: 0.5, outputPricePerMillion: 1.5 },
  { provider: "anthropic", model: "claude-3-5-sonnet-20241022", inputPricePerMillion: 3, outputPricePerMillion: 15 },
  { provider: "anthropic", model: "claude-3-opus", inputPricePerMillion: 15, outputPricePerMillion: 75 },
  { provider: "anthropic", model: "claude-3-haiku", inputPricePerMillion: 0.25, outputPricePerMillion: 1.25 },
  { provider: "groq", model: "llama-3.1-70b", inputPricePerMillion: 0.59, outputPricePerMillion: 0.79 },
  { provider: "groq", model: "llama-3.1-8b", inputPricePerMillion: 0.05, outputPricePerMillion: 0.08 },
  { provider: "groq", model: "mixtral-8x7b", inputPricePerMillion: 0.24, outputPricePerMillion: 0.24 },
];

class FinOpsService {
  calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = TOKEN_PRICING.find(
      p => p.provider === provider && p.model === model
    );

    if (!pricing) {
      return (inputTokens + outputTokens) * 0.000003;
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;

    return inputCost + outputCost;
  }

  async recordMetric(
    userId: string,
    data: {
      agentId?: number;
      executionId?: number;
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      computeTimeMs?: number;
      memoryUsageMb?: number;
      cacheHits?: number;
      errorCount?: number;
    }
  ): Promise<FinopsMetric> {
    const cost = this.calculateCost(
      data.provider,
      data.model,
      data.inputTokens,
      data.outputTokens
    );

    const [metric] = await db.insert(finopsMetrics).values({
      userId,
      agentId: data.agentId,
      executionId: data.executionId,
      provider: data.provider as any,
      model: data.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      totalTokens: data.inputTokens + data.outputTokens,
      cost: String(cost),
      computeTimeMs: data.computeTimeMs,
      memoryUsageMb: data.memoryUsageMb,
      cacheHits: data.cacheHits || 0,
      errorCount: data.errorCount || 0,
    }).returning();

    await this.checkBudgetAlerts(userId, cost);

    return metric;
  }

  async createBudget(
    userId: string,
    data: Omit<InsertCostBudget, 'userId'>
  ): Promise<CostBudget> {
    const [budget] = await db.insert(costBudgets).values({
      ...data,
      userId,
    }).returning();

    return budget;
  }

  async updateBudget(
    budgetId: number,
    userId: string,
    updates: Partial<InsertCostBudget>
  ): Promise<CostBudget> {
    const [budget] = await db.update(costBudgets)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(costBudgets.id, budgetId),
        eq(costBudgets.userId, userId)
      ))
      .returning();

    return budget;
  }

  async deleteBudget(budgetId: number, userId: string): Promise<void> {
    await db.delete(costBudgets)
      .where(and(
        eq(costBudgets.id, budgetId),
        eq(costBudgets.userId, userId)
      ));
  }

  async getUserBudgets(userId: string): Promise<CostBudget[]> {
    return db.select()
      .from(costBudgets)
      .where(eq(costBudgets.userId, userId))
      .orderBy(desc(costBudgets.createdAt));
  }

  async checkBudgetAlerts(userId: string, newCost: number): Promise<void> {
    const activeBudgets = await db.select()
      .from(costBudgets)
      .where(and(
        eq(costBudgets.userId, userId),
        eq(costBudgets.isActive, true)
      ));

    for (const budget of activeBudgets) {
      const currentSpend = parseFloat(budget.currentSpend || "0") + newCost;
      const budgetAmount = parseFloat(budget.budgetAmount);
      const threshold = parseFloat(budget.alertThreshold || "0.8");

      const shouldAlert = currentSpend >= budgetAmount * threshold && !budget.alertSent;

      await db.update(costBudgets)
        .set({
          currentSpend: String(currentSpend),
          alertSent: shouldAlert || budget.alertSent,
          updatedAt: new Date(),
        })
        .where(eq(costBudgets.id, budget.id));

      if (shouldAlert) {
        console.log(`Budget alert: User ${userId} has reached ${(currentSpend / budgetAmount * 100).toFixed(1)}% of budget "${budget.name}"`);
      }
    }
  }

  async getUsageStats(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCost: number;
    totalTokens: number;
    byProvider: Record<string, { cost: number; tokens: number }>;
    byModel: Record<string, { cost: number; tokens: number }>;
    byAgent: Record<number, { cost: number; tokens: number }>;
    dailyUsage: Array<{ date: string; cost: number; tokens: number }>;
  }> {
    const metrics = await db.select()
      .from(finopsMetrics)
      .where(and(
        eq(finopsMetrics.userId, userId),
        gte(finopsMetrics.recordedAt, startDate),
        lte(finopsMetrics.recordedAt, endDate)
      ))
      .orderBy(finopsMetrics.recordedAt);

    const result = {
      totalCost: 0,
      totalTokens: 0,
      byProvider: {} as Record<string, { cost: number; tokens: number }>,
      byModel: {} as Record<string, { cost: number; tokens: number }>,
      byAgent: {} as Record<number, { cost: number; tokens: number }>,
      dailyUsage: [] as Array<{ date: string; cost: number; tokens: number }>,
    };

    const dailyMap = new Map<string, { cost: number; tokens: number }>();

    for (const metric of metrics) {
      const cost = parseFloat(metric.cost);
      const tokens = metric.totalTokens || 0;

      result.totalCost += cost;
      result.totalTokens += tokens;

      if (!result.byProvider[metric.provider]) {
        result.byProvider[metric.provider] = { cost: 0, tokens: 0 };
      }
      result.byProvider[metric.provider].cost += cost;
      result.byProvider[metric.provider].tokens += tokens;

      if (!result.byModel[metric.model]) {
        result.byModel[metric.model] = { cost: 0, tokens: 0 };
      }
      result.byModel[metric.model].cost += cost;
      result.byModel[metric.model].tokens += tokens;

      if (metric.agentId) {
        if (!result.byAgent[metric.agentId]) {
          result.byAgent[metric.agentId] = { cost: 0, tokens: 0 };
        }
        result.byAgent[metric.agentId].cost += cost;
        result.byAgent[metric.agentId].tokens += tokens;
      }

      const dateKey = metric.recordedAt.toISOString().split("T")[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { cost: 0, tokens: 0 });
      }
      dailyMap.get(dateKey)!.cost += cost;
      dailyMap.get(dateKey)!.tokens += tokens;
    }

    result.dailyUsage = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  }

  async generateOptimizations(userId: string): Promise<FinopsOptimization[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stats = await this.getUsageStats(userId, thirtyDaysAgo, new Date());
    const optimizations: Omit<FinopsOptimization, "id" | "createdAt" | "isApplied" | "appliedAt">[] = [];

    for (const [model, data] of Object.entries(stats.byModel)) {
      if (model === "gpt-4o" && data.cost > 10) {
        optimizations.push({
          userId,
          agentId: null,
          optimizationType: "model_switch",
          currentCost: String(data.cost),
          projectedSavings: String(data.cost * 0.85),
          recommendation: `Switch from ${model} to gpt-4o-mini for simpler tasks`,
          details: JSON.stringify({
            currentModel: model,
            suggestedModel: "gpt-4o-mini",
            tokensAnalyzed: data.tokens,
          }),
        });
      }

      if (model === "claude-3-opus" && data.cost > 20) {
        optimizations.push({
          userId,
          agentId: null,
          optimizationType: "model_switch",
          currentCost: String(data.cost),
          projectedSavings: String(data.cost * 0.80),
          recommendation: `Consider using claude-3-5-sonnet for most tasks instead of ${model}`,
          details: JSON.stringify({
            currentModel: model,
            suggestedModel: "claude-3-5-sonnet-20241022",
            tokensAnalyzed: data.tokens,
          }),
        });
      }
    }

    if (stats.totalTokens > 1_000_000) {
      optimizations.push({
        userId,
        agentId: null,
        optimizationType: "caching",
        currentCost: String(stats.totalCost),
        projectedSavings: String(stats.totalCost * 0.15),
        recommendation: "Enable response caching for repeated queries",
        details: JSON.stringify({
          totalTokens: stats.totalTokens,
          estimatedCacheablePercent: 15,
        }),
      });
    }

    if (stats.dailyUsage.length > 0) {
      const avgDaily = stats.totalCost / stats.dailyUsage.length;
      if (avgDaily > 50) {
        optimizations.push({
          userId,
          agentId: null,
          optimizationType: "batch_processing",
          currentCost: String(stats.totalCost),
          projectedSavings: String(avgDaily * 0.20),
          recommendation: "Batch similar requests together to reduce API overhead",
          details: JSON.stringify({
            averageDailyCost: avgDaily,
            daysAnalyzed: stats.dailyUsage.length,
          }),
        });
      }
    }

    const created: FinopsOptimization[] = [];
    for (const opt of optimizations) {
      const [record] = await db.insert(finopsOptimizations)
        .values(opt)
        .returning();
      created.push(record);
    }

    return created;
  }

  async getUserOptimizations(userId: string): Promise<FinopsOptimization[]> {
    return db.select()
      .from(finopsOptimizations)
      .where(eq(finopsOptimizations.userId, userId))
      .orderBy(desc(finopsOptimizations.createdAt));
  }

  async applyOptimization(optimizationId: number, userId: string): Promise<FinopsOptimization> {
    const [opt] = await db.update(finopsOptimizations)
      .set({ isApplied: true, appliedAt: new Date() })
      .where(and(
        eq(finopsOptimizations.id, optimizationId),
        eq(finopsOptimizations.userId, userId)
      ))
      .returning();

    return opt;
  }

  async getDashboardSummary(userId: string): Promise<{
    currentMonthCost: number;
    lastMonthCost: number;
    costChange: number;
    activeBudgets: number;
    budgetsNearLimit: number;
    pendingOptimizations: number;
    projectedMonthlySavings: number;
  }> {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentStats = await this.getUsageStats(userId, firstOfMonth, now);
    const lastStats = await this.getUsageStats(userId, firstOfLastMonth, firstOfMonth);

    const budgets = await this.getUserBudgets(userId);
    const optimizations = await this.getUserOptimizations(userId);

    const budgetsNearLimit = budgets.filter(b => {
      const spend = parseFloat(b.currentSpend || "0");
      const limit = parseFloat(b.budgetAmount);
      return spend >= limit * 0.8 && b.isActive;
    }).length;

    const pendingOpts = optimizations.filter(o => !o.isApplied);
    const projectedSavings = pendingOpts.reduce(
      (sum, o) => sum + parseFloat(o.projectedSavings || "0"),
      0
    );

    const costChange = lastStats.totalCost > 0
      ? ((currentStats.totalCost - lastStats.totalCost) / lastStats.totalCost) * 100
      : 0;

    return {
      currentMonthCost: currentStats.totalCost,
      lastMonthCost: lastStats.totalCost,
      costChange,
      activeBudgets: budgets.filter(b => b.isActive).length,
      budgetsNearLimit,
      pendingOptimizations: pendingOpts.length,
      projectedMonthlySavings: projectedSavings,
    };
  }

  getTokenPricing(): TokenPricing[] {
    return TOKEN_PRICING;
  }
}

export const finopsService = new FinOpsService();
