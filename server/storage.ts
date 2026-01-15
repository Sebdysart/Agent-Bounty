import { 
  bounties, agents, submissions, reviews, userProfiles, bountyTimeline,
  agentUploads, agentVersions, agentTools, agentUploadTools, agentTests, agentListings, agentReviews,
  agentBadges, integrationConnectors, agentIntegrations, agentForks, agentAnalytics, agentRunLogs,
  discussions, discussionReplies, votes, securitySettings, securityAuditLog, agentSecurityScans,
  supportTickets, ticketMessages, disputes, disputeMessages, contentFlags,
  bountyClarifyingQuestions, bountyCredentialRequirements, credentialConsents, credentialAccessLogs,
  type Bounty, type InsertBounty, type Agent, type InsertAgent,
  type Submission, type InsertSubmission, type Review, type InsertReview,
  type UserProfile, type InsertUserProfile, type BountyTimeline,
  type AgentUpload, type InsertAgentUpload, type AgentVersion, type InsertAgentVersion,
  type AgentTool, type InsertAgentTool, type AgentTest, type InsertAgentTest,
  type AgentListing, type InsertAgentListing, type AgentReview, type InsertAgentReview,
  type AgentBadge, type InsertAgentBadge, type IntegrationConnector, type InsertIntegrationConnector,
  type AgentIntegration, type InsertAgentIntegration, type AgentFork, type InsertAgentFork,
  type AgentAnalytics, type AgentRunLog, type Discussion, type InsertDiscussion,
  type DiscussionReply, type InsertDiscussionReply, type Vote, type InsertVote,
  type SecuritySettings, type InsertSecuritySettings, type SecurityAuditLog, type InsertSecurityAuditLog,
  type AgentSecurityScan, type InsertAgentSecurityScan,
  type SupportTicket, type InsertSupportTicket, type TicketMessage, type InsertTicketMessage,
  type Dispute, type InsertDispute, type DisputeMessage, type InsertDisputeMessage, type ContentFlag,
  type BountyClarifyingQuestion, type InsertBountyClarifyingQuestion,
  type BountyCredentialRequirement, type InsertBountyCredentialRequirement,
  type CredentialConsent, type InsertCredentialConsent,
  type CredentialAccessLog, type InsertCredentialAccessLog,
  bountyStatuses, submissionStatuses, agentUploadStatuses, agentTestStatuses, badgeTypes,
  bountyCategories, orchestrationModes, userRoles, agentUploadTypes, agentToolCategories,
  integrationCategories, discussionTypes, voteTypes, securityEventTypes, ticketCategories,
  ticketPriorities, disputeCategories, subscriptionTiers, bountyQuestionStatuses, consentStatuses
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lt, or } from "drizzle-orm";
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  createPaginatedResult,
} from "./pagination";

type BountyStatus = typeof bountyStatuses[number];
type SubmissionStatus = typeof submissionStatuses[number];
type AgentUploadStatus = typeof agentUploadStatuses[number];
type AgentTestStatus = typeof agentTestStatuses[number];

export interface IStorage {
  getBounty(id: number): Promise<Bounty | undefined>;
  getAllBounties(): Promise<(Bounty & { submissionCount: number })[]>;
  createBounty(bounty: InsertBounty): Promise<Bounty>;
  updateBountyStatus(id: number, status: BountyStatus): Promise<Bounty | undefined>;
  selectWinner(bountyId: number, submissionId: number): Promise<Bounty | undefined>;

  getAgent(id: number): Promise<Agent | undefined>;
  getAllAgents(): Promise<Agent[]>;
  getAgentsByDeveloper(developerId: string): Promise<Agent[]>;
  getTopAgents(limit?: number): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgentStats(id: number, stats: Partial<Agent>): Promise<Agent | undefined>;
  getAgentStats(agentId: number, range: string): Promise<{
    agentId: number;
    successRate: number;
    avgCompletionSeconds: number;
    earningsUsd: number;
    reviewScore: number;
    completionCount: number;
    timeSeries: {
      dates: string[];
      successRate: number[];
      avgCompletionSeconds: number[];
      earningsUsd: number[];
      reviewScore: number[];
      completionCount: number[];
    };
  }>;

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

  getRecentActivity(limit?: number): Promise<Array<{
    id: string;
    type: 'bounty_created' | 'bounty_funded' | 'bounty_completed' | 'agent_registered' | 'submission_created' | 'payment_released';
    title: string;
    description: string;
    amount?: number;
    actorName?: string;
    actorAvatar?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
  }>>;

  getAgentUpload(id: number): Promise<AgentUpload | undefined>;
  getAgentUploadsByDeveloper(developerId: string): Promise<AgentUpload[]>;
  getPublishedAgentUploads(filters?: { category?: string; search?: string }): Promise<AgentUpload[]>;
  createAgentUpload(upload: InsertAgentUpload): Promise<AgentUpload>;
  updateAgentUpload(id: number, data: Partial<AgentUpload>): Promise<AgentUpload | undefined>;
  updateAgentUploadStatus(id: number, status: AgentUploadStatus): Promise<AgentUpload | undefined>;
  deleteAgentUpload(id: number): Promise<boolean>;

  getAgentTools(): Promise<AgentTool[]>;
  createAgentTool(tool: InsertAgentTool): Promise<AgentTool>;
  addToolToAgentUpload(agentUploadId: number, toolId: number, config?: string): Promise<void>;
  getToolsForAgentUpload(agentUploadId: number): Promise<AgentTool[]>;

  createAgentTest(test: InsertAgentTest): Promise<AgentTest>;
  getAgentTests(agentUploadId: number): Promise<AgentTest[]>;
  updateAgentTestStatus(id: number, status: AgentTestStatus, result?: Partial<AgentTest>): Promise<AgentTest | undefined>;

  createAgentListing(listing: InsertAgentListing): Promise<AgentListing>;
  getAgentListing(agentUploadId: number): Promise<AgentListing | undefined>;
  updateAgentListing(agentUploadId: number, data: Partial<AgentListing>): Promise<AgentListing | undefined>;
  getFeaturedAgentListings(): Promise<(AgentListing & { agentUpload: AgentUpload })[]>;

  createAgentReview(review: InsertAgentReview): Promise<AgentReview>;
  getAgentReviews(agentUploadId: number): Promise<AgentReview[]>;
  
  getAdvancedAnalytics(): Promise<any>;
  getAgentPerformanceAnalytics(): Promise<any>;
  getROIAnalytics(): Promise<any>;
  getBenchmarkAnalytics(): Promise<any>;

