import { db } from './db';
import { agentRecommendations, agents, bounties, submissions, agentUploads } from '@shared/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import OpenAI from 'openai';

interface MatchingFactors {
  categoryMatch: number;
  successRate: number;
  avgResponseTime: number;
  priceEfficiency: number;
  reviewScore: number;
  capabilityMatch: number;
}

interface AgentRecommendation {
  agentId: number;
  agent: typeof agents.$inferSelect;
  score: number;
  factors: MatchingFactors;
  reasoning: string;
}

class MatchingService {
  private openai: OpenAI | null = null;

  constructor() {
    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
    }
  }

  async getRecommendationsForBounty(bountyId: number, limit: number = 5): Promise<AgentRecommendation[]> {
    const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
    if (!bounty) return [];

    const allAgents = await db.select().from(agents);
    
    const scoredAgents = await Promise.all(
      allAgents.map(async (agent) => {
        const factors = await this.calculateMatchingFactors(bounty, agent);
        const score = this.calculateOverallScore(factors);
        const reasoning = this.generateReasoning(factors, bounty, agent);
        
        return {
          agentId: agent.id,
          agent,
          score,
          factors,
          reasoning,
        };
      })
    );

    const sorted = scoredAgents
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    for (const rec of sorted) {
      await db.insert(agentRecommendations).values({
        bountyId,
        agentId: rec.agentId,
        score: rec.score.toFixed(2),
        reasoning: rec.reasoning,
        factors: JSON.stringify(rec.factors),
      });
    }

    return sorted;
  }

  private async calculateMatchingFactors(bounty: typeof bounties.$inferSelect, agent: typeof agents.$inferSelect): Promise<MatchingFactors> {
    const categoryMatch = this.calculateCategoryMatch(bounty.category, agent.capabilities || []);
    
    const successRate = parseFloat(agent.completionRate?.toString() || '0');
    
    const uploads = await db.select()
      .from(agentUploads)
      .where(eq(agentUploads.linkedAgentId, agent.id));
    
    const avgResponseTime = uploads.length > 0 
      ? parseFloat(uploads[0].avgResponseTime?.toString() || '100') 
      : 100;

    const bountyReward = parseFloat(bounty.reward);
    const avgEarnings = parseFloat(agent.totalEarnings?.toString() || '0');
    const totalBounties = agent.totalBounties || 1;
    const avgBountyValue = avgEarnings / totalBounties;
    const priceEfficiency = bountyReward > 0 && avgBountyValue > 0
      ? Math.min(100, (avgBountyValue / bountyReward) * 100)
      : 50;

    const reviewScore = parseFloat(agent.avgRating?.toString() || '3') * 20;

    const capabilityMatch = this.calculateCapabilityMatch(
      bounty.description + ' ' + bounty.successMetrics,
      agent.capabilities || []
    );

    return {
      categoryMatch,
      successRate,
      avgResponseTime: Math.max(0, 100 - avgResponseTime / 10),
      priceEfficiency,
      reviewScore,
      capabilityMatch,
    };
  }

  private calculateCategoryMatch(bountyCategory: string, agentCapabilities: string[]): number {
    const categoryKeywords: Record<string, string[]> = {
      marketing: ['marketing', 'social media', 'content', 'seo', 'advertising'],
      sales: ['sales', 'lead generation', 'outreach', 'crm', 'prospecting'],
      research: ['research', 'analysis', 'data', 'survey', 'competitive'],
      data_analysis: ['data', 'analytics', 'visualization', 'reporting', 'metrics'],
      development: ['development', 'coding', 'api', 'automation', 'integration'],
      other: [],
    };

    const keywords = categoryKeywords[bountyCategory] || [];
    const capabilitiesLower = agentCapabilities.map(c => c.toLowerCase());
    
    let matches = 0;
    for (const keyword of keywords) {
      if (capabilitiesLower.some(c => c.includes(keyword))) {
        matches++;
      }
    }

    return keywords.length > 0 ? (matches / keywords.length) * 100 : 50;
  }

  private calculateCapabilityMatch(bountyText: string, agentCapabilities: string[]): number {
    const bountyWords = bountyText.toLowerCase().split(/\W+/);
    const capabilitiesLower = agentCapabilities.map(c => c.toLowerCase());
    
    let matches = 0;
    for (const capability of capabilitiesLower) {
      const capWords = capability.split(/\W+/);
      for (const word of capWords) {
        if (word.length > 3 && bountyWords.includes(word)) {
          matches++;
        }
      }
    }

    return Math.min(100, matches * 15);
  }

  private calculateOverallScore(factors: MatchingFactors): number {
    const weights = {
      categoryMatch: 0.2,
      successRate: 0.25,
      avgResponseTime: 0.1,
      priceEfficiency: 0.15,
      reviewScore: 0.15,
      capabilityMatch: 0.15,
    };

    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      score += factors[key as keyof MatchingFactors] * weight;
    }

    return score;
  }

  private generateReasoning(
    factors: MatchingFactors,
    bounty: typeof bounties.$inferSelect,
    agent: typeof agents.$inferSelect
  ): string {
    const reasons: string[] = [];

    if (factors.categoryMatch >= 70) {
      reasons.push(`Strong match for ${bounty.category} tasks`);
    }
    if (factors.successRate >= 80) {
      reasons.push(`High success rate (${factors.successRate.toFixed(0)}%)`);
    }
    if (factors.reviewScore >= 80) {
      reasons.push(`Excellent reviews (${(factors.reviewScore / 20).toFixed(1)}/5)`);
    }
    if (factors.avgResponseTime >= 70) {
      reasons.push('Fast response times');
    }
    if (factors.capabilityMatch >= 50) {
      reasons.push(`Capabilities align with requirements`);
    }

    if (reasons.length === 0) {
      reasons.push('Potentially suitable based on general capabilities');
    }

    return reasons.join('. ') + '.';
  }

  async getAIEnhancedRecommendations(bountyId: number, limit: number = 5): Promise<AgentRecommendation[]> {
    const basicRecs = await this.getRecommendationsForBounty(bountyId, limit * 2);
    
    if (!this.openai || basicRecs.length === 0) {
      return basicRecs.slice(0, limit);
    }

    const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
    if (!bounty) return basicRecs.slice(0, limit);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'You are an AI matching expert. Analyze the bounty requirements and agent capabilities to refine recommendations. Return a JSON object with agentIds (array of IDs in order of best match) and enhancedReasonings (object mapping agentId to enhanced reasoning).',
        }, {
          role: 'user',
          content: JSON.stringify({
            bounty: {
              title: bounty.title,
              description: bounty.description,
              category: bounty.category,
              successMetrics: bounty.successMetrics,
              reward: bounty.reward,
            },
            candidates: basicRecs.map(r => ({
              id: r.agentId,
              name: r.agent.name,
              capabilities: r.agent.capabilities,
              score: r.score,
              factors: r.factors,
            })),
          }),
        }],
        response_format: { type: 'json_object' },
      });

      const aiResult = JSON.parse(response.choices[0].message.content || '{}');
      
      if (aiResult.agentIds && Array.isArray(aiResult.agentIds)) {
        const reordered = aiResult.agentIds
          .map((id: number) => basicRecs.find(r => r.agentId === id))
          .filter(Boolean)
          .slice(0, limit);

        if (aiResult.enhancedReasonings) {
          for (const rec of reordered) {
            if (aiResult.enhancedReasonings[rec.agentId]) {
              rec.reasoning = aiResult.enhancedReasonings[rec.agentId];
            }
          }
        }

        return reordered;
      }
    } catch (error) {
      console.error('AI enhanced matching failed:', error);
    }

    return basicRecs.slice(0, limit);
  }

  async markAsSelected(bountyId: number, agentId: number): Promise<void> {
    await db.update(agentRecommendations)
      .set({ wasSelected: true })
      .where(and(
        eq(agentRecommendations.bountyId, bountyId),
        eq(agentRecommendations.agentId, agentId)
      ));
  }

  async getRecommendationHistory(bountyId: number) {
    return db.select()
      .from(agentRecommendations)
      .where(eq(agentRecommendations.bountyId, bountyId))
      .orderBy(desc(agentRecommendations.score));
  }
}

export const matchingService = new MatchingService();
