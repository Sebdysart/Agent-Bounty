import { db } from "./db";
import { 
  aiExecutionRuns, agents, agentExecutions,
  type AiExecutionRun 
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import OpenAI from "openai";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
};

class AiExecutionService {
  private openai: OpenAI | null = null;

  private getOpenAI(): OpenAI | null {
    if (!process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      console.warn("OpenAI API key not configured - AI execution disabled");
      return null;
    }
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
    }
    return this.openai;
  }
  
  isConfigured(): boolean {
    return !!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
  }

  async createExecutionRun(
    agentId: number,
    input: string,
    options: {
      bountyId?: number;
      submissionId?: number;
      sessionId?: number;
      model?: string;
      systemPrompt?: string;
    } = {}
  ): Promise<AiExecutionRun> {
    const [run] = await db.insert(aiExecutionRuns).values({
      agentId,
      input,
      bountyId: options.bountyId,
      submissionId: options.submissionId,
      sessionId: options.sessionId,
      model: options.model || "gpt-4o",
      systemPrompt: options.systemPrompt,
      status: "queued",
    }).returning();

    return run;
  }

  async executeRun(runId: number): Promise<AiExecutionRun> {
    const [run] = await db.select().from(aiExecutionRuns)
      .where(eq(aiExecutionRuns.id, runId));
    
    if (!run) throw new Error("Run not found");

    const [agent] = await db.select().from(agents)
      .where(eq(agents.id, run.agentId));
    
    if (!agent) throw new Error("Agent not found");

    await db.update(aiExecutionRuns)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(aiExecutionRuns.id, runId));

    const startTime = Date.now();

    try {
      const openai = this.getOpenAI();
      
      if (!openai) {
        const [updated] = await db.update(aiExecutionRuns)
          .set({
            status: "failed",
            errorMessage: "OpenAI API key not configured - AI execution disabled",
            executionTimeMs: Date.now() - startTime,
            completedAt: new Date(),
          })
          .where(eq(aiExecutionRuns.id, runId))
          .returning();
        return updated;
      }
      
      const messages: OpenAI.ChatCompletionMessageParam[] = [];
      
      const systemContent = run.systemPrompt || `You are ${agent.name}, an AI agent. ${agent.description || ""}`;
      messages.push({
        role: "system",
        content: systemContent
      });

      messages.push({
        role: "user",
        content: run.input
      });

      const response = await openai.chat.completions.create({
        model: run.model || "gpt-4o",
        messages,
        max_tokens: 4096,
      });

      const executionTimeMs = Date.now() - startTime;
      const tokensInput = response.usage?.prompt_tokens || 0;
      const tokensOutput = response.usage?.completion_tokens || 0;
      const output = response.choices[0]?.message?.content || "";

      const pricing = MODEL_PRICING[run.model || "gpt-4o"] || MODEL_PRICING["gpt-4o"];
      const costUsd = (tokensInput * pricing.input / 1000) + (tokensOutput * pricing.output / 1000);

      const [updated] = await db.update(aiExecutionRuns)
        .set({
          status: "completed",
          output,
          tokensInput,
          tokensOutput,
          costUsd: String(costUsd),
          executionTimeMs,
          completedAt: new Date(),
        })
        .where(eq(aiExecutionRuns.id, runId))
        .returning();

      return updated;
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      
      const [updated] = await db.update(aiExecutionRuns)
        .set({
          status: "failed",
          errorMessage: error.message,
          executionTimeMs,
          completedAt: new Date(),
          retryCount: sql`${aiExecutionRuns.retryCount} + 1`,
        })
        .where(eq(aiExecutionRuns.id, runId))
        .returning();

      return updated;
    }
  }

  async executeAgent(
    agentId: number,
    input: string,
    options: {
      bountyId?: number;
      submissionId?: number;
      sessionId?: number;
      model?: string;
    } = {}
  ): Promise<AiExecutionRun> {
    const run = await this.createExecutionRun(agentId, input, options);
    return this.executeRun(run.id);
  }

  async getRunStatus(runId: number): Promise<AiExecutionRun | null> {
    const [run] = await db.select().from(aiExecutionRuns)
      .where(eq(aiExecutionRuns.id, runId));
    return run || null;
  }

  async getAgentRuns(agentId: number, limit: number = 20): Promise<AiExecutionRun[]> {
    return db.select().from(aiExecutionRuns)
      .where(eq(aiExecutionRuns.agentId, agentId))
      .orderBy(desc(aiExecutionRuns.createdAt))
      .limit(limit);
  }

  async getBountyRuns(bountyId: number): Promise<AiExecutionRun[]> {
    return db.select().from(aiExecutionRuns)
      .where(eq(aiExecutionRuns.bountyId, bountyId))
      .orderBy(desc(aiExecutionRuns.createdAt));
  }

  async getExecutionStats(agentId?: number): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    totalCost: number;
    avgExecutionTime: number;
    totalTokens: number;
  }> {
    let query = db.select().from(aiExecutionRuns);
    if (agentId) {
      query = query.where(eq(aiExecutionRuns.agentId, agentId)) as any;
    }
    
    const runs = await query;
    
    const completed = runs.filter(r => r.status === "completed");
    const failed = runs.filter(r => r.status === "failed");
    
    return {
      totalRuns: runs.length,
      successfulRuns: completed.length,
      failedRuns: failed.length,
      totalCost: completed.reduce((sum, r) => sum + Number(r.costUsd || 0), 0),
      avgExecutionTime: completed.length > 0 
        ? completed.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0) / completed.length 
        : 0,
      totalTokens: completed.reduce((sum, r) => sum + (r.tokensInput || 0) + (r.tokensOutput || 0), 0),
    };
  }

  async cancelRun(runId: number): Promise<void> {
    await db.update(aiExecutionRuns)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(eq(aiExecutionRuns.id, runId));
  }
}

export const aiExecutionService = new AiExecutionService();
