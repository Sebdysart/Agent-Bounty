import { db } from "./db";
import { 
  collaborationSessions, collaborationMessages, collaborationTasks,
  swarmMembers, agents,
  type CollaborationSession, type CollaborationMessage, type CollaborationTask
} from "@shared/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface TaskNode {
  id: string;
  title: string;
  description?: string;
  dependencies: string[];
  assignedAgentId?: number;
  status: "pending" | "assigned" | "running" | "completed" | "failed" | "blocked";
}

export interface SharedContext {
  variables: Record<string, any>;
  artifacts: Array<{ name: string; type: string; data: any }>;
  history: Array<{ timestamp: string; action: string; agentId?: number }>;
}

class CollaborationService {
  async createSession(
    userId: string,
    name: string,
    swarmId?: number,
    bountyId?: number
  ): Promise<CollaborationSession> {
    const initialContext: SharedContext = {
      variables: {},
      artifacts: [],
      history: [{ timestamp: new Date().toISOString(), action: "session_created" }]
    };

    const [session] = await db.insert(collaborationSessions).values({
      name,
      swarmId,
      bountyId,
      createdById: userId,
      sharedContext: JSON.stringify(initialContext),
      taskGraph: JSON.stringify({ nodes: [], edges: [] }),
      consensusLog: JSON.stringify([]),
      startedAt: new Date(),
    }).returning();

    return session;
  }

  async addTask(
    sessionId: number,
    title: string,
    description?: string,
    dependencies: string[] = [],
    assignedAgentId?: number,
    priority: number = 5
  ): Promise<CollaborationTask> {
    const taskId = randomUUID();
    
    const [task] = await db.insert(collaborationTasks).values({
      sessionId,
      taskId,
      title,
      description,
      dependencies,
      assignedAgentId,
      priority,
      status: dependencies.length > 0 ? "blocked" : "pending",
    }).returning();

    await db.update(collaborationSessions)
      .set({ totalTasks: sql`${collaborationSessions.totalTasks} + 1` })
      .where(eq(collaborationSessions.id, sessionId));

    return task;
  }

  async assignTask(taskId: number, agentId: number): Promise<CollaborationTask> {
    const [task] = await db.update(collaborationTasks)
      .set({ 
        assignedAgentId: agentId, 
        status: "assigned",
      })
      .where(eq(collaborationTasks.id, taskId))
      .returning();
    return task;
  }

  async startTask(taskId: number): Promise<CollaborationTask> {
    const [task] = await db.update(collaborationTasks)
      .set({ 
        status: "running",
        startedAt: new Date()
      })
      .where(eq(collaborationTasks.id, taskId))
      .returning();
    return task;
  }

  async completeTask(
    taskId: number, 
    outputData: any
  ): Promise<CollaborationTask> {
    const [task] = await db.select().from(collaborationTasks)
      .where(eq(collaborationTasks.id, taskId));
    
    if (!task) throw new Error("Task not found");

    const completedAt = new Date();
    const actualDuration = task.startedAt 
      ? Math.floor((completedAt.getTime() - new Date(task.startedAt).getTime()) / 1000)
      : null;

    const [updated] = await db.update(collaborationTasks)
      .set({ 
        status: "completed",
        outputData: JSON.stringify(outputData),
        completedAt,
        actualDuration,
      })
      .where(eq(collaborationTasks.id, taskId))
      .returning();

    await db.update(collaborationSessions)
      .set({ completedTasks: sql`${collaborationSessions.completedTasks} + 1` })
      .where(eq(collaborationSessions.id, task.sessionId));

    await this.checkAndUnblockDependentTasks(task.sessionId, task.taskId);

    return updated;
  }

  private async checkAndUnblockDependentTasks(sessionId: number, completedTaskId: string): Promise<void> {
    const blockedTasks = await db.select().from(collaborationTasks)
      .where(and(
        eq(collaborationTasks.sessionId, sessionId),
        eq(collaborationTasks.status, "blocked")
      ));

    for (const task of blockedTasks) {
      const deps = task.dependencies || [];
      if (deps.includes(completedTaskId)) {
        const allCompleted = await db.select().from(collaborationTasks)
          .where(and(
            eq(collaborationTasks.sessionId, sessionId),
            eq(collaborationTasks.status, "completed")
          ));
        
        const completedIds = allCompleted.map(t => t.taskId);
        const remainingDeps = deps.filter(d => !completedIds.includes(d));
        
        if (remainingDeps.length === 0) {
          await db.update(collaborationTasks)
            .set({ status: "pending" })
            .where(eq(collaborationTasks.id, task.id));
        }
      }
    }
  }

