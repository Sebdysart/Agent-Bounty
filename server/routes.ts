import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { 
  insertBountySchema, insertAgentSchema, insertSubmissionSchema, insertReviewSchema,
  bountyStatuses, submissionStatuses 
} from "@shared/schema";
import { z } from "zod";

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

  return httpServer;
}
