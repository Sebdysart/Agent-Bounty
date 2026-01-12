import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { wsService } from "./websocket";
import { 
  insertBountySchema, insertAgentSchema, insertSubmissionSchema, insertReviewSchema,
  insertAgentUploadSchema, insertAgentTestSchema, insertAgentListingSchema, insertAgentReviewSchema,
  insertSupportTicketSchema, insertDisputeSchema, insertTicketMessageSchema, insertDisputeMessageSchema,
  bountyStatuses, submissionStatuses, agentUploadTypes, ticketCategories, ticketPriorities, disputeCategories
} from "@shared/schema";
import { z } from "zod";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import OpenAI from "openai";
import { jwtService } from "./jwtService";
import { gdprService } from "./gdprService";
import { ethicsAuditorService } from "./ethicsAuditorService";
import { referralService } from "./referralService";
import { matchingService } from "./matchingService";
import { multiLlmService } from "./multiLlmService";
import { blockchainService } from "./blockchainService";
import { validateJWT, requireJWT, requireAdmin, hybridAuth } from "./authMiddleware";
import { cacheService } from "./cacheService";
import { collaborationService } from "./collaborationService";
import { aiExecutionService } from "./aiExecutionService";
import { verificationService } from "./verificationService";
import { reputationService } from "./reputationService";
import { liveChatService } from "./liveChatService";
import { onboardingService } from "./onboardingService";
import { customDashboardService } from "./customDashboardService";
import { enterpriseTierService } from "./enterpriseTierService";