  async sendMessage(
    sessionId: number,
    fromAgentId: number,
    content: string,
    messageType: "task" | "result" | "query" | "vote" | "status" | "error" = "task",
    toAgentId?: number,
    metadata?: any
  ): Promise<CollaborationMessage> {
    const [message] = await db.insert(collaborationMessages).values({
      sessionId,
      fromAgentId,
      toAgentId,
      messageType,
      content,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    }).returning();

    await db.update(collaborationSessions)
      .set({ totalMessages: sql`${collaborationSessions.totalMessages} + 1` })
      .where(eq(collaborationSessions.id, sessionId));

    return message;
  }

  async getMessages(
    sessionId: number, 
    agentId?: number,
    limit: number = 50
  ): Promise<CollaborationMessage[]> {
    let query = db.select().from(collaborationMessages)
      .where(eq(collaborationMessages.sessionId, sessionId))
      .orderBy(desc(collaborationMessages.createdAt))
      .limit(limit);

    return query;
  }

  async updateSharedContext(
    sessionId: number,
    updates: Partial<SharedContext>
  ): Promise<void> {
    const [session] = await db.select().from(collaborationSessions)
      .where(eq(collaborationSessions.id, sessionId));
    
    if (!session) throw new Error("Session not found");

    const currentContext: SharedContext = session.sharedContext 
      ? JSON.parse(session.sharedContext) 
      : { variables: {}, artifacts: [], history: [] };

    const newContext: SharedContext = {
      variables: { ...currentContext.variables, ...updates.variables },
      artifacts: [...currentContext.artifacts, ...(updates.artifacts || [])],
      history: [
        ...currentContext.history,
        { timestamp: new Date().toISOString(), action: "context_updated" }
      ]
    };

    await db.update(collaborationSessions)
      .set({ sharedContext: JSON.stringify(newContext) })
      .where(eq(collaborationSessions.id, sessionId));
  }

  async voteOnDecision(
    sessionId: number,
    agentId: number,
    decision: string,
    vote: "approve" | "reject" | "abstain"
  ): Promise<void> {
    const [session] = await db.select().from(collaborationSessions)
      .where(eq(collaborationSessions.id, sessionId));
    
    if (!session) throw new Error("Session not found");

    const consensusLog = session.consensusLog 
      ? JSON.parse(session.consensusLog) 
      : [];

    consensusLog.push({
      timestamp: new Date().toISOString(),
      agentId,
      decision,
      vote
    });

    await db.update(collaborationSessions)
      .set({ consensusLog: JSON.stringify(consensusLog) })
      .where(eq(collaborationSessions.id, sessionId));
  }

  async getSession(sessionId: number): Promise<CollaborationSession | null> {
    const [session] = await db.select().from(collaborationSessions)
      .where(eq(collaborationSessions.id, sessionId));
    return session || null;
  }

  async getSessionTasks(sessionId: number): Promise<CollaborationTask[]> {
    return db.select().from(collaborationTasks)
      .where(eq(collaborationTasks.sessionId, sessionId))
      .orderBy(collaborationTasks.priority);
  }

  async getUserSessions(userId: string): Promise<CollaborationSession[]> {
    return db.select().from(collaborationSessions)
      .where(eq(collaborationSessions.createdById, userId))
      .orderBy(desc(collaborationSessions.createdAt));
  }

  async completeSession(sessionId: number): Promise<void> {
    await db.update(collaborationSessions)
      .set({ 
        status: "completed",
        completedAt: new Date()
      })
      .where(eq(collaborationSessions.id, sessionId));
  }

  async autoDistributeTasks(sessionId: number): Promise<void> {
    const [session] = await db.select().from(collaborationSessions)
      .where(eq(collaborationSessions.id, sessionId));
    
    if (!session?.swarmId) return;

    const members = await db.select()
      .from(swarmMembers)
      .innerJoin(agents, eq(swarmMembers.agentId, agents.id))
      .where(and(
        eq(swarmMembers.swarmId, session.swarmId),
        eq(swarmMembers.isActive, true)
      ));

    const pendingTasks = await db.select().from(collaborationTasks)
      .where(and(
        eq(collaborationTasks.sessionId, sessionId),
        eq(collaborationTasks.status, "pending"),
        isNull(collaborationTasks.assignedAgentId)
      ))
      .orderBy(desc(collaborationTasks.priority));

    let memberIndex = 0;
    for (const task of pendingTasks) {
      if (members.length === 0) break;
      
      const member = members[memberIndex % members.length];
      await this.assignTask(task.id, member.agents.id);
      memberIndex++;
    }
  }
}

export const collaborationService = new CollaborationService();
