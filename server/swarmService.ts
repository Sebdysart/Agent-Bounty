import { db } from "./db";
import { 
  agentSwarms, swarmMembers, swarmExecutions, agents,
  type AgentSwarm, type SwarmMember, type SwarmExecution,
  type InsertAgentSwarm, type InsertSwarmMember
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface SwarmFormationConfig {
  bountyId?: number;
  requiredCapabilities?: string[];
  maxMembers?: number;
  communicationProtocol?: "broadcast" | "hierarchical" | "mesh";
  consensusThreshold?: number;
}

export interface TaskDistribution {
  tasks: Array<{
    id: string;
    description: string;
    assignedTo: number;
    priority: number;
    dependencies?: string[];
  }>;
  strategy: "round_robin" | "capability_match" | "load_balance" | "priority";
}

class SwarmService {
  async createSwarm(
    userId: string,
    name: string,
    description: string,
    config: SwarmFormationConfig = {}
  ): Promise<AgentSwarm> {
    const [swarm] = await db.insert(agentSwarms).values({
      name,
      description,
      createdById: userId,
      bountyId: config.bountyId,
      maxMembers: config.maxMembers || 10,
      communicationProtocol: config.communicationProtocol || "broadcast",
      consensusThreshold: String(config.consensusThreshold || 0.66),
    }).returning();

    return swarm;
  }

  async electLeader(swarmId: number): Promise<SwarmMember | null> {
    const members = await db.select()
      .from(swarmMembers)
      .innerJoin(agents, eq(swarmMembers.agentId, agents.id))
      .where(and(
        eq(swarmMembers.swarmId, swarmId),
        eq(swarmMembers.isActive, true)
      ))
      .orderBy(desc(agents.avgRating), desc(agents.completionRate));

    if (members.length === 0) return null;

    const bestCandidate = members[0];
    
    await db.update(swarmMembers)
      .set({ role: "worker" })
      .where(eq(swarmMembers.swarmId, swarmId));

    const [leader] = await db.update(swarmMembers)
      .set({ role: "leader" })
      .where(eq(swarmMembers.id, bestCandidate.swarm_members.id))
      .returning();

    await db.update(agentSwarms)
      .set({ leaderId: bestCandidate.agents.id })
      .where(eq(agentSwarms.id, swarmId));

    return leader;
  }

  async addMember(
    swarmId: number,
    agentId: number,
    role: "leader" | "worker" | "specialist" | "validator" = "worker",
    capabilities: string[] = []
  ): Promise<SwarmMember> {
    const swarm = await db.select().from(agentSwarms).where(eq(agentSwarms.id, swarmId)).limit(1);
    if (!swarm.length) throw new Error("Swarm not found");

    const currentMembers = await db.select().from(swarmMembers)
      .where(and(eq(swarmMembers.swarmId, swarmId), eq(swarmMembers.isActive, true)));
    
    if (currentMembers.length >= (swarm[0].maxMembers || 10)) {
      throw new Error("Swarm is at maximum capacity");
    }

    const [member] = await db.insert(swarmMembers).values({
      swarmId,
      agentId,
      role,
      capabilities,
    }).returning();

    return member;
  }

  async removeMember(swarmId: number, agentId: number): Promise<void> {
    await db.update(swarmMembers)
      .set({ isActive: false, leftAt: new Date() })
      .where(and(
        eq(swarmMembers.swarmId, swarmId),
        eq(swarmMembers.agentId, agentId)
      ));
  }

  async distributeTask(
    swarmId: number,
    taskBreakdown: TaskDistribution
  ): Promise<void> {
    for (const task of taskBreakdown.tasks) {
      await db.update(swarmMembers)
        .set({ taskAssignment: JSON.stringify(task) })
        .where(and(
          eq(swarmMembers.swarmId, swarmId),
          eq(swarmMembers.agentId, task.assignedTo)
        ));
    }

    await db.update(agentSwarms)
      .set({ taskDistribution: JSON.stringify(taskBreakdown) })
      .where(eq(agentSwarms.id, swarmId));
  }

  async autoAssemble(
    userId: string,
    bountyId: number,
    requiredCapabilities: string[]
  ): Promise<AgentSwarm> {
    const swarm = await this.createSwarm(
      userId,
      `Auto-assembled Swarm for Bounty ${bountyId}`,
      "Automatically assembled multi-agent team",
      { bountyId, requiredCapabilities }
    );

    const matchingAgents = await db.select()
      .from(agents)
      .where(eq(agents.isVerified, true))
      .orderBy(desc(agents.avgRating))
      .limit(5);

    for (const agent of matchingAgents) {
      const matchedCapabilities = agent.capabilities.filter(
        cap => requiredCapabilities.includes(cap)
      );
      
      if (matchedCapabilities.length > 0) {
        const role = matchedCapabilities.length >= 2 ? "specialist" : "worker";
        await this.addMember(swarm.id, agent.id, role, matchedCapabilities);
      }
    }

    await this.electLeader(swarm.id);

    await db.update(agentSwarms)
      .set({ status: "active", formedAt: new Date() })
      .where(eq(agentSwarms.id, swarm.id));

    return swarm;
  }

  async executeSwarm(
    swarmId: number,
    bountyId: number,
    input: string
  ): Promise<SwarmExecution> {
    const [execution] = await db.insert(swarmExecutions).values({
      swarmId,
      bountyId,
      taskBreakdown: JSON.stringify({ input }),
    }).returning();

    await db.update(agentSwarms)
      .set({ status: "executing" })
      .where(eq(agentSwarms.id, swarmId));

    const members = await db.select()
      .from(swarmMembers)
      .where(and(
        eq(swarmMembers.swarmId, swarmId),
        eq(swarmMembers.isActive, true)
      ));

    const memberOutputs: Record<number, { status: string; output?: string }> = {};
    
    for (const member of members) {
      memberOutputs[member.agentId] = {
        status: "processing",
        output: `Agent ${member.agentId} processing task...`
      };
    }

    await db.update(swarmExecutions)
      .set({ 
        memberOutputs: JSON.stringify(memberOutputs),
        status: "running",
        startedAt: new Date()
      })
      .where(eq(swarmExecutions.id, execution.id));

    return execution;
  }

  async aggregateOutputs(executionId: number): Promise<string> {
    const [execution] = await db.select()
      .from(swarmExecutions)
      .where(eq(swarmExecutions.id, executionId));

    if (!execution) throw new Error("Execution not found");

    const memberOutputs = execution.memberOutputs 
      ? JSON.parse(execution.memberOutputs) 
      : {};

    const outputs = Object.values(memberOutputs)
      .map((m: any) => m.output)
      .filter(Boolean);

    const aggregated = outputs.join("\n\n---\n\n");

    await db.update(swarmExecutions)
      .set({ 
        aggregatedOutput: aggregated,
        consensusReached: true,
        status: "completed",
        completedAt: new Date()
      })
      .where(eq(swarmExecutions.id, executionId));

    await db.update(agentSwarms)
      .set({ 
        status: "completed",
        totalExecutions: sql`${agentSwarms.totalExecutions} + 1`
      })
      .where(eq(agentSwarms.id, execution.swarmId));

    return aggregated;
  }

  async disbandSwarm(swarmId: number): Promise<void> {
    await db.update(swarmMembers)
      .set({ isActive: false, leftAt: new Date() })
      .where(eq(swarmMembers.swarmId, swarmId));

    await db.update(agentSwarms)
      .set({ status: "disbanded", disbandedAt: new Date() })
      .where(eq(agentSwarms.id, swarmId));
  }

  async getSwarm(swarmId: number): Promise<AgentSwarm | null> {
    const [swarm] = await db.select()
      .from(agentSwarms)
      .where(eq(agentSwarms.id, swarmId));
    return swarm || null;
  }

  async getSwarmMembers(swarmId: number): Promise<SwarmMember[]> {
    return db.select()
      .from(swarmMembers)
      .where(eq(swarmMembers.swarmId, swarmId));
  }

  async getUserSwarms(userId: string): Promise<AgentSwarm[]> {
    return db.select()
      .from(agentSwarms)
      .where(eq(agentSwarms.createdById, userId))
      .orderBy(desc(agentSwarms.createdAt));
  }

  async getSwarmExecutions(swarmId: number): Promise<SwarmExecution[]> {
    return db.select()
      .from(swarmExecutions)
      .where(eq(swarmExecutions.swarmId, swarmId))
      .orderBy(desc(swarmExecutions.createdAt));
  }
}

export const swarmService = new SwarmService();
