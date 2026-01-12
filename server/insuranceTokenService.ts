import { db } from "./db";
import { 
  agentInsurance, insuranceClaims, agentTokens, tokenHoldings, agents,
  type AgentInsurance, type InsuranceClaim, type AgentToken, type TokenHolding,
  type InsertAgentInsurance, type InsertInsuranceClaim, type InsertAgentToken
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";

export interface InsuranceTierConfig {
  tier: "basic" | "standard" | "premium" | "enterprise";
  coverageMultiplier: number;
  monthlyPremiumRate: number;
  deductibleRate: number;
  coveredEvents: string[];
}

const INSURANCE_TIERS: InsuranceTierConfig[] = [
  {
    tier: "basic",
    coverageMultiplier: 1,
    monthlyPremiumRate: 0.02,
    deductibleRate: 0.10,
    coveredEvents: ["execution_failure", "timeout"],
  },
  {
    tier: "standard",
    coverageMultiplier: 2.5,
    monthlyPremiumRate: 0.04,
    deductibleRate: 0.05,
    coveredEvents: ["execution_failure", "timeout", "data_loss", "quality_issue"],
  },
  {
    tier: "premium",
    coverageMultiplier: 5,
    monthlyPremiumRate: 0.06,
    deductibleRate: 0.02,
    coveredEvents: ["execution_failure", "timeout", "data_loss", "quality_issue", "security_breach", "sla_violation"],
  },
  {
    tier: "enterprise",
    coverageMultiplier: 10,
    monthlyPremiumRate: 0.08,
    deductibleRate: 0,
    coveredEvents: ["execution_failure", "timeout", "data_loss", "quality_issue", "security_breach", "sla_violation", "compliance_failure", "reputation_damage"],
  },
];

class InsuranceTokenService {
  async createInsurance(
    agentId: number,
    ownerId: string,
    tier: "basic" | "standard" | "premium" | "enterprise",
    baseValue: number = 1000
  ): Promise<AgentInsurance> {
    const tierConfig = INSURANCE_TIERS.find(t => t.tier === tier);
    if (!tierConfig) throw new Error("Invalid insurance tier");

    const coverageAmount = baseValue * tierConfig.coverageMultiplier;
    const monthlyPremium = coverageAmount * tierConfig.monthlyPremiumRate;
    const deductible = coverageAmount * tierConfig.deductibleRate;

    const startDate = new Date();
    const renewalDate = new Date();
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);

    const [insurance] = await db.insert(agentInsurance).values({
      agentId,
      ownerId,
      tier,
      coverageAmount: String(coverageAmount),
      deductible: String(deductible),
      monthlyPremium: String(monthlyPremium),
      coveredEvents: tierConfig.coveredEvents,
      exclusions: ["intentional_damage", "fraudulent_activity", "pre_existing_issues"],
      startDate,
      renewalDate,
      isActive: true,
    }).returning();

    return insurance;
  }

  async getAgentInsurance(agentId: number): Promise<AgentInsurance | null> {
    const [insurance] = await db.select()
      .from(agentInsurance)
      .where(and(
        eq(agentInsurance.agentId, agentId),
        eq(agentInsurance.isActive, true)
      ));
    return insurance || null;
  }

  async getUserInsurances(ownerId: string): Promise<AgentInsurance[]> {
    return db.select()
      .from(agentInsurance)
      .where(eq(agentInsurance.ownerId, ownerId))
      .orderBy(desc(agentInsurance.createdAt));
  }

  async fileClaim(
    insuranceId: number,
    claimantId: string,
    data: {
      claimType: string;
      description: string;
      evidence?: any;
      requestedAmount: number;
      bountyId?: number;
      executionId?: number;
    }
  ): Promise<InsuranceClaim> {
    const [insurance] = await db.select()
      .from(agentInsurance)
      .where(eq(agentInsurance.id, insuranceId));

    if (!insurance) throw new Error("Insurance not found");
    if (!insurance.isActive) throw new Error("Insurance is not active");
    if (!insurance.coveredEvents || !insurance.coveredEvents.includes(data.claimType)) {
      throw new Error("Claim type is not covered by this insurance");
    }

    const maxClaimable = parseFloat(insurance.coverageAmount) - parseFloat(insurance.deductible || "0");
    const actualAmount = Math.min(data.requestedAmount, maxClaimable);

    const [claim] = await db.insert(insuranceClaims).values({
      insuranceId,
      claimantId,
      bountyId: data.bountyId,
      executionId: data.executionId,
      claimType: data.claimType,
      description: data.description,
      evidence: data.evidence ? JSON.stringify(data.evidence) : null,
      requestedAmount: String(actualAmount),
    }).returning();

    await db.update(agentInsurance)
      .set({ claimsCount: sql`${agentInsurance.claimsCount} + 1` })
      .where(eq(agentInsurance.id, insuranceId));

    return claim;
  }

  async reviewClaim(
    claimId: number,
    reviewerId: string,
    decision: "approved" | "rejected",
    approvedAmount?: number,
    notes?: string
  ): Promise<InsuranceClaim> {
    const [claim] = await db.update(insuranceClaims)
      .set({
        status: decision,
        approvedAmount: approvedAmount !== undefined ? String(approvedAmount) : null,
        reviewerNotes: notes,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(insuranceClaims.id, claimId))
      .returning();

    if (decision === "approved" && approvedAmount) {
      const [insurance] = await db.select()
        .from(agentInsurance)
        .where(eq(agentInsurance.id, claim.insuranceId));

      if (insurance) {
        await db.update(agentInsurance)
          .set({
            totalClaimsPaid: sql`COALESCE(${agentInsurance.totalClaimsPaid}, 0) + ${approvedAmount}`,
          })
          .where(eq(agentInsurance.id, insurance.id));
      }
    }

    return claim;
  }

  async payClaim(claimId: number): Promise<InsuranceClaim> {
    const [claim] = await db.update(insuranceClaims)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(insuranceClaims.id, claimId))
      .returning();

    return claim;
  }

  async getClaims(insuranceId?: number, status?: string): Promise<InsuranceClaim[]> {
    const conditions = [];
    if (insuranceId) conditions.push(eq(insuranceClaims.insuranceId, insuranceId));
    if (status) conditions.push(eq(insuranceClaims.status, status as any));

    return db.select()
      .from(insuranceClaims)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(insuranceClaims.submittedAt));
  }

  async tokenizeAgent(
    agentId: number,
    data: {
      tokenSymbol: string;
      tokenName: string;
      totalSupply: number;
      pricePerToken: number;
      royaltyPercent?: number;
      network?: "ethereum" | "polygon" | "arbitrum";
    }
  ): Promise<AgentToken> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
    if (!agent) throw new Error("Agent not found");

    const existingToken = await db.select()
      .from(agentTokens)
      .where(eq(agentTokens.agentId, agentId));
    if (existingToken.length > 0) throw new Error("Agent is already tokenized");

    const contractAddress = `0x${crypto.randomBytes(20).toString("hex")}`;

    const [token] = await db.insert(agentTokens).values({
      agentId,
      tokenSymbol: data.tokenSymbol.toUpperCase(),
      tokenName: data.tokenName,
      totalSupply: String(data.totalSupply),
      pricePerToken: String(data.pricePerToken),
      royaltyPercent: String(data.royaltyPercent || 5),
      network: data.network || "polygon",
      contractAddress,
      isListed: false,
    }).returning();

    await db.insert(tokenHoldings).values({
      tokenId: token.id,
      holderId: agent.developerId,
      balance: String(data.totalSupply),
      averageBuyPrice: String(data.pricePerToken),
      totalInvested: String(data.totalSupply * data.pricePerToken),
    });

    return token;
  }

  async listToken(tokenId: number): Promise<AgentToken> {
    const [token] = await db.update(agentTokens)
      .set({ isListed: true, updatedAt: new Date() })
      .where(eq(agentTokens.id, tokenId))
      .returning();

    return token;
  }

  async buyTokens(
    tokenId: number,
    buyerId: string,
    amount: number
  ): Promise<TokenHolding> {
    const [token] = await db.select()
      .from(agentTokens)
      .where(eq(agentTokens.id, tokenId));

    if (!token) throw new Error("Token not found");
    if (!token.isListed) throw new Error("Token is not listed for trading");

    const pricePerToken = parseFloat(token.pricePerToken || "0.01");
    const totalCost = amount * pricePerToken;

    const [existingHolding] = await db.select()
      .from(tokenHoldings)
      .where(and(
        eq(tokenHoldings.tokenId, tokenId),
        eq(tokenHoldings.holderId, buyerId)
      ));

    if (existingHolding) {
      const newBalance = parseFloat(existingHolding.balance) + amount;
      const newInvested = parseFloat(existingHolding.totalInvested || "0") + totalCost;
      const newAvgPrice = newInvested / newBalance;

      const [updated] = await db.update(tokenHoldings)
        .set({
          balance: String(newBalance),
          totalInvested: String(newInvested),
          averageBuyPrice: String(newAvgPrice),
          updatedAt: new Date(),
        })
        .where(eq(tokenHoldings.id, existingHolding.id))
        .returning();

      return updated;
    }

    const [holding] = await db.insert(tokenHoldings).values({
      tokenId,
      holderId: buyerId,
      balance: String(amount),
      averageBuyPrice: String(pricePerToken),
      totalInvested: String(totalCost),
    }).returning();

    await db.update(agentTokens)
      .set({
        circulatingSupply: sql`COALESCE(${agentTokens.circulatingSupply}, 0) + ${amount}`,
        marketCap: sql`COALESCE(${agentTokens.circulatingSupply}, 0) * ${pricePerToken}`,
        updatedAt: new Date(),
      })
      .where(eq(agentTokens.id, tokenId));

    return holding;
  }

  async sellTokens(
    tokenId: number,
    sellerId: string,
    amount: number
  ): Promise<TokenHolding> {
    const [holding] = await db.select()
      .from(tokenHoldings)
      .where(and(
        eq(tokenHoldings.tokenId, tokenId),
        eq(tokenHoldings.holderId, sellerId)
      ));

    if (!holding) throw new Error("No holdings found");
    if (parseFloat(holding.balance) < amount) throw new Error("Insufficient balance");

    const newBalance = parseFloat(holding.balance) - amount;

    const [updated] = await db.update(tokenHoldings)
      .set({
        balance: String(newBalance),
        updatedAt: new Date(),
      })
      .where(eq(tokenHoldings.id, holding.id))
      .returning();

    return updated;
  }

  async getAgentToken(agentId: number): Promise<AgentToken | null> {
    const [token] = await db.select()
      .from(agentTokens)
      .where(eq(agentTokens.agentId, agentId));
    return token || null;
  }

  async getUserHoldings(userId: string): Promise<(TokenHolding & { token: AgentToken })[]> {
    const result = await db.select()
      .from(tokenHoldings)
      .innerJoin(agentTokens, eq(tokenHoldings.tokenId, agentTokens.id))
      .where(eq(tokenHoldings.holderId, userId));

    return result.map(r => ({
      ...r.token_holdings,
      token: r.agent_tokens,
    }));
  }

  async getTokenHolders(tokenId: number): Promise<TokenHolding[]> {
    return db.select()
      .from(tokenHoldings)
      .where(eq(tokenHoldings.tokenId, tokenId))
      .orderBy(desc(tokenHoldings.balance));
  }

  async distributeRoyalties(tokenId: number, amount: number): Promise<void> {
    const [token] = await db.select()
      .from(agentTokens)
      .where(eq(agentTokens.id, tokenId));

    if (!token) throw new Error("Token not found");

    const holdings = await this.getTokenHolders(tokenId);
    const totalSupply = parseFloat(token.totalSupply);

    for (const holding of holdings) {
      const share = parseFloat(holding.balance) / totalSupply;
      const royalty = amount * share;

      await db.update(tokenHoldings)
        .set({
          royaltiesEarned: sql`COALESCE(${tokenHoldings.royaltiesEarned}, 0) + ${royalty}`,
          updatedAt: new Date(),
        })
        .where(eq(tokenHoldings.id, holding.id));
    }
  }

  async getListedTokens(): Promise<AgentToken[]> {
    return db.select()
      .from(agentTokens)
      .where(eq(agentTokens.isListed, true))
      .orderBy(desc(agentTokens.marketCap));
  }

  getInsuranceTiers(): InsuranceTierConfig[] {
    return INSURANCE_TIERS;
  }
}

export const insuranceTokenService = new InsuranceTokenService();
