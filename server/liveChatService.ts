import { db } from "./db";
import { 
  liveChatSessions, liveChatMessages,
  type LiveChatSession, type LiveChatMessage 
} from "@shared/schema";
import { eq, desc, and, sql, isNull } from "drizzle-orm";

class LiveChatService {
  async createSession(
    userId: string,
    subject?: string,
    category: "billing" | "technical" | "account" | "bounty" | "agent" | "general" = "general",
    priority: "low" | "medium" | "high" | "urgent" = "medium"
  ): Promise<LiveChatSession> {
    const [session] = await db.insert(liveChatSessions).values({
      userId,
      subject,
      category,
      priority,
      status: "waiting",
    }).returning();

    return session;
  }

  async sendMessage(
    sessionId: number,
    senderId: string,
    senderType: "user" | "support" | "bot",
    content: string,
    attachments: string[] = []
  ): Promise<LiveChatMessage> {
    const [message] = await db.insert(liveChatMessages).values({
      sessionId,
      senderId,
      senderType,
      content,
      attachments,
    }).returning();

    const [session] = await db.select().from(liveChatSessions)
      .where(eq(liveChatSessions.id, sessionId));

    const updates: Partial<LiveChatSession> = {
      totalMessages: (session?.totalMessages || 0) + 1,
      lastMessageAt: new Date(),
    };

    if (senderType === "support" && !session?.firstResponseAt) {
      updates.firstResponseAt = new Date();
      updates.status = "active";
    }

    await db.update(liveChatSessions)
      .set(updates)
      .where(eq(liveChatSessions.id, sessionId));

    return message;
  }

  async assignAgent(sessionId: number, agentId: string): Promise<LiveChatSession> {
    const [session] = await db.update(liveChatSessions)
      .set({ 
        assignedAgentId: agentId,
        status: "active"
      })
      .where(eq(liveChatSessions.id, sessionId))
      .returning();
    return session;
  }

  async resolveSession(
    sessionId: number, 
    satisfaction?: number
  ): Promise<LiveChatSession> {
    const [session] = await db.update(liveChatSessions)
      .set({ 
        status: "resolved",
        resolvedAt: new Date(),
        userSatisfaction: satisfaction,
      })
      .where(eq(liveChatSessions.id, sessionId))
      .returning();
    return session;
  }

  async getSession(sessionId: number): Promise<LiveChatSession | null> {
    const [session] = await db.select().from(liveChatSessions)
      .where(eq(liveChatSessions.id, sessionId));
    return session || null;
  }

  async getSessionMessages(sessionId: number): Promise<LiveChatMessage[]> {
    return db.select().from(liveChatMessages)
      .where(eq(liveChatMessages.sessionId, sessionId))
      .orderBy(liveChatMessages.createdAt);
  }

  async getUserSessions(userId: string): Promise<LiveChatSession[]> {
    return db.select().from(liveChatSessions)
      .where(eq(liveChatSessions.userId, userId))
      .orderBy(desc(liveChatSessions.createdAt));
  }

  async getWaitingSessions(): Promise<LiveChatSession[]> {
    return db.select().from(liveChatSessions)
      .where(eq(liveChatSessions.status, "waiting"))
      .orderBy(liveChatSessions.createdAt);
  }

  async getActiveSessions(): Promise<LiveChatSession[]> {
    return db.select().from(liveChatSessions)
      .where(eq(liveChatSessions.status, "active"))
      .orderBy(desc(liveChatSessions.lastMessageAt));
  }

  async getAgentSessions(agentId: string): Promise<LiveChatSession[]> {
    return db.select().from(liveChatSessions)
      .where(and(
        eq(liveChatSessions.assignedAgentId, agentId),
        eq(liveChatSessions.status, "active")
      ))
      .orderBy(desc(liveChatSessions.lastMessageAt));
  }

  async markMessagesRead(sessionId: number, userId: string): Promise<void> {
    await db.update(liveChatMessages)
      .set({ isRead: true })
      .where(and(
        eq(liveChatMessages.sessionId, sessionId),
        eq(liveChatMessages.isRead, false)
      ));
  }

  async getUnreadCount(sessionId: number, userId: string): Promise<number> {
    const messages = await db.select().from(liveChatMessages)
      .where(and(
        eq(liveChatMessages.sessionId, sessionId),
        eq(liveChatMessages.isRead, false)
      ));
    return messages.filter(m => m.senderId !== userId).length;
  }

  async getChatStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    waitingSessions: number;
    avgResponseTime: number;
    avgSatisfaction: number;
  }> {
    const sessions = await db.select().from(liveChatSessions);
    
    const active = sessions.filter(s => s.status === "active").length;
    const waiting = sessions.filter(s => s.status === "waiting").length;
    
    const resolved = sessions.filter(s => 
      s.status === "resolved" && s.firstResponseAt && s.createdAt
    );
    
    const avgResponseTime = resolved.length > 0
      ? resolved.reduce((sum, s) => {
          const diff = new Date(s.firstResponseAt!).getTime() - new Date(s.createdAt).getTime();
          return sum + diff / 1000;
        }, 0) / resolved.length
      : 0;

    const withSatisfaction = sessions.filter(s => s.userSatisfaction);
    const avgSatisfaction = withSatisfaction.length > 0
      ? withSatisfaction.reduce((sum, s) => sum + (s.userSatisfaction || 0), 0) / withSatisfaction.length
      : 0;

    return {
      totalSessions: sessions.length,
      activeSessions: active,
      waitingSessions: waiting,
      avgResponseTime,
      avgSatisfaction,
    };
  }

  async sendBotMessage(sessionId: number, content: string): Promise<LiveChatMessage> {
    return this.sendMessage(sessionId, "bot", "bot", content);
  }
}

export const liveChatService = new LiveChatService();