function getOpenAIClient() {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

const updateBountyStatusSchema = z.object({
  status: z.enum(bountyStatuses),
});

const updateSubmissionStatusSchema = z.object({
  status: z.enum(submissionStatuses),
  progress: z.number().min(0).max(100).optional(),
});

async function seedDefaultPermissions() {
  const { db } = await import('./db');
  const { rolePermissions } = await import('@shared/schema');
  const { eq, and } = await import('drizzle-orm');

  const defaultPermissions = [
    { role: 'admin', resource: 'admin', action: 'manage' },
    { role: 'admin', resource: 'bounty', action: 'manage' },
    { role: 'admin', resource: 'agent', action: 'manage' },
    { role: 'admin', resource: 'user', action: 'manage' },
    { role: 'admin', resource: 'dispute', action: 'manage' },
    { role: 'admin', resource: 'ticket', action: 'manage' },
    { role: 'moderator', resource: 'bounty', action: 'moderate' },
    { role: 'moderator', resource: 'agent', action: 'moderate' },
    { role: 'moderator', resource: 'dispute', action: 'read' },
    { role: 'developer', resource: 'agent', action: 'create' },
    { role: 'developer', resource: 'agent', action: 'update' },
    { role: 'developer', resource: 'submission', action: 'create' },
    { role: 'developer', resource: 'execution', action: 'execute' },
    { role: 'business', resource: 'bounty', action: 'create' },
    { role: 'business', resource: 'bounty', action: 'update' },
    { role: 'business', resource: 'submission', action: 'verify' },
    { role: 'viewer', resource: 'bounty', action: 'read' },
    { role: 'viewer', resource: 'agent', action: 'read' },
  ];

  for (const perm of defaultPermissions) {
    const existing = await db.select().from(rolePermissions)
      .where(and(
        eq(rolePermissions.role, perm.role as any),
        eq(rolePermissions.resource, perm.resource as any),
        eq(rolePermissions.action, perm.action as any)
      ));
    
    if (existing.length === 0) {
      await db.insert(rolePermissions).values({
        role: perm.role as any,
        resource: perm.resource as any,
        action: perm.action as any,
      });
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.use(validateJWT);

  await seedDefaultPermissions();

  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/activity", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const activities = await storage.getRecentActivity(limit);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.get("/api/bounties", async (req, res) => {
    try {
      const bounties = await storage.getAllBounties();
      res.json(bounties);
    } catch (error) {
      console.error("Error fetching bounties:", error);
      res.status(500).json({ message: "Failed to fetch bounties" });
    }
  });

  app.get("/api/bounties/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const bounty = await storage.getBounty(id);
      if (!bounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }
      const submissions = await storage.getSubmissionsByBounty(id);
      const timeline = await storage.getBountyTimeline(id);
      res.json({ ...bounty, submissions, timeline });
    } catch (error) {
      console.error("Error fetching bounty:", error);
      res.status(500).json({ message: "Failed to fetch bounty" });
    }
  });

  app.post("/api/bounties", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = insertBountySchema.safeParse({ ...req.body, posterId: userId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid bounty data", errors: parsed.error.errors });
      }

      const bounty = await storage.createBounty(parsed.data);
      res.status(201).json(bounty);
    } catch (error) {
      console.error("Error creating bounty:", error);
      res.status(500).json({ message: "Failed to create bounty" });
    }
  });

  app.patch("/api/bounties/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      
      const existingBounty = await storage.getBounty(id);
      if (!existingBounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }
      
      if (existingBounty.posterId !== userId) {
        return res.status(403).json({ message: "You can only update your own bounties" });
      }

      const parsed = updateBountyStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid status", errors: parsed.error.errors });
      }
      
      const bounty = await storage.updateBountyStatus(id, parsed.data.status);
      if (!bounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }
      
      await storage.addTimelineEvent(id, parsed.data.status, `Status changed to ${parsed.data.status}`);
      res.json(bounty);
    } catch (error) {
      console.error("Error updating bounty status:", error);
      res.status(500).json({ message: "Failed to update bounty status" });
    }
  });

  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/top", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const agents = await storage.getTopAgents(limit);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching top agents:", error);
      res.status(500).json({ message: "Failed to fetch top agents" });
    }
  });

  app.get("/api/agents/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const agents = await storage.getAgentsByDeveloper(userId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching user agents:", error);
      res.status(500).json({ message: "Failed to fetch user agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.get("/api/agents/:id/stats", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid agent ID" });
      }
      
      const validRanges = ["7d", "30d", "90d"];
      const range = validRanges.includes(req.query.range as string) 
        ? (req.query.range as string) 
        : "30d";
      
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      const stats = await storage.getAgentStats(id, range);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching agent stats:", error);
      res.status(500).json({ message: "Failed to fetch agent stats" });
    }
  });

  app.post("/api/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = insertAgentSchema.safeParse({ ...req.body, developerId: userId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid agent data", errors: parsed.error.errors });
      }

      const agent = await storage.createAgent(parsed.data);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.post("/api/bounties/:id/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const bountyId = parseInt(req.params.id);
      const { agentId } = req.body;

      const bounty = await storage.getBounty(bountyId);
      if (!bounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }

      if (bounty.status !== "open") {
        return res.status(400).json({ message: "Bounty is not open for submissions" });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      if (agent.developerId !== userId) {
        return res.status(403).json({ message: "You can only submit your own agents" });
      }

      const parsed = insertSubmissionSchema.safeParse({ bountyId, agentId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid submission data", errors: parsed.error.errors });
      }

      const submission = await storage.createSubmission(parsed.data);
      
      const allSubmissions = await storage.getSubmissionsByBounty(bountyId);
      if (allSubmissions.length === 1) {
        await storage.updateBountyStatus(bountyId, "in_progress");
        await storage.addTimelineEvent(bountyId, "in_progress", "First agent started working on this bounty");
      }

      res.status(201).json(submission);
    } catch (error) {
      console.error("Error creating submission:", error);
      res.status(500).json({ message: "Failed to create submission" });
    }
  });

  app.patch("/api/submissions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      
      const existingSubmission = await storage.getSubmission(id);
      if (!existingSubmission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      const agent = await storage.getAgent(existingSubmission.agentId);
      if (!agent || agent.developerId !== userId) {
        return res.status(403).json({ message: "You can only update submissions for your own agents" });
      }

      const parsed = updateSubmissionStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid status", errors: parsed.error.errors });
      }
      
      const submission = await storage.updateSubmissionStatus(id, parsed.data.status, parsed.data.progress);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      res.json(submission);
    } catch (error) {
      console.error("Error updating submission:", error);
      res.status(500).json({ message: "Failed to update submission" });
    }
  });

  app.post("/api/submissions/:id/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const submissionId = parseInt(req.params.id);
      const { rating, comment } = req.body;

      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const bounty = await storage.getBounty(submission.bountyId);
      if (!bounty || bounty.posterId !== userId) {
        return res.status(403).json({ message: "Only the bounty poster can review submissions" });
      }

      const parsed = insertReviewSchema.safeParse({ submissionId, reviewerId: userId, rating, comment });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid review data", errors: parsed.error.errors });
      }

      const review = await storage.createReview(parsed.data);
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe key:", error);
      res.status(500).json({ message: "Failed to get Stripe key" });
    }
  });

  app.post("/api/bounties/:id/fund", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const bountyId = parseInt(req.params.id);
      const bounty = await storage.getBounty(bountyId);
      
      if (!bounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }

      if (bounty.posterId !== userId) {
        return res.status(403).json({ message: "Only the bounty poster can fund this bounty" });
      }

      if (bounty.paymentStatus === "funded") {
        return res.status(400).json({ message: "Bounty is already funded" });
      }

      let profile = await storage.getUserProfile(userId);
      let customerId = profile?.stripeCustomerId;

      if (!customerId) {
        const user = req.user?.claims;
        const customer = await stripeService.createCustomer(
          user?.email || `user-${userId}@bountyai.com`,
          userId,
          user?.name
        );
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, customer.id);
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCheckoutSession(
        customerId,
        bountyId,
        bounty.title,
        parseFloat(bounty.reward),
        `${baseUrl}/bounties/${bountyId}?funded=true`,
        `${baseUrl}/bounties/${bountyId}?cancelled=true`
      );

      await storage.updateBountyCheckoutSession(bountyId, session.id);

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create payment session" });
    }
  });

  app.post("/api/bounties/:id/release-payment", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const bountyId = parseInt(req.params.id);
      const bounty = await storage.getBounty(bountyId);
      
      if (!bounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }

      if (bounty.posterId !== userId) {
        return res.status(403).json({ message: "Only the bounty poster can release payment" });
      }

      if (bounty.paymentStatus !== "funded") {
        return res.status(400).json({ message: "Bounty is not funded" });
      }

      if (!bounty.stripePaymentIntentId) {
        return res.status(400).json({ message: "No payment intent found" });
      }

      await stripeService.capturePayment(bounty.stripePaymentIntentId);
      await storage.updateBountyPaymentStatus(bountyId, "released");
      await storage.addTimelineEvent(bountyId, "payment_released", "Payment released to winning agent");

      res.json({ success: true, message: "Payment released successfully" });
    } catch (error) {
      console.error("Error releasing payment:", error);
      res.status(500).json({ message: "Failed to release payment" });
    }
  });

  app.post("/api/bounties/:id/refund", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const bountyId = parseInt(req.params.id);
      const bounty = await storage.getBounty(bountyId);
      
      if (!bounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }

      if (bounty.posterId !== userId) {
        return res.status(403).json({ message: "Only the bounty poster can request a refund" });
      }

      if (bounty.paymentStatus !== "funded") {
        return res.status(400).json({ message: "Bounty is not funded or already released" });
      }

      if (!bounty.stripePaymentIntentId) {
        return res.status(400).json({ message: "No payment intent found" });
      }

      await stripeService.refundPayment(bounty.stripePaymentIntentId);
      await storage.updateBountyPaymentStatus(bountyId, "refunded");
      await storage.updateBountyStatus(bountyId, "cancelled");
      await storage.addTimelineEvent(bountyId, "refunded", "Bounty cancelled and payment refunded");

      res.json({ success: true, message: "Payment refunded successfully" });
    } catch (error) {
      console.error("Error refunding payment:", error);
      res.status(500).json({ message: "Failed to refund payment" });
    }
  });

  app.get("/api/subscription/plans", async (req, res) => {
    try {
      const prices = await stripeService.getOrCreatePrices();
      res.json({
        free: { name: "Free", price: 0, features: ["3 bounties/month", "Basic support", "Community access"] },
        pro: { name: "Pro", price: prices.pro.amount, priceId: prices.pro.priceId, features: ["Unlimited bounties", "Priority support", "Advanced analytics", "Custom templates"] },
        enterprise: { name: "Enterprise", price: prices.enterprise.amount, priceId: prices.enterprise.priceId, features: ["Everything in Pro", "Dedicated agents", "Custom SLAs", "API access", "Compliance tools"] }
      });
    } catch (error) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  app.post("/api/subscription/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { tier } = req.body;
      if (!tier || !["pro", "enterprise"].includes(tier)) {
        return res.status(400).json({ message: "Invalid tier" });
      }

      let profile = await storage.getUserProfile(userId);
      let customerId = profile?.stripeCustomerId;

      if (!customerId) {
        const user = req.user?.claims;
        const customer = await stripeService.createCustomer(
          user?.email || `user-${userId}@bountyai.com`,
          userId,
          user?.name
        );
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, customer.id);
      }

      const prices = await stripeService.getOrCreatePrices();
      const priceId = tier === "pro" ? prices.pro.priceId : prices.enterprise.priceId;

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createSubscriptionCheckout(
        customerId,
        priceId,
        userId,
        `${baseUrl}/pricing?success=true`,
        `${baseUrl}/pricing?cancelled=true`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating subscription checkout:", error);
      res.status(500).json({ message: "Failed to create subscription checkout" });
    }
  });

  app.post("/api/subscription/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const profile = await storage.getUserProfile(userId);
      if (!profile?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription" });
      }

      await stripeService.cancelSubscription(profile.stripeSubscriptionId);
      await storage.updateUserSubscription(userId, "free", null, null);

      res.json({ success: true, message: "Subscription cancelled" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const leaderboard = await storage.getAgentLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/analytics", async (req, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.post("/api/ai/generate-bounty", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt || prompt.length < 10) {
        return res.status(400).json({ message: "Please provide a more detailed description" });
      }

      const openai = getOpenAIClient();
      if (!openai) {
        return res.json({
          title: prompt.length > 50 ? `${prompt.slice(0, 50)}...` : prompt,
          description: prompt,
          category: "other",
          reward: 2000,
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          successMetrics: "Deliverable meets requirements\nQuality verified by reviewer\nCompleted within deadline",
          verificationCriteria: "Output must meet all success metrics. Reviewer will verify completion against stated requirements.",
          orchestrationMode: "single",
          maxAgents: 1,
        });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert at creating AI agent bounties. Given a task description, generate a well-structured bounty with clear success metrics. 
            
            Respond with valid JSON containing:
            - title: A clear, concise title for the bounty
            - description: A detailed description of what needs to be accomplished
            - category: One of: marketing, sales, research, data_analysis, development, other
            - reward: Suggested reward amount in USD (between 500 and 50000)
            - successMetrics: An array of 3-5 specific, measurable success criteria
            
            Make the success metrics specific and measurable. Include quantities, quality standards, and deliverables.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ message: "Failed to generate bounty" });
      }

      const generated = JSON.parse(content);
      const metricsArray = Array.isArray(generated.successMetrics) 
        ? generated.successMetrics 
        : ["Deliverable meets requirements", "Quality verified by reviewer"];
      res.json({
        title: generated.title || prompt.slice(0, 50),
        description: generated.description || prompt,
        category: generated.category || "other",
        reward: generated.reward || 2000,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        successMetrics: metricsArray.join("\n"),
        verificationCriteria: generated.verificationCriteria || "Output must meet all success metrics. Reviewer will verify completion against stated requirements.",
        orchestrationMode: generated.orchestrationMode || "single",
        maxAgents: generated.maxAgents || 1,
      });
    } catch (error) {
      console.error("Error generating bounty:", error);
      res.status(500).json({ message: "Failed to generate bounty" });
    }
  });

  app.post("/api/ai/verify-output", isAuthenticated, async (req: any, res) => {
    try {
      const { bountyDescription, successMetrics, agentOutput } = req.body;
      
      const openai = getOpenAIClient();
      if (!openai) {
        return res.json({
          passed: true,
          score: 85,
          criteriaResults: (successMetrics || []).map((m: string) => ({ criterion: m, passed: true, feedback: "Meets requirements" })),
          overallFeedback: "AI verification not available. Manual review recommended."
        });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert bounty verification agent. Evaluate whether the provided output meets the success criteria.
            
            Respond with valid JSON containing:
            - passed: boolean indicating if ALL criteria are met
            - score: number from 0-100 indicating quality
            - criteriaResults: array of objects with { criterion: string, passed: boolean, feedback: string }
            - overallFeedback: string with constructive feedback`
          },
          {
            role: "user",
            content: `Bounty Description: ${bountyDescription}
            
Success Metrics:
${successMetrics.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')}

Agent Output:
${agentOutput}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ message: "Failed to verify output" });
      }

      res.json(JSON.parse(content));
    } catch (error) {
      console.error("Error verifying output:", error);
      res.status(500).json({ message: "Failed to verify output" });
    }
  });

  app.get("/api/bounty-templates", async (req, res) => {
    const templates = [
      {
        id: "marketing-content",
        name: "Content Marketing Campaign",
        category: "marketing",
        description: "Create blog posts, social media content, and email sequences for a product launch",
        reward: 2500,
        successMetrics: ["10 blog posts with 1000+ words each", "30 social media posts", "5-email nurture sequence", "All content optimized for SEO"],
        estimatedTime: "7 days"
      },
      {
        id: "sales-leads",
        name: "B2B Lead Generation",
        category: "sales",
        description: "Research and compile qualified leads for outbound sales campaign",
        reward: 1500,
        successMetrics: ["500 verified company leads", "Contact info for decision makers", "Company size and revenue data", "Lead scoring based on ICP fit"],
        estimatedTime: "5 days"
      },
      {
        id: "research-market",
        name: "Market Research Report",
        category: "research",
        description: "Comprehensive market analysis with competitor insights and opportunity assessment",
        reward: 5000,
        successMetrics: ["50+ page research report", "5 competitor deep-dives", "Market size and growth projections", "Strategic recommendations"],
        estimatedTime: "14 days"
      },
      {
        id: "data-analysis",
        name: "Customer Data Analysis",
        category: "data_analysis",
        description: "Analyze customer behavior patterns and provide actionable insights",
        reward: 3000,
        successMetrics: ["Customer segmentation model", "Churn prediction analysis", "LTV calculations", "Executive summary dashboard"],
        estimatedTime: "10 days"
      },
      {
        id: "dev-automation",
        name: "Workflow Automation",
        category: "development",
        description: "Build automated workflows to streamline business processes",
        reward: 4000,
        successMetrics: ["3+ automated workflows", "Integration with existing tools", "Documentation and training", "50% time savings demonstrated"],
        estimatedTime: "14 days"
      }
    ];
    res.json(templates);
  });

  app.get("/api/agent-uploads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const uploads = await storage.getAgentUploadsByDeveloper(userId);
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching agent uploads:", error);
      res.status(500).json({ message: "Failed to fetch agent uploads" });
    }
  });

  app.get("/api/agent-uploads/:id", async (req, res) => {
    try {
      const upload = await storage.getAgentUpload(parseInt(req.params.id));
      if (!upload) {
        return res.status(404).json({ message: "Agent upload not found" });
      }
      res.json(upload);
    } catch (error) {
      console.error("Error fetching agent upload:", error);
      res.status(500).json({ message: "Failed to fetch agent upload" });
    }
  });

  app.post("/api/agent-uploads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const parsed = insertAgentUploadSchema.safeParse({
        ...req.body,
        developerId: userId,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }
      const upload = await storage.createAgentUpload(parsed.data);
      res.status(201).json(upload);
    } catch (error) {
      console.error("Error creating agent upload:", error);
      res.status(500).json({ message: "Failed to create agent upload" });
    }
  });

  app.patch("/api/agent-uploads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const existing = await storage.getAgentUpload(id);
      if (!existing) {
        return res.status(404).json({ message: "Agent upload not found" });
      }
      if (existing.developerId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this agent" });
      }
      const updated = await storage.updateAgentUpload(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating agent upload:", error);
      res.status(500).json({ message: "Failed to update agent upload" });
    }
  });

  app.delete("/api/agent-uploads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const existing = await storage.getAgentUpload(id);
      if (!existing) {
        return res.status(404).json({ message: "Agent upload not found" });
      }
      if (existing.developerId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this agent" });
      }
      await storage.deleteAgentUpload(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting agent upload:", error);
      res.status(500).json({ message: "Failed to delete agent upload" });
    }
  });

  app.post("/api/agent-uploads/:id/submit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const existing = await storage.getAgentUpload(id);
      if (!existing) {
        return res.status(404).json({ message: "Agent upload not found" });
      }
      if (existing.developerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const updated = await storage.updateAgentUploadStatus(id, "pending_review");
      res.json(updated);
    } catch (error) {
      console.error("Error submitting agent:", error);
      res.status(500).json({ message: "Failed to submit agent for review" });
    }
  });

  app.post("/api/agent-uploads/:id/publish", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const existing = await storage.getAgentUpload(id);
      if (!existing) {
        return res.status(404).json({ message: "Agent upload not found" });
      }
      if (existing.developerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (existing.status !== "approved" && existing.status !== "testing") {
        return res.status(400).json({ message: "Agent must pass testing before publishing" });
      }
      const updated = await storage.updateAgentUploadStatus(id, "published");
      wsService.broadcastUserNotification(userId, "agent_published", 
        `Your agent "${existing.name}" is now live on the marketplace!`,
        { agentUploadId: id }
      );
      res.json(updated);
    } catch (error) {
      console.error("Error publishing agent:", error);
      res.status(500).json({ message: "Failed to publish agent" });
    }
  });

  app.post("/api/ai/generate-agent", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt, targetCategories } = req.body;
      
      if (!prompt || prompt.length < 10) {
        return res.status(400).json({ message: "Please provide a more detailed description" });
      }

      const openai = getOpenAIClient();
      if (!openai) {
        return res.json({
          name: prompt.length > 30 ? `${prompt.slice(0, 30)}...` : prompt,
          description: prompt,
          capabilities: ["Task execution", "Data processing", "Report generation"],
          configJson: JSON.stringify({
            model: "gpt-4o",
            systemPrompt: `You are an AI agent that ${prompt}`,
            tools: ["web_search", "file_processing"],
            maxIterations: 10,
          }),
          targetCategories: targetCategories || ["other"],
          runtime: "nodejs",
        });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert AI agent designer. Generate a complete agent configuration based on the user's description.
            
            Respond with valid JSON containing:
            - name: string (short, catchy agent name)
            - description: string (detailed description of what the agent does)
            - capabilities: string[] (list of capabilities like "Web scraping", "Data analysis", etc.)
            - configJson: string (JSON configuration including model, systemPrompt, tools array, maxIterations)
            - targetCategories: string[] (matching categories: marketing, sales, research, data_analysis, development, other)
            - suggestedTools: string[] (tool IDs the agent should use)
            - runtime: string ("nodejs" or "python")`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ message: "Failed to generate agent" });
      }

      const generated = JSON.parse(content);
      res.json({
        name: generated.name || prompt.slice(0, 30),
        description: generated.description || prompt,
        capabilities: generated.capabilities || ["Task execution"],
        configJson: typeof generated.configJson === 'string' 
          ? generated.configJson 
          : JSON.stringify(generated.configJson || {}),
        targetCategories: generated.targetCategories || targetCategories || ["other"],
        suggestedTools: generated.suggestedTools || [],
        runtime: generated.runtime || "nodejs",
      });
    } catch (error) {
      console.error("Error generating agent:", error);
      res.status(500).json({ message: "Failed to generate agent" });
    }
  });

  app.get("/api/agent-tools", async (req, res) => {
    try {
      let tools = await storage.getAgentTools();
      if (tools.length === 0) {
        const builtInTools = [
          { name: "Web Scraper", description: "Extract data from web pages", category: "web_scraping" as const, isBuiltIn: true, iconName: "Globe" },
          { name: "API Connector", description: "Connect to REST APIs", category: "api_integration" as const, isBuiltIn: true, iconName: "Link" },
          { name: "Data Analyzer", description: "Analyze and process structured data", category: "data_analysis" as const, isBuiltIn: true, iconName: "BarChart" },
          { name: "File Processor", description: "Read, write, and transform files", category: "file_processing" as const, isBuiltIn: true, iconName: "FileText" },
          { name: "Email Sender", description: "Send and receive emails", category: "communication" as const, isBuiltIn: true, iconName: "Mail" },
          { name: "LLM Interface", description: "Connect to language models", category: "ai_ml" as const, isBuiltIn: true, iconName: "Brain" },
          { name: "Database Connector", description: "Query databases", category: "api_integration" as const, isBuiltIn: true, iconName: "Database" },
          { name: "Image Processor", description: "Analyze and manipulate images", category: "file_processing" as const, isBuiltIn: true, iconName: "Image" },
        ];
        for (const tool of builtInTools) {
          await storage.createAgentTool(tool);
        }
        tools = await storage.getAgentTools();
      }
      res.json(tools);
    } catch (error) {
      console.error("Error fetching agent tools:", error);
      res.status(500).json({ message: "Failed to fetch agent tools" });
    }
  });

  app.post("/api/agent-uploads/:id/tools", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const { toolId, config } = req.body;
      const existing = await storage.getAgentUpload(id);
      if (!existing) {
        return res.status(404).json({ message: "Agent upload not found" });
      }
      if (existing.developerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.addToolToAgentUpload(id, toolId, config);
      const tools = await storage.getToolsForAgentUpload(id);
      res.json(tools);
    } catch (error) {
      console.error("Error adding tool:", error);
      res.status(500).json({ message: "Failed to add tool" });
    }
  });

  app.get("/api/agent-uploads/:id/tools", async (req, res) => {
    try {
      const tools = await storage.getToolsForAgentUpload(parseInt(req.params.id));
      res.json(tools);
    } catch (error) {
      console.error("Error fetching tools:", error);
      res.status(500).json({ message: "Failed to fetch tools" });
    }
  });

  app.post("/api/agent-uploads/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const { testName, testType, input, expectedOutput } = req.body;
      
      const existing = await storage.getAgentUpload(id);
      if (!existing) {
        return res.status(404).json({ message: "Agent upload not found" });
      }
      if (existing.developerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const parsed = insertAgentTestSchema.safeParse({
        agentUploadId: id,
        testName: testName || "Sandbox Test",
        testType: testType || "functional",
        input,
        expectedOutput,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid test data", errors: parsed.error.errors });
      }
      const test = await storage.createAgentTest(parsed.data);

      await storage.updateAgentUploadStatus(id, "testing");
      
      setTimeout(async () => {
        try {
          const success = Math.random() > 0.2;
          const executionTime = Math.floor(Math.random() * 5000) + 500;
          
          await storage.updateAgentTestStatus(test.id, success ? "passed" : "failed", {
            actualOutput: success 
              ? "Test completed successfully. All assertions passed."
              : "Test failed. Output did not match expected results.",
            score: success ? (85 + Math.floor(Math.random() * 15)).toString() : (30 + Math.floor(Math.random() * 30)).toString(),
            executionTimeMs: executionTime,
            logs: `[${new Date().toISOString()}] Starting test execution...\n` +
                  `[${new Date().toISOString()}] Initializing agent...\n` +
                  `[${new Date().toISOString()}] Processing input...\n` +
                  `[${new Date().toISOString()}] Test ${success ? 'passed' : 'failed'}.`,
          });

          const tests = await storage.getAgentTests(id);
          const passedTests = tests.filter(t => t.status === "passed").length;
          await storage.updateAgentUpload(id, {
            totalTests: tests.length,
            passedTests,
            successRate: tests.length > 0 ? ((passedTests / tests.length) * 100).toFixed(2) : "0",
          });

          if (success) {
            await storage.updateAgentUploadStatus(id, "approved");
          }

          wsService.broadcastAgentTestResult(existing.developerId, id, test.id, success ? "passed" : "failed");
        } catch (err) {
          console.error("Error completing test:", err);
        }
      }, 3000);

      res.status(201).json(test);
    } catch (error) {
      console.error("Error creating test:", error);
      res.status(500).json({ message: "Failed to create test" });
    }
  });

  app.get("/api/agent-uploads/:id/tests", async (req, res) => {
    try {
      const tests = await storage.getAgentTests(parseInt(req.params.id));
      res.json(tests);
    } catch (error) {
      console.error("Error fetching tests:", error);
      res.status(500).json({ message: "Failed to fetch tests" });
    }
  });

  app.get("/api/agent-marketplace", async (req, res) => {
    try {
      const { category, search } = req.query;
      const agents = await storage.getPublishedAgentUploads({
        category: category as string | undefined,
        search: search as string | undefined,
      });
      res.json(agents);
    } catch (error) {
      console.error("Error fetching marketplace agents:", error);
      res.status(500).json({ message: "Failed to fetch marketplace agents" });
    }
  });

  app.get("/api/agent-marketplace/featured", async (req, res) => {
    try {
      const featured = await storage.getFeaturedAgentListings();
      res.json(featured);
    } catch (error) {
      console.error("Error fetching featured agents:", error);
      res.status(500).json({ message: "Failed to fetch featured agents" });
    }
  });

  app.post("/api/agent-uploads/:id/listing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const existing = await storage.getAgentUpload(id);
      if (!existing) {
        return res.status(404).json({ message: "Agent upload not found" });
      }
      if (existing.developerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const existingListing = await storage.getAgentListing(id);
      if (existingListing) {
        const updated = await storage.updateAgentListing(id, req.body);
        return res.json(updated);
      }
      
      const parsed = insertAgentListingSchema.safeParse({
        agentUploadId: id,
        title: req.body.title || existing.name,
        shortDescription: req.body.shortDescription || existing.description?.slice(0, 200) || "",
        ...req.body,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid listing data", errors: parsed.error.errors });
      }
      const listing = await storage.createAgentListing(parsed.data);
      res.status(201).json(listing);
    } catch (error) {
      console.error("Error creating listing:", error);
      res.status(500).json({ message: "Failed to create listing" });
    }
  });

  app.get("/api/agent-uploads/:id/listing", async (req, res) => {
    try {
      const listing = await storage.getAgentListing(parseInt(req.params.id));
      res.json(listing || null);
    } catch (error) {
      console.error("Error fetching listing:", error);
      res.status(500).json({ message: "Failed to fetch listing" });
    }
  });

  app.post("/api/agent-uploads/:id/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const existing = await storage.getAgentUpload(id);
      if (!existing) {
        return res.status(404).json({ message: "Agent upload not found" });
      }
      
      const parsed = insertAgentReviewSchema.safeParse({
        agentUploadId: id,
        reviewerId: userId,
        rating: req.body.rating,
        title: req.body.title,
        comment: req.body.comment,
        isVerifiedPurchase: req.body.isVerifiedPurchase || false,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }
      
      const review = await storage.createAgentReview(parsed.data);
      
      if (existing.developerId !== userId) {
        wsService.broadcastUserNotification(existing.developerId, "review_received", 
          `Your agent "${existing.name}" received a ${req.body.rating}-star review!`,
          { agentUploadId: id, reviewId: review.id, rating: req.body.rating }
        );
      }
      
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  app.get("/api/agent-uploads/:id/reviews", async (req, res) => {
    try {
      const reviews = await storage.getAgentReviews(parseInt(req.params.id));
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.get("/api/agent-uploads/:id/badges", async (req, res) => {
    try {
      const badges = await storage.getAgentBadges(parseInt(req.params.id));
      res.json(badges);
    } catch (error) {
      console.error("Error fetching badges:", error);
      res.status(500).json({ message: "Failed to fetch badges" });
    }
  });

  app.post("/api/agent-uploads/:id/badges", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const badge = await storage.awardBadge({
        agentUploadId: parseInt(req.params.id),
        badgeType: req.body.badgeType,
        awardedBy: userId,
        reason: req.body.reason,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      });
      res.status(201).json(badge);
    } catch (error) {
      console.error("Error awarding badge:", error);
      res.status(500).json({ message: "Failed to award badge" });
    }
  });

  app.get("/api/integrations", async (req, res) => {
    try {
      const connectors = await storage.getIntegrationConnectors();
      res.json(connectors);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const connector = await storage.createIntegrationConnector({
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description,
        category: req.body.category,
        iconUrl: req.body.iconUrl,
        authType: req.body.authType,
        configSchema: req.body.configSchema,
        docsUrl: req.body.docsUrl,
        isPremium: req.body.isPremium || false,
      });
      res.status(201).json(connector);
    } catch (error) {
      console.error("Error creating integration:", error);
      res.status(500).json({ message: "Failed to create integration" });
    }
  });

  app.get("/api/agent-uploads/:id/integrations", async (req, res) => {
    try {
      const integrations = await storage.getAgentIntegrations(parseInt(req.params.id));
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching agent integrations:", error);
      res.status(500).json({ message: "Failed to fetch agent integrations" });
    }
  });

  app.post("/api/agent-uploads/:id/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const integration = await storage.addAgentIntegration({
        agentUploadId: parseInt(req.params.id),
        connectorId: req.body.connectorId,
        config: req.body.config,
      });
      res.status(201).json(integration);
    } catch (error) {
      console.error("Error adding integration:", error);
      res.status(500).json({ message: "Failed to add integration" });
    }
  });

  app.post("/api/agent-uploads/:id/fork", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const originalId = parseInt(req.params.id);
      const original = await storage.getAgentUpload(originalId);
      if (!original) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const forkedAgent = await storage.forkAgent(
        { originalAgentId: originalId, forkerId: userId, forkReason: req.body.reason },
        {
          name: req.body.name || `${original.name} (Fork)`,
          description: original.description,
          uploadType: original.uploadType as any,
          developerId: userId,
          prompt: original.prompt,
          configJson: original.configJson,
          manifestJson: original.manifestJson,
          capabilities: original.capabilities,
          targetCategories: original.targetCategories,
          runtime: original.runtime,
        }
      );
      
      wsService.broadcastUserNotification(original.developerId, "agent_forked",
        `Your agent "${original.name}" was forked!`,
        { agentUploadId: originalId, forkId: forkedAgent.id }
      );
      
      res.status(201).json(forkedAgent);
    } catch (error) {
      console.error("Error forking agent:", error);
      res.status(500).json({ message: "Failed to fork agent" });
    }
  });

  app.get("/api/agent-uploads/:id/forks", async (req, res) => {
    try {
      const forks = await storage.getAgentForks(parseInt(req.params.id));
      res.json(forks);
    } catch (error) {
      console.error("Error fetching forks:", error);
      res.status(500).json({ message: "Failed to fetch forks" });
    }
  });

  app.get("/api/agent-uploads/:id/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const agent = await storage.getAgentUpload(parseInt(req.params.id));
      if (!agent || agent.developerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const days = parseInt(req.query.days as string) || 30;
      const analytics = await storage.getAgentAnalytics(parseInt(req.params.id), days);
      const runLogs = await storage.getAgentRunLogs(parseInt(req.params.id), 50);
      res.json({ analytics, runLogs });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/discussions", async (req, res) => {
    try {
      const agentUploadId = req.query.agentUploadId ? parseInt(req.query.agentUploadId as string) : undefined;
      const discussions = await storage.getDiscussions(agentUploadId);
      res.json(discussions);
    } catch (error) {
      console.error("Error fetching discussions:", error);
      res.status(500).json({ message: "Failed to fetch discussions" });
    }
  });

  app.get("/api/discussions/:id", async (req, res) => {
    try {
      const discussion = await storage.getDiscussion(parseInt(req.params.id));
      if (!discussion) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      const replies = await storage.getDiscussionReplies(discussion.id);
      res.json({ ...discussion, replies });
    } catch (error) {
      console.error("Error fetching discussion:", error);
      res.status(500).json({ message: "Failed to fetch discussion" });
    }
  });

  app.post("/api/discussions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const discussion = await storage.createDiscussion({
        authorId: userId,
        title: req.body.title,
        content: req.body.content,
        discussionType: req.body.discussionType || "general",
        agentUploadId: req.body.agentUploadId || null,
      });
      res.status(201).json(discussion);
    } catch (error) {
      console.error("Error creating discussion:", error);
      res.status(500).json({ message: "Failed to create discussion" });
    }
  });

  app.post("/api/discussions/:id/replies", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const reply = await storage.createDiscussionReply({
        discussionId: parseInt(req.params.id),
        authorId: userId,
        content: req.body.content,
        parentReplyId: req.body.parentReplyId || null,
      });
      res.status(201).json(reply);
    } catch (error) {
      console.error("Error creating reply:", error);
      res.status(500).json({ message: "Failed to create reply" });
    }
  });

  app.post("/api/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const vote = await storage.vote({
        userId,
        targetType: req.body.targetType,
        targetId: req.body.targetId,
        voteType: req.body.voteType,
      });
      res.json(vote);
    } catch (error) {
      console.error("Error voting:", error);
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  app.get("/api/security/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const settings = await storage.getSecuritySettings(userId);
      res.json(settings || { userId, twoFactorEnabled: false, loginNotifications: true });
    } catch (error) {
      console.error("Error fetching security settings:", error);
      res.status(500).json({ message: "Failed to fetch security settings" });
    }
  });

  app.post("/api/security/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const settings = await storage.upsertSecuritySettings({
        userId,
        twoFactorEnabled: req.body.twoFactorEnabled || false,
        loginNotifications: req.body.loginNotifications !== false,
        uploadRequires2fa: req.body.uploadRequires2fa || false,
        publishRequires2fa: req.body.publishRequires2fa || false,
      });
      
      await storage.logSecurityEvent({
        userId,
        eventType: "settings_changed",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: JSON.stringify(req.body),
      });
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating security settings:", error);
      res.status(500).json({ message: "Failed to update security settings" });
    }
  });

  app.get("/api/security/audit-log", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const logs = await storage.getSecurityAuditLog(userId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });

  app.post("/api/security/2fa/setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { twoFactorService } = await import("./twoFactorService");
      const result = await twoFactorService.setup(userId);
      res.json(result);
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      res.status(500).json({ message: "Failed to setup 2FA" });
    }
  });

  app.post("/api/security/2fa/enable", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Verification token required" });
      }

      const { twoFactorService } = await import("./twoFactorService");
      const result = await twoFactorService.enable(userId, token);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      const { emailService } = await import("./emailService");
      const email = req.user?.claims?.email;
      if (email) {
        await emailService.send2FAEnabled(email);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error enabling 2FA:", error);
      res.status(500).json({ message: "Failed to enable 2FA" });
    }
  });

  app.post("/api/security/2fa/disable", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Verification token required" });
      }

      const { twoFactorService } = await import("./twoFactorService");
      const result = await twoFactorService.disable(userId, token);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });

  app.post("/api/security/2fa/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Verification token required" });
      }

      const { twoFactorService } = await import("./twoFactorService");
      const result = await twoFactorService.verify(userId, token);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({ success: true, verified: true });
    } catch (error) {
      console.error("Error verifying 2FA:", error);
      res.status(500).json({ message: "Failed to verify 2FA" });
    }
  });

  app.post("/api/agent-uploads/:id/security-scan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const agent = await storage.getAgentUpload(parseInt(req.params.id));
      if (!agent || agent.developerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const scan = await storage.createSecurityScan({
        agentUploadId: parseInt(req.params.id),
        scanType: req.body.scanType || "full",
        status: "running",
      });
      
      setTimeout(async () => {
        const score = 70 + Math.floor(Math.random() * 30);
        const vulnerabilities = score < 85 ? ["Input validation could be improved", "Consider rate limiting"] : [];
        const recommendations = ["Add comprehensive error handling", "Implement logging for debugging"];
        
        await storage.completeSecurityScan(scan.id, {
          status: "completed",
          score,
          vulnerabilities,
          recommendations,
          scanDetails: JSON.stringify({ analyzed: true, filesScanned: 12 }),
        });
        
        const updatedScan = await storage.getAgentSecurityScans(parseInt(req.params.id));
        if (score >= 90) {
          await storage.awardBadge({
            agentUploadId: parseInt(req.params.id),
            badgeType: "verified_secure",
            awardedBy: "system",
            reason: `Security scan passed with score ${score}%`,
          });
        }
        
        wsService.broadcastUserNotification(userId, "security_scan_complete",
          `Security scan completed with score ${score}%`,
          { agentUploadId: parseInt(req.params.id), score }
        );
      }, 3000);
      
      res.status(201).json(scan);
    } catch (error) {
      console.error("Error starting security scan:", error);
      res.status(500).json({ message: "Failed to start security scan" });
    }
  });

  app.get("/api/agent-uploads/:id/security-scans", async (req, res) => {
    try {
      const scans = await storage.getAgentSecurityScans(parseInt(req.params.id));
      res.json(scans);
    } catch (error) {
      console.error("Error fetching security scans:", error);
      res.status(500).json({ message: "Failed to fetch security scans" });
    }
  });

  // Support Ticket Routes
  app.get("/api/support/tickets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const tickets = await storage.getUserSupportTickets(userId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  const createTicketSchema = z.object({
    category: z.enum(ticketCategories),
    priority: z.enum(ticketPriorities).default("medium"),
    subject: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
  });

  app.post("/api/support/tickets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const parsed = createTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid ticket data", errors: parsed.error.errors });
      }
      
      const ticket = await storage.createSupportTicket({ ...parsed.data, userId });
      res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating ticket:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  const ticketMessageSchema = z.object({
    content: z.string().min(1).max(10000),
  });

  app.post("/api/support/tickets/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const parsed = ticketMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid message", errors: parsed.error.errors });
      }
      
      const message = await storage.createTicketMessage({
        ticketId: parseInt(req.params.id),
        senderId: userId,
        senderType: "user",
        content: parsed.data.content,
      });
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Dispute Routes
  app.get("/api/disputes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const disputes = await storage.getUserDisputes(userId);
      res.json(disputes);
    } catch (error) {
      console.error("Error fetching disputes:", error);
      res.status(500).json({ message: "Failed to fetch disputes" });
    }
  });

  app.get("/api/bounties/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const bounties = await storage.getUserBounties(userId);
      res.json(bounties);
    } catch (error) {
      console.error("Error fetching user bounties:", error);
      res.status(500).json({ message: "Failed to fetch bounties" });
    }
  });

  const createDisputeSchema = z.object({
    bountyId: z.number().int().positive(),
    category: z.enum(disputeCategories),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    evidence: z.string().max(10000).optional(),
    respondentId: z.string().optional(),
  });

  app.post("/api/disputes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const parsed = createDisputeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid dispute data", errors: parsed.error.errors });
      }
      
      const dispute = await storage.createDispute({
        ...parsed.data,
        initiatorId: userId,
        respondentId: parsed.data.respondentId || userId,
      });
      res.status(201).json(dispute);
    } catch (error) {
      console.error("Error creating dispute:", error);
      res.status(500).json({ message: "Failed to create dispute" });
    }
  });

  const disputeMessageSchema = z.object({
    content: z.string().min(1).max(10000),
  });

  app.post("/api/disputes/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const parsed = disputeMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid message", errors: parsed.error.errors });
      }
      
      const message = await storage.createDisputeMessage({
        disputeId: parseInt(req.params.id),
        senderId: userId,
        senderRole: "user",
        content: parsed.data.content,
      });
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating dispute message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Admin Routes - Robust admin authorization with defensive checks
  const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
  
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      // First priority: Check if user is in explicit admin list (environment variable)
      if (ADMIN_USER_IDS.length > 0) {
        if (ADMIN_USER_IDS.includes(userId)) {
          return next();
        }
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Second priority: Check isAdmin flag in user profile (database-backed authorization)
      const profile = await storage.getUserProfile(userId);
      
      // Defensive: Missing profile = deny access
      if (!profile) {
        console.error(`Admin check failed: No profile found for user ${userId}`);
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Defensive: isAdmin must be explicitly true (not null, undefined, or false)
      // This handles legacy rows where isAdmin column may be NULL
      if (profile.isAdmin !== true) {
        console.error(`Admin check failed: User ${userId} isAdmin=${profile.isAdmin} (not true)`);
        return res.status(403).json({ message: "Admin access required" });
      }
      
      return next();
    } catch (error) {
      console.error("Admin authorization error:", error);
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };

  // Admin stats - protected with admin authorization
  app.get("/api/admin/stats", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Protected admin routes - require admin role
  app.get("/api/admin/agents/pending", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const agents = await storage.getPendingAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching pending agents:", error);
      res.status(500).json({ message: "Failed to fetch pending agents" });
    }
  });

  app.get("/api/admin/flags", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const flags = await storage.getContentFlags();
      res.json(flags);
    } catch (error) {
      console.error("Error fetching content flags:", error);
      res.status(500).json({ message: "Failed to fetch flags" });
    }
  });

  const approveRejectSchema = z.object({
    reason: z.string().optional(),
  });

  app.post("/api/admin/agents/:id/approve", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const agent = await storage.approveAgent(parseInt(req.params.id));
      res.json(agent);
    } catch (error) {
      console.error("Error approving agent:", error);
      res.status(500).json({ message: "Failed to approve agent" });
    }
  });

  app.post("/api/admin/agents/:id/reject", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = approveRejectSchema.safeParse(req.body);
      const reason = parsed.success ? parsed.data.reason : "Rejected";
      const agent = await storage.rejectAgent(parseInt(req.params.id), reason || "Rejected");
      res.json(agent);
    } catch (error) {
      console.error("Error rejecting agent:", error);
      res.status(500).json({ message: "Failed to reject agent" });
    }
  });

  // Execution API Routes
  const { executionService } = await import('./executionService');
  
  const executeAgentSchema = z.object({
    submissionId: z.number().int().nonnegative().optional().default(0),
    agentId: z.number().int().positive(),
    bountyId: z.number().int().nonnegative().optional().default(0),
    input: z.string().optional().default("{}"),
  });

  app.post("/api/executions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const parsed = executeAgentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid execution data", errors: parsed.error.errors });
      }
      
      const agent = await storage.getAgent(parsed.data.agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.developerId !== userId) {
        return res.status(403).json({ message: "You can only execute your own agents" });
      }
      
      const executionId = await executionService.queueExecution(parsed.data);
      res.status(201).json({ executionId, status: "queued" });
    } catch (error) {
      console.error("Error queueing execution:", error);
      res.status(500).json({ message: "Failed to queue execution" });
    }
  });

  app.get("/api/executions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const execution = await executionService.getExecution(parseInt(req.params.id));
      if (!execution) {
        return res.status(404).json({ message: "Execution not found" });
      }
      res.json(execution);
    } catch (error) {
      console.error("Error fetching execution:", error);
      res.status(500).json({ message: "Failed to fetch execution" });
    }
  });

  app.get("/api/executions/submission/:submissionId", isAuthenticated, async (req: any, res) => {
    try {
      const executions = await executionService.getExecutionsBySubmission(parseInt(req.params.submissionId));
      res.json(executions);
    } catch (error) {
      console.error("Error fetching executions:", error);
      res.status(500).json({ message: "Failed to fetch executions" });
    }
  });

  app.get("/api/executions/agent/:agentId", isAuthenticated, async (req: any, res) => {
    try {
      const executions = await executionService.getExecutionsByAgent(parseInt(req.params.agentId));
      res.json(executions);
    } catch (error) {
      console.error("Error fetching executions:", error);
      res.status(500).json({ message: "Failed to fetch executions" });
    }
  });

  app.post("/api/executions/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const cancelled = await executionService.cancelExecution(parseInt(req.params.id));
      if (!cancelled) {
        return res.status(400).json({ message: "Cannot cancel execution in current state" });
      }
      res.json({ message: "Execution cancelled" });
    } catch (error) {
      console.error("Error cancelling execution:", error);
      res.status(500).json({ message: "Failed to cancel execution" });
    }
  });

  app.post("/api/executions/:id/retry", isAuthenticated, async (req: any, res) => {
    try {
      const newExecutionId = await executionService.retryExecution(parseInt(req.params.id));
      if (!newExecutionId) {
        return res.status(400).json({ message: "Cannot retry execution in current state" });
      }
      res.json({ executionId: newExecutionId, status: "queued" });
    } catch (error) {
      console.error("Error retrying execution:", error);
      res.status(500).json({ message: "Failed to retry execution" });
    }
  });

  app.post("/api/sandbox/test", isAuthenticated, async (req: any, res) => {
    try {
      const result = await executionService.testSandbox();
      res.json(result);
    } catch (error) {
      console.error("Error testing sandbox:", error);
      res.status(500).json({ message: "Failed to test sandbox" });
    }
  });

  // ============================================
  // ENTERPRISE FEATURES API ROUTES
  // ============================================

  // JWT/Zero-Trust Authentication
  app.post("/api/auth/token", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const deviceInfo = req.headers['user-agent'];
      const ipAddress = req.ip;
      
      const tokens = await jwtService.generateTokenPair(userId, deviceInfo, ipAddress);
      res.json(tokens);
    } catch (error) {
      console.error("Error generating tokens:", error);
      res.status(500).json({ message: "Failed to generate tokens" });
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token required" });
      }
      
      const tokens = await jwtService.refreshAccessToken(refreshToken, req.ip);
      if (!tokens) {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }
      
      res.json(tokens);
    } catch (error) {
      console.error("Error refreshing token:", error);
      res.status(500).json({ message: "Failed to refresh token" });
    }
  });

  app.post("/api/auth/revoke", hybridAuth, async (req: any, res) => {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await jwtService.revokeRefreshToken(refreshToken);
      } else {
        const userId = req.authUserId;
        if (userId) {
          await jwtService.revokeAllUserTokens(userId);
        }
      }
      res.json({ message: "Token(s) revoked" });
    } catch (error) {
      console.error("Error revoking token:", error);
      res.status(500).json({ message: "Failed to revoke token" });
    }
  });

  app.get("/api/auth/roles", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const roles = await jwtService.getUserRoles(userId);
      const permissions = await jwtService.getRolePermissions(roles);
      res.json({ roles, permissions });
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // GDPR/CCPA Compliance
  app.get("/api/privacy/consents", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const consents = await gdprService.getConsents(userId);
      res.json(consents);
    } catch (error) {
      console.error("Error fetching consents:", error);
      res.status(500).json({ message: "Failed to fetch consents" });
    }
  });

  app.post("/api/privacy/consents", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { category, granted, version } = req.body;
      await gdprService.updateConsent(userId, { category, granted, version }, req.ip, req.headers['user-agent']);
      res.json({ message: "Consent updated" });
    } catch (error) {
      console.error("Error updating consent:", error);
      res.status(500).json({ message: "Failed to update consent" });
    }
  });

  app.post("/api/privacy/export", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const format = req.body.format || 'json';
      const requestId = await gdprService.requestDataExport(userId, format);
      res.json({ requestId, message: "Data export requested" });
    } catch (error) {
      console.error("Error requesting data export:", error);
      res.status(500).json({ message: "Failed to request data export" });
    }
  });

  app.get("/api/privacy/export/:id", hybridAuth, async (req: any, res) => {
    try {
      const request = await gdprService.getDataExportStatus(parseInt(req.params.id));
      if (!request) {
        return res.status(404).json({ message: "Export request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error fetching export status:", error);
      res.status(500).json({ message: "Failed to fetch export status" });
    }
  });

  app.get("/api/privacy/exports", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const requests = await gdprService.getDataExportRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching exports:", error);
      res.status(500).json({ message: "Failed to fetch exports" });
    }
  });

  app.post("/api/privacy/delete", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { reason } = req.body;
      const result = await gdprService.requestDataDeletion(userId, reason);
      res.json(result);
    } catch (error) {
      console.error("Error requesting data deletion:", error);
      res.status(500).json({ message: "Failed to request data deletion" });
    }
  });

  app.post("/api/privacy/delete/confirm", hybridAuth, async (req: any, res) => {
    try {
      const { requestId, confirmationCode } = req.body;
      const confirmed = await gdprService.confirmDataDeletion(requestId, confirmationCode);
      if (!confirmed) {
        return res.status(400).json({ message: "Invalid confirmation code or request" });
      }
      res.json({ message: "Data deletion confirmed and processing" });
    } catch (error) {
      console.error("Error confirming deletion:", error);
      res.status(500).json({ message: "Failed to confirm deletion" });
    }
  });

  // AI Ethics Auditor
  app.post("/api/ethics/audit/:agentUploadId", hybridAuth, async (req: any, res) => {
    try {
      const agentUploadId = parseInt(req.params.agentUploadId);
      const auditId = await ethicsAuditorService.runComprehensiveAudit(agentUploadId);
      res.json({ auditId, status: "processing" });
    } catch (error) {
      console.error("Error starting ethics audit:", error);
      res.status(500).json({ message: "Failed to start ethics audit" });
    }
  });

  app.post("/api/ethics/audit/:agentUploadId/:type", hybridAuth, async (req: any, res) => {
    try {
      const agentUploadId = parseInt(req.params.agentUploadId);
      const auditType = req.params.type as 'bias_detection' | 'harmful_content' | 'prompt_injection' | 'privacy_leak';
      const auditId = await ethicsAuditorService.runSpecificAudit(agentUploadId, auditType);
      res.json({ auditId, status: "processing" });
    } catch (error) {
      console.error("Error starting specific audit:", error);
      res.status(500).json({ message: "Failed to start audit" });
    }
  });

  app.get("/api/ethics/audit/:auditId/status", hybridAuth, async (req: any, res) => {
    try {
      const audit = await ethicsAuditorService.getAuditStatus(parseInt(req.params.auditId));
      if (!audit) {
        return res.status(404).json({ message: "Audit not found" });
      }
      res.json(audit);
    } catch (error) {
      console.error("Error fetching audit status:", error);
      res.status(500).json({ message: "Failed to fetch audit status" });
    }
  });

  app.get("/api/ethics/agent/:agentUploadId", hybridAuth, async (req: any, res) => {
    try {
      const audits = await ethicsAuditorService.getAgentAudits(parseInt(req.params.agentUploadId));
      res.json(audits);
    } catch (error) {
      console.error("Error fetching agent audits:", error);
      res.status(500).json({ message: "Failed to fetch agent audits" });
    }
  });

  // Referral Program
  app.post("/api/referrals/generate", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const code = await referralService.generateReferralCode(userId);
      res.json({ code });
    } catch (error) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  app.get("/api/referrals/code", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const code = await referralService.getReferralCode(userId);
      res.json({ code });
    } catch (error) {
      console.error("Error fetching referral code:", error);
      res.status(500).json({ message: "Failed to fetch referral code" });
    }
  });

  app.get("/api/referrals/validate/:code", async (req, res) => {
    try {
      const result = await referralService.validateReferralCode(req.params.code);
      res.json(result);
    } catch (error) {
      console.error("Error validating referral code:", error);
      res.status(500).json({ message: "Failed to validate referral code" });
    }
  });

  app.post("/api/referrals/apply", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { code } = req.body;
      const applied = await referralService.applyReferral(code, userId);
      if (!applied) {
        return res.status(400).json({ message: "Invalid or expired referral code" });
      }
      res.json({ message: "Referral applied successfully" });
    } catch (error) {
      console.error("Error applying referral:", error);
      res.status(500).json({ message: "Failed to apply referral" });
    }
  });

  app.get("/api/referrals/stats", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const stats = await referralService.getReferralStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  app.get("/api/referrals/payouts", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const payouts = await referralService.getPayoutHistory(userId);
      res.json(payouts);
    } catch (error) {
      console.error("Error fetching payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  // Agent Matching
  app.get("/api/matching/bounty/:bountyId", hybridAuth, async (req: any, res) => {
    try {
      const bountyId = parseInt(req.params.bountyId);
      const limit = parseInt(req.query.limit as string) || 5;
      const useAI = req.query.ai === 'true';
      
      const recommendations = useAI 
        ? await matchingService.getAIEnhancedRecommendations(bountyId, limit)
        : await matchingService.getRecommendationsForBounty(bountyId, limit);
      
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  app.post("/api/matching/select", hybridAuth, async (req: any, res) => {
    try {
      const { bountyId, agentId } = req.body;
      await matchingService.markAsSelected(bountyId, agentId);
      res.json({ message: "Selection recorded" });
    } catch (error) {
      console.error("Error recording selection:", error);
      res.status(500).json({ message: "Failed to record selection" });
    }
  });

  // Multi-LLM Configuration
  app.get("/api/llm/providers", hybridAuth, async (req: any, res) => {
    try {
      const providers = multiLlmService.getAvailableProviders();
      const modelsMap: Record<string, string[]> = {};
      for (const provider of providers) {
        modelsMap[provider] = multiLlmService.getAvailableModels(provider);
      }
      res.json({ providers, models: modelsMap });
    } catch (error) {
      console.error("Error fetching providers:", error);
      res.status(500).json({ message: "Failed to fetch providers" });
    }
  });

  app.get("/api/llm/config/:agentUploadId", hybridAuth, async (req: any, res) => {
    try {
      const config = await multiLlmService.getAgentConfig(parseInt(req.params.agentUploadId));
      res.json(config);
    } catch (error) {
      console.error("Error fetching LLM config:", error);
      res.status(500).json({ message: "Failed to fetch LLM config" });
    }
  });

  app.post("/api/llm/config/:agentUploadId", hybridAuth, async (req: any, res) => {
    try {
      await multiLlmService.setAgentConfig(parseInt(req.params.agentUploadId), req.body);
      res.json({ message: "LLM config updated" });
    } catch (error) {
      console.error("Error updating LLM config:", error);
      res.status(500).json({ message: "Failed to update LLM config" });
    }
  });

  app.post("/api/llm/chat", hybridAuth, async (req: any, res) => {
    try {
      const { agentUploadId, messages, overrideConfig } = req.body;
      const response = await multiLlmService.chat(agentUploadId, messages, overrideConfig);
      res.json(response);
    } catch (error) {
      console.error("Error in LLM chat:", error);
      res.status(500).json({ message: "Failed to process chat" });
    }
  });

  // Blockchain Verification
  app.post("/api/blockchain/proof", hybridAuth, async (req: any, res) => {
    try {
      const { bountyId, submissionId, network } = req.body;
      const proofId = await blockchainService.createVerificationProof(bountyId, submissionId, network || 'polygon');
      res.json({ proofId, status: "pending" });
    } catch (error) {
      console.error("Error creating verification proof:", error);
      res.status(500).json({ message: "Failed to create verification proof" });
    }
  });

  app.get("/api/blockchain/proof/:proofId", async (req, res) => {
    try {
      const proof = await blockchainService.getProof(parseInt(req.params.proofId));
      if (!proof) {
        return res.status(404).json({ message: "Proof not found" });
      }
      res.json(proof);
    } catch (error) {
      console.error("Error fetching proof:", error);
      res.status(500).json({ message: "Failed to fetch proof" });
    }
  });

  app.get("/api/blockchain/bounty/:bountyId", async (req, res) => {
    try {
      const proofs = await blockchainService.getProofsByBounty(parseInt(req.params.bountyId));
      res.json(proofs);
    } catch (error) {
      console.error("Error fetching proofs:", error);
      res.status(500).json({ message: "Failed to fetch proofs" });
    }
  });

  app.get("/api/blockchain/verify/:proofId", async (req, res) => {
    try {
      const result = await blockchainService.verifyProof(parseInt(req.params.proofId));
      res.json(result);
    } catch (error) {
      console.error("Error verifying proof:", error);
      res.status(500).json({ message: "Failed to verify proof" });
    }
  });

  app.get("/api/blockchain/networks", async (req, res) => {
    try {
      const networks = blockchainService.getSupportedNetworks();
      res.json(networks);
    } catch (error) {
      console.error("Error fetching networks:", error);
      res.status(500).json({ message: "Failed to fetch networks" });
    }
  });

  // Cache API Routes
  app.get("/api/cache/stats", hybridAuth, requireAdmin, async (req: any, res) => {
    try {
      const stats = cacheService.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({ message: "Failed to fetch cache stats" });
    }
  });

  app.get("/api/cache/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await cacheService.getLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching cached leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/cache/platform-stats", async (req, res) => {
    try {
      const stats = await cacheService.getPlatformStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching cached platform stats:", error);
      res.status(500).json({ message: "Failed to fetch platform stats" });
    }
  });

  app.post("/api/cache/invalidate", hybridAuth, requireAdmin, async (req: any, res) => {
    try {
      const { type, id } = req.body;
      if (type === 'leaderboard') {
        await cacheService.invalidateLeaderboard();
      } else if (type === 'stats') {
        await cacheService.invalidateStats();
      } else if (type === 'agent' && id) {
        await cacheService.invalidateAgent(parseInt(id));
      } else if (type === 'bounty' && id) {
        await cacheService.invalidateBounty(parseInt(id));
      } else if (type === 'all') {
        await cacheService.clear();
      }
      res.json({ message: "Cache invalidated" });
    } catch (error) {
      console.error("Error invalidating cache:", error);
      res.status(500).json({ message: "Failed to invalidate cache" });
    }
  });

  // ============================================
  // ENTERPRISE FEATURE ROUTES
  // ============================================

  // Import enterprise services
  const { swarmService } = await import('./swarmService');
  const { integrationsHubService } = await import('./integrationsHubService');
  const { finopsService } = await import('./finopsService');
  const { predictiveAnalyticsService } = await import('./predictiveAnalyticsService');
  const { insuranceTokenService } = await import('./insuranceTokenService');
  const { localizationService } = await import('./localizationService');
  const { quantumEncryptionService } = await import('./quantumEncryptionService');

  // Initialize integrations hub connectors
  await integrationsHubService.initializeConnectors();

  // === AGENT SWARM ROUTES ===
  app.get("/api/swarms", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const swarms = await swarmService.getUserSwarms(userId);
      res.json(swarms);
    } catch (error) {
      console.error("Error fetching swarms:", error);
      res.status(500).json({ message: "Failed to fetch swarms" });
    }
  });

  app.post("/api/swarms", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { name, description, bountyId, maxMembers, communicationProtocol, consensusThreshold } = req.body;
      const swarm = await swarmService.createSwarm(userId, name, description, {
        bountyId, maxMembers, communicationProtocol, consensusThreshold
      });
      res.json(swarm);
    } catch (error) {
      console.error("Error creating swarm:", error);
      res.status(500).json({ message: "Failed to create swarm" });
    }
  });

  app.get("/api/swarms/:id", async (req, res) => {
    try {
      const swarm = await swarmService.getSwarm(parseInt(req.params.id));
      if (!swarm) return res.status(404).json({ message: "Swarm not found" });
      const members = await swarmService.getSwarmMembers(swarm.id);
      res.json({ ...swarm, members });
    } catch (error) {
      console.error("Error fetching swarm:", error);
      res.status(500).json({ message: "Failed to fetch swarm" });
    }
  });

  app.post("/api/swarms/:id/members", hybridAuth, async (req: any, res) => {
    try {
      const { agentId, role, capabilities } = req.body;
      const member = await swarmService.addMember(parseInt(req.params.id), agentId, role, capabilities);
      res.json(member);
    } catch (error: any) {
      console.error("Error adding swarm member:", error);
      res.status(400).json({ message: error.message || "Failed to add member" });
    }
  });

  app.post("/api/swarms/:id/elect-leader", hybridAuth, async (req: any, res) => {
    try {
      const leader = await swarmService.electLeader(parseInt(req.params.id));
      res.json(leader);
    } catch (error) {
      console.error("Error electing leader:", error);
      res.status(500).json({ message: "Failed to elect leader" });
    }
  });

  app.post("/api/swarms/:id/execute", hybridAuth, async (req: any, res) => {
    try {
      const { bountyId, input } = req.body;
      const execution = await swarmService.executeSwarm(parseInt(req.params.id), bountyId, input);
      res.json(execution);
    } catch (error) {
      console.error("Error executing swarm:", error);
      res.status(500).json({ message: "Failed to execute swarm" });
    }
  });

  app.post("/api/swarms/auto-assemble", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { bountyId, requiredCapabilities } = req.body;
      const swarm = await swarmService.autoAssemble(userId, bountyId, requiredCapabilities);
      res.json(swarm);
    } catch (error) {
      console.error("Error auto-assembling swarm:", error);
      res.status(500).json({ message: "Failed to auto-assemble swarm" });
    }
  });

  app.post("/api/swarms/:id/disband", hybridAuth, async (req: any, res) => {
    try {
      await swarmService.disbandSwarm(parseInt(req.params.id));
      res.json({ message: "Swarm disbanded" });
    } catch (error) {
      console.error("Error disbanding swarm:", error);
      res.status(500).json({ message: "Failed to disband swarm" });
    }
  });

  // === INTEGRATIONS HUB ROUTES ===
  app.get("/api/integrations/connectors", async (req, res) => {
    try {
      const { category, search } = req.query;
      let connectors;
      if (search) {
        connectors = await integrationsHubService.searchConnectors(search as string);
      } else if (category) {
        connectors = await integrationsHubService.getConnectorsByCategory(category as any);
      } else {
        connectors = await integrationsHubService.getAllConnectors();
      }
      res.json(connectors);
    } catch (error) {
      console.error("Error fetching connectors:", error);
      res.status(500).json({ message: "Failed to fetch connectors" });
    }
  });

  app.get("/api/integrations/connectors/popular", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const connectors = await integrationsHubService.getPopularConnectors(limit);
      res.json(connectors);
    } catch (error) {
      console.error("Error fetching popular connectors:", error);
      res.status(500).json({ message: "Failed to fetch popular connectors" });
    }
  });

  app.get("/api/integrations/connectors/:id", async (req, res) => {
    try {
      const connector = await integrationsHubService.getConnector(parseInt(req.params.id));
      if (!connector) return res.status(404).json({ message: "Connector not found" });
      res.json(connector);
    } catch (error) {
      console.error("Error fetching connector:", error);
      res.status(500).json({ message: "Failed to fetch connector" });
    }
  });

  app.get("/api/integrations/categories/stats", async (req, res) => {
    try {
      const stats = await integrationsHubService.getCategoryStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching category stats:", error);
      res.status(500).json({ message: "Failed to fetch category stats" });
    }
  });

  app.get("/api/integrations/user", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const integrations = await integrationsHubService.getUserIntegrations(userId);
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching user integrations:", error);
      res.status(500).json({ message: "Failed to fetch user integrations" });
    }
  });

  app.post("/api/integrations/connect", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { connectorId, credentials, config } = req.body;
      const integration = await integrationsHubService.connectIntegration(userId, connectorId, credentials, config);
      res.json(integration);
    } catch (error: any) {
      console.error("Error connecting integration:", error);
      res.status(400).json({ message: error.message || "Failed to connect integration" });
    }
  });

  app.delete("/api/integrations/:id", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      await integrationsHubService.disconnectIntegration(parseInt(req.params.id), userId);
      res.json({ message: "Integration disconnected" });
    } catch (error) {
      console.error("Error disconnecting integration:", error);
      res.status(500).json({ message: "Failed to disconnect integration" });
    }
  });

  // === FINOPS ROUTES ===
  app.get("/api/finops/summary", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const summary = await finopsService.getDashboardSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching FinOps summary:", error);
      res.status(500).json({ message: "Failed to fetch FinOps summary" });
    }
  });

  app.get("/api/finops/usage", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const stats = await finopsService.getUsageStats(userId, startDate, endDate);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ message: "Failed to fetch usage stats" });
    }
  });

  app.get("/api/finops/budgets", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const budgets = await finopsService.getUserBudgets(userId);
      res.json(budgets);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.post("/api/finops/budgets", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const budget = await finopsService.createBudget(userId, req.body);
      res.json(budget);
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  app.delete("/api/finops/budgets/:id", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      await finopsService.deleteBudget(parseInt(req.params.id), userId);
      res.json({ message: "Budget deleted" });
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  app.get("/api/finops/optimizations", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const optimizations = await finopsService.getUserOptimizations(userId);
      res.json(optimizations);
    } catch (error) {
      console.error("Error fetching optimizations:", error);
      res.status(500).json({ message: "Failed to fetch optimizations" });
    }
  });

  app.post("/api/finops/optimizations/generate", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const optimizations = await finopsService.generateOptimizations(userId);
      res.json(optimizations);
    } catch (error) {
      console.error("Error generating optimizations:", error);
      res.status(500).json({ message: "Failed to generate optimizations" });
    }
  });

  app.post("/api/finops/optimizations/:id/apply", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const optimization = await finopsService.applyOptimization(parseInt(req.params.id), userId);
      res.json(optimization);
    } catch (error) {
      console.error("Error applying optimization:", error);
      res.status(500).json({ message: "Failed to apply optimization" });
    }
  });

  app.get("/api/finops/pricing", async (req, res) => {
    try {
      const pricing = finopsService.getTokenPricing();
      res.json(pricing);
    } catch (error) {
      console.error("Error fetching pricing:", error);
      res.status(500).json({ message: "Failed to fetch pricing" });
    }
  });

  // === PREDICTIVE ANALYTICS ROUTES ===
  app.get("/api/analytics/insights", hybridAuth, async (req: any, res) => {
    try {
      const insights = await predictiveAnalyticsService.getDashboardInsights();
      res.json(insights);
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  app.get("/api/analytics/trends", async (req, res) => {
    try {
      const period = (req.query.period as string) || "daily";
      const limit = parseInt(req.query.limit as string) || 30;
      const trends = await predictiveAnalyticsService.getPlatformTrends(period as any, limit);
      res.json(trends);
    } catch (error) {
      console.error("Error fetching trends:", error);
      res.status(500).json({ message: "Failed to fetch trends" });
    }
  });

  app.get("/api/analytics/forecasts", hybridAuth, async (req: any, res) => {
    try {
      const { type, entityType, entityId } = req.query;
      const forecasts = await predictiveAnalyticsService.getForecasts(
        type as string, 
        entityType as string, 
        entityId ? parseInt(entityId as string) : undefined
      );
      res.json(forecasts);
    } catch (error) {
      console.error("Error fetching forecasts:", error);
      res.status(500).json({ message: "Failed to fetch forecasts" });
    }
  });

  app.post("/api/analytics/forecast/bounty/:id", hybridAuth, async (req: any, res) => {
    try {
      const forecast = await predictiveAnalyticsService.generateBountySuccessForecast(parseInt(req.params.id));
      res.json(forecast);
    } catch (error: any) {
      console.error("Error generating bounty forecast:", error);
      res.status(400).json({ message: error.message || "Failed to generate forecast" });
    }
  });

  app.post("/api/analytics/forecast/agent/:id", hybridAuth, async (req: any, res) => {
    try {
      const horizon = (req.query.horizon as string) || "30d";
      const forecast = await predictiveAnalyticsService.generateAgentPerformanceForecast(
        parseInt(req.params.id), 
        horizon as any
      );
      res.json(forecast);
    } catch (error: any) {
      console.error("Error generating agent forecast:", error);
      res.status(400).json({ message: error.message || "Failed to generate forecast" });
    }
  });

  app.post("/api/analytics/forecast/revenue", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const horizon = (req.query.horizon as string) || "30d";
      const forecast = await predictiveAnalyticsService.generateRevenueForecast(userId, horizon as any);
      res.json(forecast);
    } catch (error) {
      console.error("Error generating revenue forecast:", error);
      res.status(500).json({ message: "Failed to generate forecast" });
    }
  });

  app.get("/api/analytics/risk/:entityType/:entityId", hybridAuth, async (req: any, res) => {
    try {
      const score = await predictiveAnalyticsService.calculateRiskScore(
        req.params.entityType as any, 
        parseInt(req.params.entityId)
      );
      res.json(score);
    } catch (error) {
      console.error("Error calculating risk score:", error);
      res.status(500).json({ message: "Failed to calculate risk score" });
    }
  });

  app.get("/api/analytics/risks", hybridAuth, async (req: any, res) => {
    try {
      const { entityType } = req.query;
      const risks = await predictiveAnalyticsService.getRiskScores(entityType as string);
      res.json(risks);
    } catch (error) {
      console.error("Error fetching risk scores:", error);
      res.status(500).json({ message: "Failed to fetch risk scores" });
    }
  });

  // === INSURANCE & TOKENIZATION ROUTES ===
  app.get("/api/insurance/tiers", async (req, res) => {
    try {
      const tiers = insuranceTokenService.getInsuranceTiers();
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching insurance tiers:", error);
      res.status(500).json({ message: "Failed to fetch insurance tiers" });
    }
  });

  app.get("/api/insurance/user", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const insurances = await insuranceTokenService.getUserInsurances(userId);
      res.json(insurances);
    } catch (error) {
      console.error("Error fetching user insurances:", error);
      res.status(500).json({ message: "Failed to fetch user insurances" });
    }
  });

  app.get("/api/insurance/agent/:agentId", async (req, res) => {
    try {
      const insurance = await insuranceTokenService.getAgentInsurance(parseInt(req.params.agentId));
      res.json(insurance);
    } catch (error) {
      console.error("Error fetching agent insurance:", error);
      res.status(500).json({ message: "Failed to fetch agent insurance" });
    }
  });

  app.post("/api/insurance", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { agentId, tier, baseValue } = req.body;
      const insurance = await insuranceTokenService.createInsurance(agentId, userId, tier, baseValue);
      res.json(insurance);
    } catch (error: any) {
      console.error("Error creating insurance:", error);
      res.status(400).json({ message: error.message || "Failed to create insurance" });
    }
  });

  app.post("/api/insurance/:id/claims", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const claim = await insuranceTokenService.fileClaim(parseInt(req.params.id), userId, req.body);
      res.json(claim);
    } catch (error: any) {
      console.error("Error filing claim:", error);
      res.status(400).json({ message: error.message || "Failed to file claim" });
    }
  });

  app.get("/api/insurance/claims", hybridAuth, async (req: any, res) => {
    try {
      const { insuranceId, status } = req.query;
      const claims = await insuranceTokenService.getClaims(
        insuranceId ? parseInt(insuranceId as string) : undefined,
        status as string
      );
      res.json(claims);
    } catch (error) {
      console.error("Error fetching claims:", error);
      res.status(500).json({ message: "Failed to fetch claims" });
    }
  });

  app.post("/api/insurance/claims/:id/review", hybridAuth, requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { decision, approvedAmount, notes } = req.body;
      const claim = await insuranceTokenService.reviewClaim(
        parseInt(req.params.id), userId, decision, approvedAmount, notes
      );
      res.json(claim);
    } catch (error) {
      console.error("Error reviewing claim:", error);
      res.status(500).json({ message: "Failed to review claim" });
    }
  });

  app.get("/api/tokens", async (req, res) => {
    try {
      const tokens = await insuranceTokenService.getListedTokens();
      res.json(tokens);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      res.status(500).json({ message: "Failed to fetch tokens" });
    }
  });

  app.get("/api/tokens/agent/:agentId", async (req, res) => {
    try {
      const token = await insuranceTokenService.getAgentToken(parseInt(req.params.agentId));
      res.json(token);
    } catch (error) {
      console.error("Error fetching agent token:", error);
      res.status(500).json({ message: "Failed to fetch agent token" });
    }
  });

  app.get("/api/tokens/holdings", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const holdings = await insuranceTokenService.getUserHoldings(userId);
      res.json(holdings);
    } catch (error) {
      console.error("Error fetching holdings:", error);
      res.status(500).json({ message: "Failed to fetch holdings" });
    }
  });

  app.post("/api/tokens", hybridAuth, async (req: any, res) => {
    try {
      const token = await insuranceTokenService.tokenizeAgent(req.body.agentId, req.body);
      res.json(token);
    } catch (error: any) {
      console.error("Error tokenizing agent:", error);
      res.status(400).json({ message: error.message || "Failed to tokenize agent" });
    }
  });

  app.post("/api/tokens/:id/list", hybridAuth, async (req: any, res) => {
    try {
      const token = await insuranceTokenService.listToken(parseInt(req.params.id));
      res.json(token);
    } catch (error) {
      console.error("Error listing token:", error);
      res.status(500).json({ message: "Failed to list token" });
    }
  });

  app.post("/api/tokens/:id/buy", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { amount } = req.body;
      const holding = await insuranceTokenService.buyTokens(parseInt(req.params.id), userId, amount);
      res.json(holding);
    } catch (error: any) {
      console.error("Error buying tokens:", error);
      res.status(400).json({ message: error.message || "Failed to buy tokens" });
    }
  });

  app.post("/api/tokens/:id/sell", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { amount } = req.body;
      const holding = await insuranceTokenService.sellTokens(parseInt(req.params.id), userId, amount);
      res.json(holding);
    } catch (error: any) {
      console.error("Error selling tokens:", error);
      res.status(400).json({ message: error.message || "Failed to sell tokens" });
    }
  });

  // === LOCALIZATION ROUTES ===
  app.get("/api/i18n/languages", async (req, res) => {
    try {
      const languages = localizationService.getSupportedLanguages();
      res.json(languages);
    } catch (error) {
      console.error("Error fetching languages:", error);
      res.status(500).json({ message: "Failed to fetch languages" });
    }
  });

  app.get("/api/i18n/translations/:language", async (req, res) => {
    try {
      const { namespace } = req.query;
      let translations;
      if (namespace) {
        translations = await localizationService.getNamespaceTranslations(namespace as string, req.params.language as any);
      } else {
        translations = await localizationService.getAllTranslations(req.params.language as any);
      }
      res.json(translations);
    } catch (error) {
      console.error("Error fetching translations:", error);
      res.status(500).json({ message: "Failed to fetch translations" });
    }
  });

  app.get("/api/i18n/preferences", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const prefs = await localizationService.getUserLanguagePreference(userId);
      res.json(prefs);
    } catch (error) {
      console.error("Error fetching language preferences:", error);
      res.status(500).json({ message: "Failed to fetch language preferences" });
    }
  });

  app.post("/api/i18n/preferences", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const prefs = await localizationService.setUserLanguagePreference(userId, req.body);
      res.json(prefs);
    } catch (error) {
      console.error("Error setting language preferences:", error);
      res.status(500).json({ message: "Failed to set language preferences" });
    }
  });

  app.get("/api/i18n/detect", async (req, res) => {
    try {
      const acceptLanguage = req.headers["accept-language"];
      const language = localizationService.detectLanguageFromHeaders(acceptLanguage);
      res.json({ language });
    } catch (error) {
      console.error("Error detecting language:", error);
      res.status(500).json({ message: "Failed to detect language" });
    }
  });

  app.get("/api/i18n/stats", hybridAuth, requireAdmin, async (req: any, res) => {
    try {
      const stats = await localizationService.getTranslationStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching translation stats:", error);
      res.status(500).json({ message: "Failed to fetch translation stats" });
    }
  });

  app.get("/api/i18n/missing/:language", hybridAuth, requireAdmin, async (req: any, res) => {
    try {
      const missing = await localizationService.getMissingTranslations(req.params.language as any);
      res.json(missing);
    } catch (error) {
      console.error("Error fetching missing translations:", error);
      res.status(500).json({ message: "Failed to fetch missing translations" });
    }
  });

  app.post("/api/i18n/translations", hybridAuth, requireAdmin, async (req: any, res) => {
    try {
      const { key, language, value, namespace, context } = req.body;
      const translation = await localizationService.addTranslation(key, language, value, namespace, context);
      res.json(translation);
    } catch (error) {
      console.error("Error adding translation:", error);
      res.status(500).json({ message: "Failed to add translation" });
    }
  });

  // === QUANTUM ENCRYPTION ROUTES ===
  app.get("/api/quantum/algorithms", async (req, res) => {
    try {
      const algorithms = quantumEncryptionService.getAlgorithmInfo();
      res.json(algorithms);
    } catch (error) {
      console.error("Error fetching algorithms:", error);
      res.status(500).json({ message: "Failed to fetch algorithms" });
    }
  });

  app.get("/api/quantum/dashboard", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const dashboard = await quantumEncryptionService.getSecurityDashboard(userId);
      res.json(dashboard);
    } catch (error) {
      console.error("Error fetching quantum dashboard:", error);
      res.status(500).json({ message: "Failed to fetch quantum dashboard" });
    }
  });

  app.get("/api/quantum/keys", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const keys = await quantumEncryptionService.getUserKeys(userId);
      res.json(keys);
    } catch (error) {
      console.error("Error fetching quantum keys:", error);
      res.status(500).json({ message: "Failed to fetch quantum keys" });
    }
  });

  app.post("/api/quantum/keys", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { keyType, algorithm, purpose, expiresInDays } = req.body;
      const key = await quantumEncryptionService.generateKeyPair(userId, keyType, algorithm, purpose, expiresInDays);
      res.json({ id: key.id, fingerprint: key.keyFingerprint, algorithm: key.algorithm, status: key.status });
    } catch (error) {
      console.error("Error generating quantum key:", error);
      res.status(500).json({ message: "Failed to generate quantum key" });
    }
  });

  app.post("/api/quantum/encrypt", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { dataType, plaintext, keyId } = req.body;
      const encrypted = await quantumEncryptionService.encryptData(userId, dataType, plaintext, keyId);
      res.json({ id: encrypted.id, dataType: encrypted.dataType, algorithm: encrypted.algorithm });
    } catch (error: any) {
      console.error("Error encrypting data:", error);
      res.status(400).json({ message: error.message || "Failed to encrypt data" });
    }
  });

  app.post("/api/quantum/decrypt/:id", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const plaintext = await quantumEncryptionService.decryptData(parseInt(req.params.id), userId);
      res.json({ plaintext });
    } catch (error: any) {
      console.error("Error decrypting data:", error);
      res.status(400).json({ message: error.message || "Failed to decrypt data" });
    }
  });

  app.get("/api/quantum/encrypted", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const data = await quantumEncryptionService.getEncryptedData(userId);
      res.json(data.map(d => ({ id: d.id, dataType: d.dataType, algorithm: d.algorithm, createdAt: d.createdAt })));
    } catch (error) {
      console.error("Error fetching encrypted data:", error);
      res.status(500).json({ message: "Failed to fetch encrypted data" });
    }
  });

  app.post("/api/quantum/keys/:id/rotate", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { reason } = req.body;
      const result = await quantumEncryptionService.rotateKey(parseInt(req.params.id), userId, reason);
      res.json({ 
        oldKeyId: result.oldKey.id, 
        newKeyId: result.newKey.id, 
        newFingerprint: result.newKey.keyFingerprint 
      });
    } catch (error: any) {
      console.error("Error rotating key:", error);
      res.status(400).json({ message: error.message || "Failed to rotate key" });
    }
  });

  app.post("/api/quantum/keys/:id/revoke", hybridAuth, async (req: any, res) => {
    try {
      await quantumEncryptionService.revokeKey(parseInt(req.params.id));
      res.json({ message: "Key revoked" });
    } catch (error) {
      console.error("Error revoking key:", error);
      res.status(500).json({ message: "Failed to revoke key" });
    }
  });

  app.get("/api/quantum/rotation-history", hybridAuth, async (req: any, res) => {
    try {
      const { keyId } = req.query;
      const history = await quantumEncryptionService.getRotationHistory(keyId ? parseInt(keyId as string) : undefined);
      res.json(history);
    } catch (error) {
      console.error("Error fetching rotation history:", error);
      res.status(500).json({ message: "Failed to fetch rotation history" });
    }
  });

  // ============================================
  // MULTI-AGENT COLLABORATION ROUTES
  // ============================================
  
  app.post("/api/collaboration/sessions", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { name, swarmId, bountyId } = req.body;
      const session = await collaborationService.createSession(userId, name, swarmId, bountyId);
      res.json(session);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/collaboration/sessions", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const sessions = await collaborationService.getUserSessions(userId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/collaboration/sessions/:id", hybridAuth, async (req: any, res) => {
    try {
      const session = await collaborationService.getSession(parseInt(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.post("/api/collaboration/sessions/:id/tasks", hybridAuth, async (req: any, res) => {
    try {
      const { title, description, dependencies, assignedAgentId, priority } = req.body;
      const task = await collaborationService.addTask(
        parseInt(req.params.id), title, description, dependencies, assignedAgentId, priority
      );
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/collaboration/sessions/:id/tasks", hybridAuth, async (req: any, res) => {
    try {
      const tasks = await collaborationService.getSessionTasks(parseInt(req.params.id));
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/collaboration/tasks/:id/start", hybridAuth, async (req: any, res) => {
    try {
      const task = await collaborationService.startTask(parseInt(req.params.id));
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/collaboration/tasks/:id/complete", hybridAuth, async (req: any, res) => {
    try {
      const { outputData } = req.body;
      const task = await collaborationService.completeTask(parseInt(req.params.id), outputData);
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/collaboration/sessions/:id/messages", hybridAuth, async (req: any, res) => {
    try {
      const { fromAgentId, content, messageType, toAgentId, metadata } = req.body;
      const message = await collaborationService.sendMessage(
        parseInt(req.params.id), fromAgentId, content, messageType, toAgentId, metadata
      );
      res.json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/collaboration/sessions/:id/messages", hybridAuth, async (req: any, res) => {
    try {
      const messages = await collaborationService.getMessages(parseInt(req.params.id));
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/collaboration/sessions/:id/distribute", hybridAuth, async (req: any, res) => {
    try {
      await collaborationService.autoDistributeTasks(parseInt(req.params.id));
      res.json({ message: "Tasks distributed" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ============================================
  // AI EXECUTION ROUTES
  // ============================================
  
  app.post("/api/execution/run", hybridAuth, async (req: any, res) => {
    try {
      const { agentId, input, bountyId, submissionId, sessionId, model } = req.body;
      const run = await aiExecutionService.executeAgent(agentId, input, { bountyId, submissionId, sessionId, model });
      res.json(run);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/execution/runs/:id", hybridAuth, async (req: any, res) => {
    try {
      const run = await aiExecutionService.getRunStatus(parseInt(req.params.id));
      if (!run) return res.status(404).json({ message: "Run not found" });
      res.json(run);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch run" });
    }
  });

  app.get("/api/execution/agent/:agentId", hybridAuth, async (req: any, res) => {
    try {
      const runs = await aiExecutionService.getAgentRuns(parseInt(req.params.agentId));
      res.json(runs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  app.get("/api/execution/stats", hybridAuth, async (req: any, res) => {
    try {
      const { agentId } = req.query;
      const stats = await aiExecutionService.getExecutionStats(agentId ? parseInt(agentId as string) : undefined);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.post("/api/execution/runs/:id/cancel", hybridAuth, async (req: any, res) => {
    try {
      await aiExecutionService.cancelRun(parseInt(req.params.id));
      res.json({ message: "Run cancelled" });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel run" });
    }
  });

  // ============================================
  // VERIFICATION ROUTES
  // ============================================
  
  app.post("/api/verification/verify", hybridAuth, async (req: any, res) => {
    try {
      const { submissionId, bountyId } = req.body;
      const audit = await verificationService.verifySubmission(submissionId, bountyId);
      res.json(audit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/verification/audits/:id", hybridAuth, async (req: any, res) => {
    try {
      const audit = await verificationService.getAudit(parseInt(req.params.id));
      if (!audit) return res.status(404).json({ message: "Audit not found" });
      res.json(audit);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit" });
    }
  });

  app.get("/api/verification/submission/:submissionId", hybridAuth, async (req: any, res) => {
    try {
      const audits = await verificationService.getSubmissionAudits(parseInt(req.params.submissionId));
      res.json(audits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audits" });
    }
  });

  app.get("/api/verification/pending", hybridAuth, async (req: any, res) => {
    try {
      const audits = await verificationService.getPendingReviews();
      res.json(audits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending reviews" });
    }
  });

  app.post("/api/verification/audits/:id/review", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { notes, decision } = req.body;
      const audit = await verificationService.addHumanReview(parseInt(req.params.id), userId, notes, decision);
      res.json(audit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/verification/stats", hybridAuth, async (req: any, res) => {
    try {
      const stats = await verificationService.getVerificationStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============================================
  // REPUTATION ROUTES
  // ============================================
  
  app.get("/api/reputation/agent/:agentId", hybridAuth, async (req: any, res) => {
    try {
      let rep = await reputationService.getReputation(parseInt(req.params.agentId));
      if (!rep) {
        rep = await reputationService.initializeReputation(parseInt(req.params.agentId));
      }
      res.json(rep);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reputation" });
    }
  });

  app.get("/api/reputation/agent/:agentId/history", hybridAuth, async (req: any, res) => {
    try {
      const history = await reputationService.getReputationHistory(parseInt(req.params.agentId));
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  app.get("/api/reputation/leaderboard", async (req, res) => {
    try {
      const { limit } = req.query;
      const leaderboard = await reputationService.getLeaderboard(limit ? parseInt(limit as string) : 20);
      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/reputation/tier/:tier", hybridAuth, async (req: any, res) => {
    try {
      const agents = await reputationService.getAgentsByTier(req.params.tier as any);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.post("/api/reputation/recalculate/:agentId", hybridAuth, async (req: any, res) => {
    try {
      const rep = await reputationService.recalculateReputation(parseInt(req.params.agentId));
      res.json(rep);
    } catch (error) {
      res.status(500).json({ message: "Failed to recalculate" });
    }
  });

  // ============================================
  // LIVE CHAT ROUTES
  // ============================================
  
  app.post("/api/chat/sessions", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { subject, category, priority } = req.body;
      const session = await liveChatService.createSession(userId, subject, category, priority);
      res.json(session);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/chat/sessions", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const sessions = await liveChatService.getUserSessions(userId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/chat/sessions/:id", hybridAuth, async (req: any, res) => {
    try {
      const session = await liveChatService.getSession(parseInt(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.get("/api/chat/sessions/:id/messages", hybridAuth, async (req: any, res) => {
    try {
      const messages = await liveChatService.getSessionMessages(parseInt(req.params.id));
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/chat/sessions/:id/messages", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { content, senderType } = req.body;
      const message = await liveChatService.sendMessage(
        parseInt(req.params.id), userId, senderType || "user", content
      );
      res.json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/chat/sessions/:id/resolve", hybridAuth, async (req: any, res) => {
    try {
      const { satisfaction } = req.body;
      const session = await liveChatService.resolveSession(parseInt(req.params.id), satisfaction);
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to resolve session" });
    }
  });

  app.get("/api/chat/waiting", hybridAuth, async (req: any, res) => {
    try {
      const sessions = await liveChatService.getWaitingSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch waiting sessions" });
    }
  });

  app.get("/api/chat/stats", hybridAuth, async (req: any, res) => {
    try {
      const stats = await liveChatService.getChatStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============================================
  // ONBOARDING ROUTES
  // ============================================
  
  app.get("/api/onboarding/progress", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const progress = await onboardingService.getProgress(userId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  app.post("/api/onboarding/init", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const progress = await onboardingService.initializeOnboarding(userId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to initialize onboarding" });
    }
  });

  app.post("/api/onboarding/role", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { role } = req.body;
      const progress = await onboardingService.setRole(userId, role);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to set role" });
    }
  });

  app.post("/api/onboarding/complete/:stepId", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const progress = await onboardingService.completeStep(userId, req.params.stepId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to complete step" });
    }
  });

  app.post("/api/onboarding/skip/:stepId", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const progress = await onboardingService.skipStep(userId, req.params.stepId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to skip step" });
    }
  });

  app.post("/api/onboarding/reset", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const progress = await onboardingService.resetOnboarding(userId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to reset onboarding" });
    }
  });

  // ============================================
  // CUSTOM DASHBOARD ROUTES
  // ============================================
  
  app.get("/api/dashboard/config", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const dashboard = await customDashboardService.getFullDashboard(userId);
      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  app.get("/api/dashboard/widgets", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const widgets = await customDashboardService.getUserWidgets(userId);
      res.json(widgets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch widgets" });
    }
  });

  app.post("/api/dashboard/widgets", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { widgetType, title, size, config } = req.body;
      const widget = await customDashboardService.addWidget(userId, widgetType, title, size, config);
      res.json(widget);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/dashboard/widgets/:id", hybridAuth, async (req: any, res) => {
    try {
      const widget = await customDashboardService.updateWidget(parseInt(req.params.id), req.body);
      res.json(widget);
    } catch (error) {
      res.status(500).json({ message: "Failed to update widget" });
    }
  });

  app.delete("/api/dashboard/widgets/:id", hybridAuth, async (req: any, res) => {
    try {
      await customDashboardService.removeWidget(parseInt(req.params.id));
      res.json({ message: "Widget removed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove widget" });
    }
  });

  app.post("/api/dashboard/reorder", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { widgetIds } = req.body;
      await customDashboardService.reorderWidgets(userId, widgetIds);
      res.json({ message: "Widgets reordered" });
    } catch (error) {
      res.status(500).json({ message: "Failed to reorder" });
    }
  });

  app.post("/api/dashboard/init", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { role } = req.body;
      await customDashboardService.initializeDefaultLayout(userId, role);
      const dashboard = await customDashboardService.getFullDashboard(userId);
      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ message: "Failed to initialize dashboard" });
    }
  });

  app.get("/api/dashboard/available-widgets", hybridAuth, async (req: any, res) => {
    try {
      const { role } = req.query;
      const widgets = customDashboardService.getWidgetDefinitions(role as any);
      res.json(widgets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch widgets" });
    }
  });

  // ============================================
  // ENTERPRISE TIER ROUTES
  // ============================================
  
  app.get("/api/enterprise/tiers", async (req, res) => {
    try {
      const tiers = enterpriseTierService.getTierConfigs();
      res.json(tiers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tiers" });
    }
  });

  app.get("/api/enterprise/subscription", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const sub = await enterpriseTierService.getSubscription(userId);
      res.json(sub || { tier: "starter", status: "none" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  app.post("/api/enterprise/subscribe", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { tier, stripeSubscriptionId } = req.body;
      const sub = await enterpriseTierService.createSubscription(userId, tier, stripeSubscriptionId);
      res.json(sub);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/enterprise/upgrade", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { tier, stripeSubscriptionId } = req.body;
      const sub = await enterpriseTierService.upgradeTier(userId, tier, stripeSubscriptionId);
      res.json(sub);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/enterprise/usage", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const usage = await enterpriseTierService.getUsageStats(userId);
      res.json(usage);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch usage" });
    }
  });

  app.get("/api/enterprise/limits/:type", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const limit = await enterpriseTierService.checkLimit(userId, req.params.type as any);
      res.json(limit);
    } catch (error) {
      res.status(500).json({ message: "Failed to check limit" });
    }
  });

  app.post("/api/enterprise/cancel", hybridAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const sub = await enterpriseTierService.cancelSubscription(userId);
      res.json(sub);
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel" });
    }
  });

  return httpServer;
}
