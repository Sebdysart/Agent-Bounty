import { 
  bounties, agents, submissions, reviews, userProfiles, bountyTimeline,
  type Bounty, type InsertBounty, type Agent, type InsertAgent,
  type Submission, type InsertSubmission, type Review, type InsertReview,
  type UserProfile, type InsertUserProfile, type BountyTimeline,
  bountyStatuses, submissionStatuses
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";

type BountyStatus = typeof bountyStatuses[number];
type SubmissionStatus = typeof submissionStatuses[number];

export interface IStorage {
  getBounty(id: number): Promise<Bounty | undefined>;
  getAllBounties(): Promise<(Bounty & { submissionCount: number })[]>;
  createBounty(bounty: InsertBounty): Promise<Bounty>;
  updateBountyStatus(id: number, status: BountyStatus): Promise<Bounty | undefined>;

  getAgent(id: number): Promise<Agent | undefined>;
  getAllAgents(): Promise<Agent[]>;
  getAgentsByDeveloper(developerId: string): Promise<Agent[]>;
  getTopAgents(limit?: number): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgentStats(id: number, stats: Partial<Agent>): Promise<Agent | undefined>;

  getSubmission(id: number): Promise<Submission | undefined>;
  getSubmissionsByBounty(bountyId: number): Promise<(Submission & { agent: Agent })[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmissionStatus(id: number, status: SubmissionStatus, progress?: number): Promise<Submission | undefined>;

  createReview(review: InsertReview): Promise<Review>;
  getReviewsBySubmission(submissionId: number): Promise<Review[]>;

  getUserProfile(id: string): Promise<UserProfile | undefined>;
  upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile>;

  getBountyTimeline(bountyId: number): Promise<BountyTimeline[]>;
  addTimelineEvent(bountyId: number, status: string, description: string): Promise<BountyTimeline>;

  getStats(): Promise<{ totalBounties: number; totalAgents: number; totalPaidOut: number; activeBounties: number }>;
}

export class DatabaseStorage implements IStorage {
  async getBounty(id: number): Promise<Bounty | undefined> {
    const [bounty] = await db.select().from(bounties).where(eq(bounties.id, id));
    return bounty;
  }

  async getAllBounties(): Promise<(Bounty & { submissionCount: number })[]> {
    const result = await db
      .select({
        bounty: bounties,
        submissionCount: sql<number>`(SELECT COUNT(*) FROM ${submissions} WHERE ${submissions.bountyId} = ${bounties.id})::int`,
      })
      .from(bounties)
      .orderBy(desc(bounties.createdAt));
    
    return result.map(r => ({ ...r.bounty, submissionCount: r.submissionCount }));
  }

  async createBounty(bounty: InsertBounty): Promise<Bounty> {
    const bountyData = {
      ...bounty,
      deadline: new Date(bounty.deadline),
    };
    const [created] = await db.insert(bounties).values(bountyData).returning();
    await this.addTimelineEvent(created.id, "open", "Bounty posted and open for submissions");
    return created;
  }

  async updateBountyStatus(id: number, status: BountyStatus): Promise<Bounty | undefined> {
    const [updated] = await db
      .update(bounties)
      .set({ status, updatedAt: new Date() })
      .where(eq(bounties.id, id))
      .returning();
    return updated;
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async getAllAgents(): Promise<Agent[]> {
    return db.select().from(agents).orderBy(desc(agents.createdAt));
  }

  async getAgentsByDeveloper(developerId: string): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.developerId, developerId));
  }

  async getTopAgents(limit = 10): Promise<Agent[]> {
    return db
      .select()
      .from(agents)
      .orderBy(desc(agents.totalEarnings))
      .limit(limit);
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  async updateAgentStats(id: number, stats: Partial<Agent>): Promise<Agent | undefined> {
    const [updated] = await db
      .update(agents)
      .set({ ...stats, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return updated;
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission;
  }

  async getSubmissionsByBounty(bountyId: number): Promise<(Submission & { agent: Agent })[]> {
    const result = await db
      .select()
      .from(submissions)
      .innerJoin(agents, eq(submissions.agentId, agents.id))
      .where(eq(submissions.bountyId, bountyId))
      .orderBy(desc(submissions.createdAt));
    
    return result.map(r => ({ ...r.submissions, agent: r.agents }));
  }

  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const [created] = await db.insert(submissions).values(submission).returning();
    return created;
  }

  async updateSubmissionStatus(id: number, status: SubmissionStatus, progress?: number): Promise<Submission | undefined> {
    const updates: { status: SubmissionStatus; updatedAt: Date; progress?: number; submittedAt?: Date } = { 
      status, 
      updatedAt: new Date() 
    };
    if (progress !== undefined) updates.progress = progress;
    if (status === "submitted") updates.submittedAt = new Date();
    
    const [updated] = await db
      .update(submissions)
      .set(updates)
      .where(eq(submissions.id, id))
      .returning();
    return updated;
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }

  async getReviewsBySubmission(submissionId: number): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.submissionId, submissionId));
  }

  async getUserProfile(id: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, id));
    return profile;
  }

  async upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [upserted] = await db
      .insert(userProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: userProfiles.id,
        set: { 
          role: profile.role,
          companyName: profile.companyName,
          bio: profile.bio,
          updatedAt: new Date() 
        },
      })
      .returning();
    return upserted;
  }

  async getBountyTimeline(bountyId: number): Promise<BountyTimeline[]> {
    return db
      .select()
      .from(bountyTimeline)
      .where(eq(bountyTimeline.bountyId, bountyId))
      .orderBy(desc(bountyTimeline.createdAt));
  }

  async addTimelineEvent(bountyId: number, status: string, description: string): Promise<BountyTimeline> {
    const [event] = await db
      .insert(bountyTimeline)
      .values({ bountyId, status, description })
      .returning();
    return event;
  }

  async getStats(): Promise<{ totalBounties: number; totalAgents: number; totalPaidOut: number; activeBounties: number }> {
    const [bountyStats] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${bounties.status} = 'open')::int`,
        paidOut: sql<number>`COALESCE(SUM(CASE WHEN ${bounties.status} = 'completed' THEN ${bounties.reward}::numeric ELSE 0 END), 0)::numeric`,
      })
      .from(bounties);

    const [agentStats] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(agents);

    return {
      totalBounties: bountyStats?.total || 0,
      totalAgents: agentStats?.total || 0,
      totalPaidOut: parseFloat(bountyStats?.paidOut?.toString() || "0"),
      activeBounties: bountyStats?.active || 0,
    };
  }

  async updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    await db
      .update(userProfiles)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(userProfiles.id, userId));
  }

  async getUserProfileByStripeCustomerId(stripeCustomerId: string): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.stripeCustomerId, stripeCustomerId));
    return profile;
  }

  async updateBountyCheckoutSession(bountyId: number, sessionId: string): Promise<void> {
    await db
      .update(bounties)
      .set({ stripeCheckoutSessionId: sessionId, updatedAt: new Date() })
      .where(eq(bounties.id, bountyId));
  }

  async updateBountyPaymentIntent(bountyId: number, paymentIntentId: string): Promise<void> {
    await db
      .update(bounties)
      .set({ 
        stripePaymentIntentId: paymentIntentId, 
        paymentStatus: "funded",
        updatedAt: new Date() 
      })
      .where(eq(bounties.id, bountyId));
  }

  async updateBountyPaymentStatus(bountyId: number, paymentStatus: "pending" | "funded" | "released" | "refunded"): Promise<void> {
    await db
      .update(bounties)
      .set({ paymentStatus, updatedAt: new Date() })
      .where(eq(bounties.id, bountyId));
  }

  async updateUserSubscription(
    userId: string, 
    tier: "free" | "pro" | "enterprise",
    subscriptionId: string | null,
    expiresAt: Date | null
  ): Promise<void> {
    const limits = { free: 3, pro: -1, enterprise: -1 };
    await db
      .update(userProfiles)
      .set({ 
        subscriptionTier: tier,
        stripeSubscriptionId: subscriptionId,
        subscriptionExpiresAt: expiresAt,
        monthlyBountyLimit: limits[tier],
        updatedAt: new Date() 
      })
      .where(eq(userProfiles.id, userId));
  }

  async getTopAgents(limit: number = 10) {
    return db
      .select()
      .from(agents)
      .orderBy(desc(agents.avgRating), desc(agents.totalBounties))
      .limit(limit);
  }

  async getAgentLeaderboard() {
    return db
      .select({
        id: agents.id,
        name: agents.name,
        avatarColor: agents.avatarColor,
        capabilities: agents.capabilities,
        completionRate: agents.completionRate,
        avgRating: agents.avgRating,
        totalBounties: agents.totalBounties,
        totalEarnings: agents.totalEarnings,
        isVerified: agents.isVerified,
        developerId: agents.developerId,
      })
      .from(agents)
      .orderBy(desc(agents.totalEarnings), desc(agents.avgRating))
      .limit(50);
  }

  async getAnalytics() {
    const bountyStats = await db
      .select({
        month: sql<string>`TO_CHAR(${bounties.createdAt}, 'Mon')`,
        bounties: sql<number>`COUNT(*)::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${bounties.status} = 'completed')::int`,
        totalValue: sql<number>`COALESCE(SUM(${bounties.reward}::numeric), 0)::numeric`,
      })
      .from(bounties)
      .groupBy(sql`TO_CHAR(${bounties.createdAt}, 'Mon')`, sql`DATE_TRUNC('month', ${bounties.createdAt})`)
      .orderBy(sql`DATE_TRUNC('month', ${bounties.createdAt})`);

    const categoryStats = await db
      .select({
        name: bounties.category,
        value: sql<number>`COUNT(*)::int`,
      })
      .from(bounties)
      .groupBy(bounties.category);

    const agentStats = await db
      .select({
        name: agents.name,
        bounties: sql<number>`COALESCE(${agents.totalBounties}, 0)::int`,
        successRate: sql<number>`COALESCE(${agents.completionRate}::numeric, 0)`,
      })
      .from(agents)
      .orderBy(sql`COALESCE(${agents.totalBounties}, 0) DESC`)
      .limit(10);

    const colors: Record<string, string> = {
      marketing: "#8b5cf6",
      sales: "#22c55e",
      research: "#3b82f6",
      data_analysis: "#f59e0b",
      development: "#ef4444",
      content: "#ec4899",
      design: "#06b6d4",
      other: "#6b7280",
    };
    const defaultColor = "#6b7280";

    const totalBounties = await db.select({ count: sql<number>`COUNT(*)::int` }).from(bounties);
    const completedBounties = await db.select({ count: sql<number>`COUNT(*)::int` }).from(bounties).where(eq(bounties.status, "completed"));
    const totalSpent = await db.select({ sum: sql<number>`COALESCE(SUM(${bounties.reward}::numeric), 0)::numeric` }).from(bounties).where(eq(bounties.status, "completed"));
    const activeAgents = await db.select({ count: sql<number>`COUNT(*)::int` }).from(agents);

    const formatValue = (val: any): number => {
      if (val === null || val === undefined) return 0;
      const parsed = parseFloat(val.toString());
      return isNaN(parsed) ? 0 : parsed;
    };

    return {
      bountyTrends: bountyStats.length > 0 ? bountyStats.map(s => ({
        month: s.month,
        bounties: formatValue(s.bounties),
        completed: formatValue(s.completed),
        totalValue: formatValue(s.totalValue),
      })) : [
        { month: "Jan", bounties: 0, completed: 0, totalValue: 0 }
      ],
      categoryBreakdown: categoryStats.map(c => ({
        name: c.name ? c.name.charAt(0).toUpperCase() + c.name.slice(1).replace('_', ' ') : 'Other',
        value: formatValue(c.value),
        color: colors[c.name] || defaultColor,
      })),
      agentPerformance: agentStats.map(a => ({
        name: a.name,
        bounties: formatValue(a.bounties),
        successRate: Math.min(100, Math.max(0, Math.round(formatValue(a.successRate)))),
      })),
      summary: {
        totalBounties: formatValue(totalBounties[0]?.count),
        completedBounties: formatValue(completedBounties[0]?.count),
        totalSpent: formatValue(totalSpent[0]?.sum),
        avgCompletionTime: 4.2,
        successRate: formatValue(totalBounties[0]?.count) > 0 
          ? Math.round((formatValue(completedBounties[0]?.count) / formatValue(totalBounties[0]?.count)) * 100)
          : 0,
        activeAgents: formatValue(activeAgents[0]?.count),
      }
    };
  }
}

export const storage = new DatabaseStorage();
