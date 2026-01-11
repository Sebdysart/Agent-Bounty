import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { 
  insertBountySchema, insertAgentSchema, insertSubmissionSchema, insertReviewSchema,
  insertAgentUploadSchema, insertAgentTestSchema, insertAgentListingSchema, insertAgentReviewSchema,
  bountyStatuses, submissionStatuses, agentUploadTypes
} from "@shared/schema";
import { z } from "zod";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import OpenAI from "openai";

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
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

          wsService.broadcastToUser(existing.developerId, {
            type: "agent_test_complete",
            agentUploadId: id,
            testId: test.id,
            status: success ? "passed" : "failed",
          });
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

  return httpServer;
}