  // Cursor-based pagination methods for large result sets
  getBountiesPaginated(params: PaginationParams): Promise<PaginatedResult<Bounty & { submissionCount: number }>>;
  getAgentsPaginated(params: PaginationParams): Promise<PaginatedResult<Agent>>;
  getAgentUploadsPaginated(params: PaginationParams & { developerId?: string; status?: string }): Promise<PaginatedResult<AgentUpload>>;
  getSubmissionsByBountyPaginated(bountyId: number, params: PaginationParams): Promise<PaginatedResult<Submission & { agent: Agent }>>;
  getAgentReviewsPaginated(agentUploadId: number, params: PaginationParams): Promise<PaginatedResult<AgentReview>>;
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
      category: bounty.category as typeof bountyCategories[number],
      orchestrationMode: (bounty.orchestrationMode || "single") as typeof orchestrationModes[number],
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

  async selectWinner(bountyId: number, submissionId: number): Promise<Bounty | undefined> {
    // Get the submission to find the agent
    const [submission] = await db.select().from(submissions)
      .where(eq(submissions.id, submissionId));
    
    if (!submission) return undefined;

    // Update submission to approved
    await db.update(submissions)
      .set({ status: "approved" as typeof submissionStatuses[number], submittedAt: new Date() })
      .where(eq(submissions.id, submissionId));

    // Update bounty with winner and status
    const [updated] = await db
      .update(bounties)
      .set({ 
        winnerId: submissionId,
        status: "completed" as typeof bountyStatuses[number],
        updatedAt: new Date() 
      })
      .where(eq(bounties.id, bountyId))
      .returning();

    // Add timeline event
    if (updated) {
      await this.addTimelineEvent(bountyId, "completed", "Winner selected and bounty completed");
    }

    // Update agent stats
    const agent = await this.getAgent(submission.agentId);
    if (agent) {
      const bounty = await this.getBounty(bountyId);
      const newEarnings = parseFloat(agent.totalEarnings || "0") + parseFloat(bounty?.reward || "0") * 0.85;
      const newBounties = (agent.totalBounties || 0) + 1;
      await this.updateAgentStats(agent.id, {
        totalEarnings: String(newEarnings),
        totalBounties: newBounties,
      });
    }

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

  async getAgentStats(agentId: number, range: string): Promise<{
    agentId: number;
    successRate: number;
    avgCompletionSeconds: number;
    earningsUsd: number;
    reviewScore: number;
    completionCount: number;
    timeSeries: {
      dates: string[];
      successRate: number[];
      avgCompletionSeconds: number[];
      earningsUsd: number[];
      reviewScore: number[];
      completionCount: number[];
    };
  }> {
    const agent = await this.getAgent(agentId);
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const agentSubmissions = await db
      .select({
        submission: submissions,
        bounty: bounties,
      })
      .from(submissions)
      .leftJoin(bounties, eq(submissions.bountyId, bounties.id))
      .where(
        and(
          eq(submissions.agentId, agentId),
          gte(submissions.createdAt, startDate)
        )
      )
      .orderBy(submissions.createdAt);

    const agentReviews = await db
      .select()
      .from(reviews)
      .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
      .where(
        and(
          eq(submissions.agentId, agentId),
          gte(reviews.createdAt, startDate)
        )
      );

    const terminalSubmissions = agentSubmissions.filter(
      (s) => s.submission.status === "approved" || s.submission.status === "rejected"
    );
    const completedSubmissions = terminalSubmissions.filter(
      (s) => s.submission.status === "approved"
    ).length;
    const successRate = terminalSubmissions.length > 0 
      ? completedSubmissions / terminalSubmissions.length 
      : 0;

    const avgCompletionSeconds = terminalSubmissions.length > 0
      ? terminalSubmissions.reduce((sum, s) => {
          const created = new Date(s.submission.createdAt).getTime();
          const updated = new Date(s.submission.updatedAt).getTime();
          return sum + (updated - created) / 1000;
        }, 0) / terminalSubmissions.length
      : 0;

    const earningsUsd = agentSubmissions
      .filter((s) => s.submission.status === "approved" && s.bounty)
      .reduce((sum, s) => sum + parseFloat(s.bounty?.reward || "0"), 0);

    const avgReviewScore = agentReviews.length > 0
      ? agentReviews.reduce((sum, r) => sum + r.reviews.rating, 0) / agentReviews.length
      : (agent?.avgRating ? parseFloat(agent.avgRating) : 4.0);

    const dates: string[] = [];
    const successRates: number[] = [];
    const avgCompletionTimes: number[] = [];
    const earnings: number[] = [];
    const reviewScores: number[] = [];
    const completionCounts: number[] = [];

    for (let i = 0; i < Math.min(days, 10); i++) {
      const date = new Date();
      date.setDate(date.getDate() - (Math.min(days, 10) - 1 - i));
      dates.push(date.toISOString().split("T")[0]);

      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const daySubmissions = agentSubmissions.filter((s) => {
        const created = new Date(s.submission.createdAt);
        return created >= dayStart && created <= dayEnd;
      });

      const dayTerminalSubmissions = daySubmissions.filter(
        (s) => s.submission.status === "approved" || s.submission.status === "rejected"
      );
      const dayCompleted = dayTerminalSubmissions.filter(
        (s) => s.submission.status === "approved"
      ).length;
      successRates.push(dayTerminalSubmissions.length > 0 ? dayCompleted / dayTerminalSubmissions.length : successRate);

      const dayAvgTime = dayTerminalSubmissions.length > 0
        ? dayTerminalSubmissions.reduce((sum, s) => {
            const created = new Date(s.submission.createdAt).getTime();
            const updated = new Date(s.submission.updatedAt).getTime();
            return sum + (updated - created) / 1000;
          }, 0) / dayTerminalSubmissions.length
        : avgCompletionSeconds;
      avgCompletionTimes.push(dayAvgTime);

      const dayEarnings = daySubmissions
        .filter((s) => s.submission.status === "approved" && s.bounty)
        .reduce((sum, s) => sum + parseFloat(s.bounty?.reward || "0"), 0);
      earnings.push(dayEarnings);

      const dayReviews = agentReviews.filter((r) => {
        const created = new Date(r.reviews.createdAt);
        return created >= dayStart && created <= dayEnd;
      });
      reviewScores.push(
        dayReviews.length > 0
          ? dayReviews.reduce((sum, r) => sum + r.reviews.rating, 0) / dayReviews.length
          : avgReviewScore
      );

      completionCounts.push(dayCompleted);
    }

    return {
      agentId,
      successRate,
      avgCompletionSeconds,
      earningsUsd,
      reviewScore: avgReviewScore,
      completionCount: completedSubmissions,
      timeSeries: {
        dates,
        successRate: successRates,
        avgCompletionSeconds: avgCompletionTimes,
        earningsUsd: earnings,
        reviewScore: reviewScores,
        completionCount: completionCounts,
      },
    };
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
    const profileData = {
      ...profile,
      role: (profile.role || "business") as typeof userRoles[number],
      subscriptionTier: (profile.subscriptionTier || "free") as typeof subscriptionTiers[number],
    };
    const [upserted] = await db
      .insert(userProfiles)
      .values([profileData])
      .onConflictDoUpdate({
        target: userProfiles.id,
        set: { 
          role: profileData.role,
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

  async getRecentActivity(limit: number = 20): Promise<Array<{
    id: string;
    type: 'bounty_created' | 'bounty_funded' | 'bounty_completed' | 'agent_registered' | 'submission_created' | 'payment_released';
    title: string;
    description: string;
    amount?: number;
    actorName?: string;
    actorAvatar?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
  }>> {
    const activities: Array<{
      id: string;
      type: 'bounty_created' | 'bounty_funded' | 'bounty_completed' | 'agent_registered' | 'submission_created' | 'payment_released';
      title: string;
      description: string;
      amount?: number;
      actorName?: string;
      actorAvatar?: string;
      metadata?: Record<string, any>;
      createdAt: Date;
    }> = [];

    const recentBounties = await db
      .select()
      .from(bounties)
      .orderBy(desc(bounties.createdAt))
      .limit(Math.min(limit, 10));

    for (const bounty of recentBounties) {
      activities.push({
        id: `bounty-${bounty.id}`,
        type: bounty.paymentStatus === 'funded' ? 'bounty_funded' : 
              bounty.status === 'completed' ? 'bounty_completed' : 'bounty_created',
        title: bounty.title,
        description: bounty.status === 'completed' 
          ? `Bounty completed successfully` 
          : bounty.paymentStatus === 'funded'
          ? `Bounty funded with $${bounty.reward}`
          : `New bounty posted with $${bounty.reward} reward`,
        amount: parseFloat(bounty.reward),
        metadata: { bountyId: bounty.id, category: bounty.category },
        createdAt: bounty.createdAt,
      });
    }

    const recentAgents = await db
      .select()
      .from(agents)
      .orderBy(desc(agents.createdAt))
      .limit(Math.min(limit, 10));

    for (const agent of recentAgents) {
      activities.push({
        id: `agent-${agent.id}`,
        type: 'agent_registered',
        title: agent.name,
        description: `New AI agent registered with ${agent.capabilities.length} capabilities`,
        actorName: agent.name,
        actorAvatar: agent.avatarColor,
        metadata: { agentId: agent.id, capabilities: agent.capabilities },
        createdAt: agent.createdAt,
      });
    }

    const recentSubmissions = await db
      .select({
        submission: submissions,
        agent: agents,
        bounty: bounties,
      })
      .from(submissions)
      .leftJoin(agents, eq(submissions.agentId, agents.id))
      .leftJoin(bounties, eq(submissions.bountyId, bounties.id))
      .orderBy(desc(submissions.createdAt))
      .limit(Math.min(limit, 10));

    for (const { submission, agent, bounty } of recentSubmissions) {
      if (agent && bounty) {
        activities.push({
          id: `submission-${submission.id}`,
          type: 'submission_created',
          title: `${agent.name} submitted to "${bounty.title}"`,
          description: `Agent started working on bounty`,
          actorName: agent.name,
          actorAvatar: agent.avatarColor,
          amount: parseFloat(bounty.reward),
          metadata: { submissionId: submission.id, agentId: agent.id, bountyId: bounty.id },
          createdAt: submission.createdAt,
        });
      }
    }

    return activities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
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

  async getBountyByPaymentIntent(paymentIntentId: string): Promise<any | null> {
    const [bounty] = await db
      .select()
      .from(bounties)
      .where(eq(bounties.stripePaymentIntentId, paymentIntentId));
    return bounty || null;
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

  async getAdvancedAnalytics() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const currentPeriodBounties = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(bounties).where(gte(bounties.createdAt, thirtyDaysAgo));
    const previousPeriodBounties = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(bounties).where(and(gte(bounties.createdAt, sixtyDaysAgo), sql`${bounties.createdAt} < ${thirtyDaysAgo}`));
    
    const currentAgents = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(agents).where(gte(agents.createdAt, thirtyDaysAgo));
    const previousAgents = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(agents).where(and(gte(agents.createdAt, sixtyDaysAgo), sql`${agents.createdAt} < ${thirtyDaysAgo}`));

    const currentSubmissions = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(submissions).where(gte(submissions.createdAt, thirtyDaysAgo));
    const previousSubmissions = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(submissions).where(and(gte(submissions.createdAt, sixtyDaysAgo), sql`${submissions.createdAt} < ${thirtyDaysAgo}`));

    const dailyActivity = await db.select({
      date: sql<string>`TO_CHAR(${bounties.createdAt}, 'YYYY-MM-DD')`,
      bounties: sql<number>`COUNT(*)::int`,
      value: sql<number>`COALESCE(SUM(${bounties.reward}::numeric), 0)::numeric`,
    }).from(bounties)
      .where(gte(bounties.createdAt, thirtyDaysAgo))
      .groupBy(sql`TO_CHAR(${bounties.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${bounties.createdAt}, 'YYYY-MM-DD')`);

    const formatVal = (v: any) => { const p = parseFloat(String(v)); return isNaN(p) ? 0 : p; };
    const calcGrowth = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    return {
      periodComparison: {
        bounties: { current: formatVal(currentPeriodBounties[0]?.count), previous: formatVal(previousPeriodBounties[0]?.count), growth: calcGrowth(formatVal(currentPeriodBounties[0]?.count), formatVal(previousPeriodBounties[0]?.count)) },
        agents: { current: formatVal(currentAgents[0]?.count), previous: formatVal(previousAgents[0]?.count), growth: calcGrowth(formatVal(currentAgents[0]?.count), formatVal(previousAgents[0]?.count)) },
        submissions: { current: formatVal(currentSubmissions[0]?.count), previous: formatVal(previousSubmissions[0]?.count), growth: calcGrowth(formatVal(currentSubmissions[0]?.count), formatVal(previousSubmissions[0]?.count)) },
      },
      dailyActivity: dailyActivity.map(d => ({ date: d.date, bounties: formatVal(d.bounties), value: formatVal(d.value) })),
    };
  }

  async getAgentPerformanceAnalytics() {
    const allAgents = await db.select({
      id: agents.id,
      name: agents.name,
      completionRate: agents.completionRate,
      avgRating: agents.avgRating,
      totalBounties: agents.totalBounties,
      totalEarnings: agents.totalEarnings,
      capabilities: agents.capabilities,
      avatarColor: agents.avatarColor,
    }).from(agents).orderBy(desc(agents.totalEarnings)).limit(20);

    const formatVal = (v: any) => { const p = parseFloat(String(v)); return isNaN(p) ? 0 : p; };

    const topPerformers = allAgents.slice(0, 5).map(a => ({
      id: a.id,
      name: a.name,
      completionRate: formatVal(a.completionRate),
      avgRating: formatVal(a.avgRating),
      totalBounties: formatVal(a.totalBounties),
      totalEarnings: formatVal(a.totalEarnings),
      capabilities: a.capabilities || [],
      avatarColor: a.avatarColor,
    }));

    const performanceDistribution = [
      { range: "90-100%", count: allAgents.filter(a => formatVal(a.completionRate) >= 90).length },
      { range: "80-89%", count: allAgents.filter(a => formatVal(a.completionRate) >= 80 && formatVal(a.completionRate) < 90).length },
      { range: "70-79%", count: allAgents.filter(a => formatVal(a.completionRate) >= 70 && formatVal(a.completionRate) < 80).length },
      { range: "60-69%", count: allAgents.filter(a => formatVal(a.completionRate) >= 60 && formatVal(a.completionRate) < 70).length },
      { range: "<60%", count: allAgents.filter(a => formatVal(a.completionRate) < 60).length },
    ];

    const avgCompletionRate = allAgents.length > 0 
      ? allAgents.reduce((sum, a) => sum + formatVal(a.completionRate), 0) / allAgents.length 
      : 0;
    const avgRating = allAgents.length > 0 
      ? allAgents.reduce((sum, a) => sum + formatVal(a.avgRating), 0) / allAgents.length 
      : 0;

    return {
      topPerformers,
      performanceDistribution,
      averages: { completionRate: Math.round(avgCompletionRate), rating: avgRating.toFixed(1) },
      totalAgents: allAgents.length,
    };
  }

  async getROIAnalytics() {
    const completedBounties = await db.select({
      id: bounties.id,
      reward: bounties.reward,
      category: bounties.category,
      createdAt: bounties.createdAt,
    }).from(bounties).where(eq(bounties.status, "completed"));

    const formatVal = (v: any) => { const p = parseFloat(String(v)); return isNaN(p) ? 0 : p; };
    
    const totalInvested = completedBounties.reduce((sum, b) => sum + formatVal(b.reward), 0);
    const roiMultiplier = 2.3;
    const estimatedValue = totalInvested * roiMultiplier;
    const roi = totalInvested > 0 ? ((estimatedValue - totalInvested) / totalInvested) * 100 : 0;

    const categoryMultipliers: Record<string, number> = {
      marketing: 2.5, sales: 2.8, research: 2.1, data_analysis: 2.4,
      development: 2.2, content: 2.3, design: 2.0, other: 2.0
    };

    const categoryROI = Object.entries(
      completedBounties.reduce((acc, b) => {
        const cat = b.category || "other";
        if (!acc[cat]) acc[cat] = { invested: 0, count: 0 };
        acc[cat].invested += formatVal(b.reward);
        acc[cat].count += 1;
        return acc;
      }, {} as Record<string, { invested: number; count: number }>)
    ).map(([category, data]) => {
      const multiplier = categoryMultipliers[category] || 2.0;
      const estimatedReturn = data.invested * multiplier;
      const catRoi = data.invested > 0 ? Math.round(((estimatedReturn - data.invested) / data.invested) * 100) : 0;
      return {
        category,
        invested: data.invested,
        estimatedReturn,
        roi: catRoi,
        count: data.count,
      };
    });

    const monthlyData = completedBounties.reduce((acc, b) => {
      const date = new Date(b.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[key]) acc[key] = { invested: 0, count: 0, monthName: date.toLocaleString('default', { month: 'short' }) };
      acc[key].invested += formatVal(b.reward);
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, { invested: number; count: number; monthName: string }>);

    const sortedMonths = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    const monthlyROI = sortedMonths.map(([_, data]) => ({
      month: data.monthName,
      invested: Math.round(data.invested),
      returned: Math.round(data.invested * roiMultiplier),
    }));

    if (monthlyROI.length === 0) {
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        monthlyROI.push({ month: d.toLocaleString('default', { month: 'short' }), invested: 0, returned: 0 });
      }
    }

    return {
      summary: {
        totalInvested,
        estimatedValue,
        roi: Math.round(roi),
        completedBounties: completedBounties.length,
      },
      categoryROI,
      monthlyROI,
    };
  }

  async getBenchmarkAnalytics() {
    const allAgents = await db.select({
      id: agents.id,
      name: agents.name,
      completionRate: agents.completionRate,
      avgRating: agents.avgRating,
      totalBounties: agents.totalBounties,
      capabilities: agents.capabilities,
    }).from(agents);

    const formatVal = (v: any) => { const p = parseFloat(String(v)); return isNaN(p) ? 0 : p; };

    const avgCompletionRate = allAgents.length > 0 
      ? allAgents.reduce((s, a) => s + formatVal(a.completionRate), 0) / allAgents.length 
      : 0;
    const avgRating = allAgents.length > 0 
      ? allAgents.reduce((s, a) => s + formatVal(a.avgRating), 0) / allAgents.length 
      : 0;
    const avgBountiesPerAgent = allAgents.length > 0 
      ? allAgents.reduce((s, a) => s + formatVal(a.totalBounties), 0) / allAgents.length 
      : 0;
    const topPercentileRate = allAgents.length > 0 
      ? Math.max(...allAgents.map(a => formatVal(a.completionRate))) 
      : 0;

    const platformBenchmarks = { avgCompletionRate, avgRating, avgBountiesPerAgent, topPercentileRate };

    const capabilityKeywords = [
      { capability: "Marketing", keywords: ["market", "advertising", "campaign", "seo"] },
      { capability: "Research", keywords: ["research", "analysis", "study"] },
      { capability: "Development", keywords: ["dev", "code", "programming", "software"] },
      { capability: "Data Analysis", keywords: ["data", "analytics", "statistics"] },
      { capability: "Content", keywords: ["content", "writing", "blog", "article"] },
      { capability: "Lead Generation", keywords: ["lead", "prospect", "outreach"] },
    ];

    const capabilityBenchmarks = capabilityKeywords.map(({ capability, keywords }) => {
      const matchingAgents = allAgents.filter(a => 
        (a.capabilities || []).some((c: string) => 
          keywords.some(kw => c.toLowerCase().includes(kw))
        )
      );
      const agentCount = matchingAgents.length;
      const avgRate = agentCount > 0 
        ? Math.round(matchingAgents.reduce((s, a) => s + formatVal(a.completionRate), 0) / agentCount) 
        : 0;
      const topRate = agentCount > 0 
        ? Math.round(Math.max(...matchingAgents.map(a => formatVal(a.completionRate)))) 
        : 0;
      return { capability, avgRate, topRate, agentCount };
    }).filter(c => c.agentCount > 0 || c.capability === "Marketing");

    const agentRankings = allAgents
      .map(a => ({
        id: a.id,
        name: a.name,
        completionRate: formatVal(a.completionRate),
        rating: formatVal(a.avgRating),
        bounties: formatVal(a.totalBounties),
        score: formatVal(a.completionRate) * 0.4 + formatVal(a.avgRating) * 20 + formatVal(a.totalBounties) * 2,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((a, i) => ({ ...a, rank: i + 1 }));

    return {
      platformBenchmarks,
      capabilityBenchmarks,
      agentRankings,
    };
  }

  async getAgentUpload(id: number): Promise<AgentUpload | undefined> {
    const [upload] = await db.select().from(agentUploads).where(eq(agentUploads.id, id));
    return upload;
  }

  async getAgentUploadsByDeveloper(developerId: string): Promise<AgentUpload[]> {
    return db.select().from(agentUploads).where(eq(agentUploads.developerId, developerId)).orderBy(desc(agentUploads.createdAt));
  }

  async getPublishedAgentUploads(filters?: { category?: string; search?: string }): Promise<AgentUpload[]> {
    let query = db.select().from(agentUploads).where(eq(agentUploads.status, "published"));
    return query.orderBy(desc(agentUploads.downloadCount), desc(agentUploads.rating));
  }

  async createAgentUpload(upload: InsertAgentUpload): Promise<AgentUpload> {
    const uploadData = {
      ...upload,
      uploadType: upload.uploadType as typeof agentUploadTypes[number],
    };
    const [created] = await db.insert(agentUploads).values([uploadData]).returning();
    return created;
  }

  async updateAgentUpload(id: number, data: Partial<AgentUpload>): Promise<AgentUpload | undefined> {
    const [updated] = await db.update(agentUploads).set({ ...data, updatedAt: new Date() }).where(eq(agentUploads.id, id)).returning();
    return updated;
  }

  async updateAgentUploadStatus(id: number, status: AgentUploadStatus): Promise<AgentUpload | undefined> {
    const updateData: Partial<AgentUpload> = { status, updatedAt: new Date() };
    if (status === "published") {
      updateData.publishedAt = new Date();
    }
    const [updated] = await db.update(agentUploads).set(updateData).where(eq(agentUploads.id, id)).returning();
    return updated;
  }

  async deleteAgentUpload(id: number): Promise<boolean> {
    const result = await db.delete(agentUploads).where(eq(agentUploads.id, id));
    return true;
  }

  async getAgentTools(): Promise<AgentTool[]> {
    return db.select().from(agentTools).orderBy(agentTools.category, agentTools.name);
  }

  async createAgentTool(tool: InsertAgentTool): Promise<AgentTool> {
    const toolData = {
      ...tool,
      category: tool.category as typeof agentToolCategories[number],
    };
    const [created] = await db.insert(agentTools).values([toolData]).returning();
    return created;
  }

  async addToolToAgentUpload(agentUploadId: number, toolId: number, config?: string): Promise<void> {
    await db.insert(agentUploadTools).values({ agentUploadId, toolId, config });
  }

  async getToolsForAgentUpload(agentUploadId: number): Promise<AgentTool[]> {
    const result = await db
      .select({ tool: agentTools })
      .from(agentUploadTools)
      .innerJoin(agentTools, eq(agentUploadTools.toolId, agentTools.id))
      .where(eq(agentUploadTools.agentUploadId, agentUploadId));
    return result.map(r => r.tool);
  }

  async createAgentTest(test: InsertAgentTest): Promise<AgentTest> {
    const [created] = await db.insert(agentTests).values(test).returning();
    return created;
  }

  async getAgentTests(agentUploadId: number): Promise<AgentTest[]> {
    return db.select().from(agentTests).where(eq(agentTests.agentUploadId, agentUploadId)).orderBy(desc(agentTests.createdAt));
  }

  async updateAgentTestStatus(id: number, status: AgentTestStatus, result?: Partial<AgentTest>): Promise<AgentTest | undefined> {
    const updateData: Partial<AgentTest> = { status, ...result };
    if (status === "running") {
      updateData.startedAt = new Date();
    } else if (status === "passed" || status === "failed") {
      updateData.completedAt = new Date();
    }
    const [updated] = await db.update(agentTests).set(updateData).where(eq(agentTests.id, id)).returning();
    return updated;
  }

  async createAgentListing(listing: InsertAgentListing): Promise<AgentListing> {
    const [created] = await db.insert(agentListings).values(listing).returning();
    return created;
  }

  async getAgentListing(agentUploadId: number): Promise<AgentListing | undefined> {
    const [listing] = await db.select().from(agentListings).where(eq(agentListings.agentUploadId, agentUploadId));
    return listing;
  }

  async updateAgentListing(agentUploadId: number, data: Partial<AgentListing>): Promise<AgentListing | undefined> {
    const [updated] = await db.update(agentListings).set({ ...data, updatedAt: new Date() }).where(eq(agentListings.agentUploadId, agentUploadId)).returning();
    return updated;
  }

  async getFeaturedAgentListings(): Promise<(AgentListing & { agentUpload: AgentUpload })[]> {
    const result = await db
      .select({ listing: agentListings, agentUpload: agentUploads })
      .from(agentListings)
      .innerJoin(agentUploads, eq(agentListings.agentUploadId, agentUploads.id))
      .where(eq(agentListings.isFeatured, true))
      .orderBy(agentListings.featuredOrder);
    return result.map(r => ({ ...r.listing, agentUpload: r.agentUpload }));
  }

  async createAgentReview(review: InsertAgentReview): Promise<AgentReview> {
    const [created] = await db.insert(agentReviews).values(review).returning();
    await this.updateAgentUploadRating(review.agentUploadId);
    return created;
  }

  async getAgentReviews(agentUploadId: number): Promise<AgentReview[]> {
    return db.select().from(agentReviews).where(eq(agentReviews.agentUploadId, agentUploadId)).orderBy(desc(agentReviews.createdAt));
  }

  private async updateAgentUploadRating(agentUploadId: number): Promise<void> {
    const reviews = await this.getAgentReviews(agentUploadId);
    if (reviews.length === 0) return;
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await db.update(agentUploads).set({ 
      rating: avgRating.toFixed(2), 
      reviewCount: reviews.length,
      updatedAt: new Date() 
    }).where(eq(agentUploads.id, agentUploadId));
  }

  async awardBadge(badge: InsertAgentBadge): Promise<AgentBadge> {
    const badgeData = {
      ...badge,
      badgeType: badge.badgeType as typeof badgeTypes[number],
    };
    const [created] = await db.insert(agentBadges).values([badgeData]).returning();
    return created;
  }

  async getAgentBadges(agentUploadId: number): Promise<AgentBadge[]> {
    return db.select().from(agentBadges).where(eq(agentBadges.agentUploadId, agentUploadId));
  }

  async revokeBadge(id: number): Promise<boolean> {
    const result = await db.delete(agentBadges).where(eq(agentBadges.id, id));
    return true;
  }

  async getIntegrationConnectors(): Promise<IntegrationConnector[]> {
    return db.select().from(integrationConnectors).where(eq(integrationConnectors.isActive, true)).orderBy(integrationConnectors.name);
  }

  async getIntegrationConnectorBySlug(slug: string): Promise<IntegrationConnector | undefined> {
    const [connector] = await db.select().from(integrationConnectors).where(eq(integrationConnectors.slug, slug));
    return connector;
  }

  async createIntegrationConnector(connector: InsertIntegrationConnector): Promise<IntegrationConnector> {
    const connectorData = {
      ...connector,
      category: connector.category as typeof integrationCategories[number],
    };
    const [created] = await db.insert(integrationConnectors).values([connectorData]).returning();
    return created;
  }

  async addAgentIntegration(integration: InsertAgentIntegration): Promise<AgentIntegration> {
    const [created] = await db.insert(agentIntegrations).values(integration).returning();
    await db.update(integrationConnectors).set({ 
      usageCount: sql`${integrationConnectors.usageCount} + 1` 
    }).where(eq(integrationConnectors.id, integration.connectorId));
    return created;
  }

  async getAgentIntegrations(agentUploadId: number): Promise<(AgentIntegration & { connector: IntegrationConnector })[]> {
    const result = await db
      .select({ integration: agentIntegrations, connector: integrationConnectors })
      .from(agentIntegrations)
      .innerJoin(integrationConnectors, eq(agentIntegrations.connectorId, integrationConnectors.id))
      .where(eq(agentIntegrations.agentUploadId, agentUploadId));
    return result.map(r => ({ ...r.integration, connector: r.connector }));
  }

  async removeAgentIntegration(id: number): Promise<boolean> {
    await db.delete(agentIntegrations).where(eq(agentIntegrations.id, id));
    return true;
  }

  async forkAgent(fork: Omit<InsertAgentFork, 'forkedAgentId'>, newAgentData: InsertAgentUpload): Promise<AgentUpload> {
    const uploadData = {
      ...newAgentData,
      uploadType: newAgentData.uploadType as typeof agentUploadTypes[number],
    };
    const [forkedAgent] = await db.insert(agentUploads).values([uploadData]).returning();
    await db.insert(agentForks).values([{
      ...fork,
      forkedAgentId: forkedAgent.id,
    }]);
    return forkedAgent;
  }

  async getAgentForks(originalAgentId: number): Promise<AgentFork[]> {
    return db.select().from(agentForks).where(eq(agentForks.originalAgentId, originalAgentId)).orderBy(desc(agentForks.createdAt));
  }

  async getForkedFrom(agentUploadId: number): Promise<AgentFork | undefined> {
    const [fork] = await db.select().from(agentForks).where(eq(agentForks.forkedAgentId, agentUploadId));
    return fork;
  }

  async getAgentAnalytics(agentUploadId: number, days: number = 30): Promise<AgentAnalytics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return db.select().from(agentAnalytics)
      .where(and(
        eq(agentAnalytics.agentUploadId, agentUploadId),
        sql`${agentAnalytics.date} >= ${startDate}`
      ))
      .orderBy(agentAnalytics.date);
  }

  async recordAgentRun(log: Omit<AgentRunLog, 'id'>): Promise<AgentRunLog> {
    const [created] = await db.insert(agentRunLogs).values(log).returning();
    return created;
  }

  async getAgentRunLogs(agentUploadId: number, limit: number = 100): Promise<AgentRunLog[]> {
    return db.select().from(agentRunLogs)
      .where(eq(agentRunLogs.agentUploadId, agentUploadId))
      .orderBy(desc(agentRunLogs.startedAt))
      .limit(limit);
  }

  async createDiscussion(discussion: InsertDiscussion): Promise<Discussion> {
    const discussionData = {
      ...discussion,
      discussionType: (discussion.discussionType || "general") as typeof discussionTypes[number],
    };
    const [created] = await db.insert(discussions).values([discussionData]).returning();
    return created;
  }

  async getDiscussions(agentUploadId?: number): Promise<Discussion[]> {
    if (agentUploadId) {
      return db.select().from(discussions)
        .where(eq(discussions.agentUploadId, agentUploadId))
        .orderBy(desc(discussions.createdAt));
    }
    return db.select().from(discussions).orderBy(desc(discussions.createdAt));
  }

  async getDiscussion(id: number): Promise<Discussion | undefined> {
    const [discussion] = await db.select().from(discussions).where(eq(discussions.id, id));
    if (discussion) {
      await db.update(discussions).set({ viewCount: sql`${discussions.viewCount} + 1` }).where(eq(discussions.id, id));
    }
    return discussion;
  }

  async createDiscussionReply(reply: InsertDiscussionReply): Promise<DiscussionReply> {
    const [created] = await db.insert(discussionReplies).values(reply).returning();
    await db.update(discussions).set({ 
      replyCount: sql`${discussions.replyCount} + 1`,
      updatedAt: new Date()
    }).where(eq(discussions.id, reply.discussionId));
    return created;
  }

  async getDiscussionReplies(discussionId: number): Promise<DiscussionReply[]> {
    return db.select().from(discussionReplies)
      .where(eq(discussionReplies.discussionId, discussionId))
      .orderBy(discussionReplies.createdAt);
  }

  async vote(voteData: InsertVote): Promise<Vote> {
    const existing = await db.select().from(votes).where(
      and(
        eq(votes.userId, voteData.userId),
        eq(votes.targetType, voteData.targetType),
        eq(votes.targetId, voteData.targetId)
      )
    );
    
    const typedVoteType = voteData.voteType as typeof voteTypes[number];
    
    if (existing.length > 0) {
      if (existing[0].voteType === voteData.voteType) {
        await db.delete(votes).where(eq(votes.id, existing[0].id));
        return existing[0];
      }
      const [updated] = await db.update(votes).set({ voteType: typedVoteType }).where(eq(votes.id, existing[0].id)).returning();
      return updated;
    }
    
    const votePayload = {
      ...voteData,
      voteType: typedVoteType,
    };
    const [created] = await db.insert(votes).values([votePayload]).returning();
    return created;
  }

  async getSecuritySettings(userId: string): Promise<SecuritySettings | undefined> {
    const [settings] = await db.select().from(securitySettings).where(eq(securitySettings.userId, userId));
    return settings;
  }

  async upsertSecuritySettings(settings: InsertSecuritySettings): Promise<SecuritySettings> {
    const [upserted] = await db.insert(securitySettings).values(settings)
      .onConflictDoUpdate({
        target: securitySettings.userId,
        set: {
          twoFactorEnabled: settings.twoFactorEnabled,
          twoFactorSecret: settings.twoFactorSecret,
          backupCodes: settings.backupCodes,
          trustedDevices: settings.trustedDevices,
          loginNotifications: settings.loginNotifications,
          uploadRequires2fa: settings.uploadRequires2fa,
          publishRequires2fa: settings.publishRequires2fa,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async updateSecuritySettings(userId: string, updates: Partial<SecuritySettings>): Promise<SecuritySettings | undefined> {
    const [updated] = await db.update(securitySettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(securitySettings.userId, userId))
      .returning();
    
    if (!updated) {
      const [created] = await db.insert(securitySettings)
        .values({ userId, ...updates } as InsertSecuritySettings)
        .returning();
      return created;
    }
    
    return updated;
  }

  async logSecurityEvent(event: InsertSecurityAuditLog): Promise<SecurityAuditLog> {
    const eventData = {
      ...event,
      eventType: event.eventType as typeof securityEventTypes[number],
    };
    const [created] = await db.insert(securityAuditLog).values([eventData]).returning();
    return created;
  }

  async getSecurityAuditLog(userId: string, limit: number = 50): Promise<SecurityAuditLog[]> {
    return db.select().from(securityAuditLog)
      .where(eq(securityAuditLog.userId, userId))
      .orderBy(desc(securityAuditLog.createdAt))
      .limit(limit);
  }

  async createSecurityScan(scan: InsertAgentSecurityScan): Promise<AgentSecurityScan> {
    const [created] = await db.insert(agentSecurityScans).values(scan).returning();
    return created;
  }

  async getAgentSecurityScans(agentUploadId: number): Promise<AgentSecurityScan[]> {
    return db.select().from(agentSecurityScans)
      .where(eq(agentSecurityScans.agentUploadId, agentUploadId))
      .orderBy(desc(agentSecurityScans.startedAt));
  }

  async completeSecurityScan(id: number, result: Partial<AgentSecurityScan>): Promise<AgentSecurityScan | undefined> {
    const [updated] = await db.update(agentSecurityScans)
      .set({ ...result, completedAt: new Date() })
      .where(eq(agentSecurityScans.id, id))
      .returning();
    return updated;
  }

  // Support Ticket Methods
  async getUserSupportTickets(userId: string): Promise<SupportTicket[]> {
    return db.select().from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const ticketData = {
      ...ticket,
      category: ticket.category as typeof ticketCategories[number],
      priority: (ticket.priority || "medium") as typeof ticketPriorities[number],
    };
    const [created] = await db.insert(supportTickets).values([ticketData]).returning();
    return created;
  }

  async createTicketMessage(message: InsertTicketMessage): Promise<TicketMessage> {
    const [created] = await db.insert(ticketMessages).values(message).returning();
    return created;
  }

  // Dispute Methods
  async getUserDisputes(userId: string): Promise<Dispute[]> {
    return db.select().from(disputes)
      .where(eq(disputes.initiatorId, userId))
      .orderBy(desc(disputes.createdAt));
  }

  async getUserBounties(userId: string): Promise<Bounty[]> {
    return db.select().from(bounties)
      .where(eq(bounties.posterId, userId))
      .orderBy(desc(bounties.createdAt));
  }

  async createDispute(dispute: InsertDispute): Promise<Dispute> {
    const disputeData = {
      ...dispute,
      category: dispute.category as typeof disputeCategories[number],
      priority: (dispute.priority || "medium") as typeof ticketPriorities[number],
    };
    const [created] = await db.insert(disputes).values([disputeData]).returning();
    return created;
  }

  async createDisputeMessage(message: InsertDisputeMessage): Promise<DisputeMessage> {
    const [created] = await db.insert(disputeMessages).values(message).returning();
    return created;
  }

  // Admin Methods
  async getAdminStats(): Promise<{
    totalUsers: number;
    totalBounties: number;
    totalAgents: number;
    pendingReviews: number;
    openDisputes: number;
    openTickets: number;
  }> {
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(userProfiles);
    const [bountyCount] = await db.select({ count: sql<number>`count(*)::int` }).from(bounties);
    const [agentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(agents);
    const [pendingCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(agentUploads).where(eq(agentUploads.status, "pending_review" as typeof agentUploadStatuses[number]));
    const [disputeCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(disputes).where(eq(disputes.status, "open"));
    const [ticketCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(supportTickets).where(eq(supportTickets.status, "open"));
    
    return {
      totalUsers: userCount?.count || 0,
      totalBounties: bountyCount?.count || 0,
      totalAgents: agentCount?.count || 0,
      pendingReviews: pendingCount?.count || 0,
      openDisputes: disputeCount?.count || 0,
      openTickets: ticketCount?.count || 0,
    };
  }

  async getPendingAgents(): Promise<AgentUpload[]> {
    return db.select().from(agentUploads)
      .where(eq(agentUploads.status, "pending_review" as typeof agentUploadStatuses[number]))
      .orderBy(desc(agentUploads.createdAt));
  }

  async getContentFlags(): Promise<ContentFlag[]> {
    return db.select().from(contentFlags)
      .where(eq(contentFlags.status, "pending"))
      .orderBy(desc(contentFlags.createdAt));
  }

  async approveAgent(id: number): Promise<AgentUpload | undefined> {
    const [updated] = await db.update(agentUploads)
      .set({ status: "published" as typeof agentUploadStatuses[number], updatedAt: new Date() })
      .where(eq(agentUploads.id, id))
      .returning();
    return updated;
  }

  async rejectAgent(id: number, reason: string): Promise<AgentUpload | undefined> {
    const [updated] = await db.update(agentUploads)
      .set({ status: "rejected" as typeof agentUploadStatuses[number], updatedAt: new Date() })
      .where(eq(agentUploads.id, id))
      .returning();
    return updated;
  }

  // Bounty Clarifying Questions
  async getBountyClarifyingQuestions(bountyId: number): Promise<BountyClarifyingQuestion[]> {
    return db.select().from(bountyClarifyingQuestions)
      .where(eq(bountyClarifyingQuestions.bountyId, bountyId))
      .orderBy(bountyClarifyingQuestions.createdAt);
  }

  async saveBountyClarifyingQuestions(bountyId: number, questions: Array<{
    question: string;
    questionType: string;
    options?: string[];
    isRequired?: boolean;
  }>): Promise<BountyClarifyingQuestion[]> {
    const results: BountyClarifyingQuestion[] = [];
    for (const q of questions) {
      const [created] = await db.insert(bountyClarifyingQuestions).values({
        bountyId,
        question: q.question,
        questionType: q.questionType as any,
        options: q.options || null,
        isRequired: q.isRequired ?? false,
        aiGenerated: true,
        status: "pending" as typeof bountyQuestionStatuses[number],
      }).returning();
      results.push(created);
    }
    return results;
  }

  async answerBountyClarifyingQuestion(
    questionId: number,
    answer: string,
    status: typeof bountyQuestionStatuses[number]
  ): Promise<BountyClarifyingQuestion | undefined> {
    const [updated] = await db.update(bountyClarifyingQuestions)
      .set({ answer, status, answeredAt: new Date() })
      .where(eq(bountyClarifyingQuestions.id, questionId))
      .returning();
    return updated;
  }

  // Credential Requirements & Consents
  async getBountyCredentialRequirements(bountyId: number): Promise<BountyCredentialRequirement[]> {
    return db.select().from(bountyCredentialRequirements)
      .where(eq(bountyCredentialRequirements.bountyId, bountyId));
  }

  async createCredentialRequirement(requirement: InsertBountyCredentialRequirement): Promise<BountyCredentialRequirement> {
    const [created] = await db.insert(bountyCredentialRequirements).values(requirement as any).returning();
    return created;
  }

  async getUserCredentialConsents(userId: string, bountyId?: number): Promise<CredentialConsent[]> {
    if (bountyId) {
      const requirements = await this.getBountyCredentialRequirements(bountyId);
      const requirementIds = requirements.map(r => r.id);
      if (requirementIds.length === 0) return [];
      
      return db.select().from(credentialConsents)
        .where(and(
          eq(credentialConsents.userId, userId),
          sql`${credentialConsents.requirementId} = ANY(${requirementIds})`
        ));
    }
    return db.select().from(credentialConsents)
      .where(eq(credentialConsents.userId, userId));
  }

  async createCredentialConsent(consent: InsertCredentialConsent): Promise<CredentialConsent> {
    const [created] = await db.insert(credentialConsents).values(consent as any).returning();
    return created;
  }

  async revokeCredentialConsent(consentId: number, userId: string): Promise<CredentialConsent | undefined> {
    const [updated] = await db.update(credentialConsents)
      .set({ status: "revoked" as typeof consentStatuses[number], revokedAt: new Date() })
      .where(and(
        eq(credentialConsents.id, consentId),
        eq(credentialConsents.userId, userId)
      ))
      .returning();
    return updated;
  }

  async logCredentialAccess(log: InsertCredentialAccessLog): Promise<CredentialAccessLog> {
    const [created] = await db.insert(credentialAccessLogs).values(log as any).returning();
    return created;
  }

  // Cursor-based pagination implementations
  async getBountiesPaginated(params: PaginationParams): Promise<PaginatedResult<Bounty & { submissionCount: number }>> {
    const { cursor, limit } = normalizePaginationParams(params);

    let conditions = [];
    if (cursor) {
      // Cursor condition: (createdAt < cursor.createdAt) OR (createdAt = cursor.createdAt AND id < cursor.id)
      conditions.push(
        or(
          lt(bounties.createdAt, cursor.createdAt),
          and(
            eq(bounties.createdAt, cursor.createdAt),
            lt(bounties.id, cursor.id)
          )
        )
      );
    }

    const result = await db
      .select({
        bounty: bounties,
        submissionCount: sql<number>`(SELECT COUNT(*) FROM ${submissions} WHERE ${submissions.bountyId} = ${bounties.id})::int`,
      })
      .from(bounties)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bounties.createdAt), desc(bounties.id))
      .limit(limit + 1);

    const data = result.map(r => ({ ...r.bounty, submissionCount: r.submissionCount }));
    return createPaginatedResult(data, limit);
  }

  async getAgentsPaginated(params: PaginationParams): Promise<PaginatedResult<Agent>> {
    const { cursor, limit } = normalizePaginationParams(params);

    let conditions = [];
    if (cursor) {
      conditions.push(
        or(
          lt(agents.createdAt, cursor.createdAt),
          and(
            eq(agents.createdAt, cursor.createdAt),
            lt(agents.id, cursor.id)
          )
        )
      );
    }

    const result = await db
      .select()
      .from(agents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(agents.createdAt), desc(agents.id))
      .limit(limit + 1);

    return createPaginatedResult(result, limit);
  }

  async getAgentUploadsPaginated(
    params: PaginationParams & { developerId?: string; status?: string }
  ): Promise<PaginatedResult<AgentUpload>> {
    const { cursor, limit } = normalizePaginationParams(params);

    let conditions = [];

    if (params.developerId) {
      conditions.push(eq(agentUploads.developerId, params.developerId));
    }
    if (params.status) {
      conditions.push(eq(agentUploads.status, params.status as typeof agentUploadStatuses[number]));
    }
    if (cursor) {
      conditions.push(
        or(
          lt(agentUploads.createdAt, cursor.createdAt),
          and(
            eq(agentUploads.createdAt, cursor.createdAt),
            lt(agentUploads.id, cursor.id)
          )
        )
      );
    }

    const result = await db
      .select()
      .from(agentUploads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(agentUploads.createdAt), desc(agentUploads.id))
      .limit(limit + 1);

    return createPaginatedResult(result, limit);
  }

  async getSubmissionsByBountyPaginated(
    bountyId: number,
    params: PaginationParams
  ): Promise<PaginatedResult<Submission & { agent: Agent }>> {
    const { cursor, limit } = normalizePaginationParams(params);

    let conditions = [eq(submissions.bountyId, bountyId)];

    if (cursor) {
      conditions.push(
        or(
          lt(submissions.createdAt, cursor.createdAt),
          and(
            eq(submissions.createdAt, cursor.createdAt),
            lt(submissions.id, cursor.id)
          )
        )!
      );
    }

    const result = await db
      .select()
      .from(submissions)
      .innerJoin(agents, eq(submissions.agentId, agents.id))
      .where(and(...conditions))
      .orderBy(desc(submissions.createdAt), desc(submissions.id))
      .limit(limit + 1);

    const data = result.map(r => ({ ...r.submissions, agent: r.agents }));
    return createPaginatedResult(data, limit);
  }

  async getAgentReviewsPaginated(
    agentUploadId: number,
    params: PaginationParams
  ): Promise<PaginatedResult<AgentReview>> {
    const { cursor, limit } = normalizePaginationParams(params);

    let conditions = [eq(agentReviews.agentUploadId, agentUploadId)];

    if (cursor) {
      conditions.push(
        or(
          lt(agentReviews.createdAt, cursor.createdAt),
          and(
            eq(agentReviews.createdAt, cursor.createdAt),
            lt(agentReviews.id, cursor.id)
          )
        )!
      );
    }

    const result = await db
      .select()
      .from(agentReviews)
      .where(and(...conditions))
      .orderBy(desc(agentReviews.createdAt), desc(agentReviews.id))
      .limit(limit + 1);

    return createPaginatedResult(result, limit);
  }
}

export const storage = new DatabaseStorage();
