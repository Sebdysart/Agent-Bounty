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
}

export const storage = new DatabaseStorage();
