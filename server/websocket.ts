import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

interface Client {
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, Client> = new Map();

  initialize(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket) => {
      const client: Client = { ws, subscriptions: new Set() };
      this.clients.set(ws, client);

      ws.on("message", (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(ws);
      });

      ws.send(JSON.stringify({ type: "connected", message: "Connected to BountyAI real-time updates" }));
    });

    console.log("WebSocket server initialized on /ws");
  }

  private handleMessage(ws: WebSocket, data: any) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (data.type) {
      case "auth":
        client.userId = data.userId;
        break;
      case "subscribe":
        if (data.channel) {
          client.subscriptions.add(data.channel);
          ws.send(JSON.stringify({ type: "subscribed", channel: data.channel }));
        }
        break;
      case "unsubscribe":
        if (data.channel) {
          client.subscriptions.delete(data.channel);
          ws.send(JSON.stringify({ type: "unsubscribed", channel: data.channel }));
        }
        break;
    }
  }

  broadcastToChannel(channel: string, data: any) {
    const message = JSON.stringify({ channel, ...data });
    this.clients.forEach((client) => {
      if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  broadcastToUser(userId: string, data: any) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  broadcastBountyUpdate(bountyId: number, event: string, data: any) {
    this.broadcastToChannel(`bounty:${bountyId}`, {
      type: "bounty_update",
      event,
      bountyId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastAgentProgress(bountyId: number, agentId: number, progress: number, status: string, message?: string) {
    this.broadcastToChannel(`bounty:${bountyId}`, {
      type: "agent_progress",
      bountyId,
      agentId,
      progress,
      status,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastSubmissionUpdate(bountyId: number, submissionId: number, status: string, progress: number) {
    this.broadcastToChannel(`bounty:${bountyId}`, {
      type: "submission_update",
      bountyId,
      submissionId,
      status,
      progress,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastNotification(type: string, message: string, data?: any) {
    this.broadcastToChannel("notifications", {
      type,
      message,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastActivity(activity: {
    id: string;
    type: string;
    title: string;
    description: string;
    amount?: number;
    actorName?: string;
    metadata?: Record<string, any>;
  }) {
    this.broadcastToChannel("activity", {
      type: "new_activity",
      activity: {
        ...activity,
        createdAt: new Date().toISOString(),
      },
    });
  }

  broadcastUserNotification(userId: string, type: string, message: string, data?: any) {
    this.broadcastToUser(userId, {
      type,
      message,
      channel: "notifications",
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastAgentTestResult(developerId: string, agentUploadId: number, testId: number, status: string) {
    this.broadcastUserNotification(developerId, "agent_test_complete", 
      `Agent test ${status === "passed" ? "passed" : "failed"}`,
      { agentUploadId, testId, status }
    );
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const wsService = new WebSocketService();
