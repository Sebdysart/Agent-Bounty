import { db } from "./db";
import { 
  dashboardWidgets, dashboardLayouts,
  type DashboardWidget, type DashboardLayout 
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

interface WidgetDefinition {
  type: string;
  name: string;
  description: string;
  defaultSize: "small" | "medium" | "large" | "full";
  availableFor: ("business" | "developer" | "admin")[];
  defaultConfig?: Record<string, any>;
}

const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: "earnings_chart",
    name: "Earnings Chart",
    description: "Track your earnings over time",
    defaultSize: "medium",
    availableFor: ["developer"],
  },
  {
    type: "spending_chart",
    name: "Spending Chart",
    description: "Monitor your bounty spending",
    defaultSize: "medium",
    availableFor: ["business"],
  },
  {
    type: "active_bounties",
    name: "Active Bounties",
    description: "View your current bounties",
    defaultSize: "medium",
    availableFor: ["business", "developer"],
  },
  {
    type: "agent_performance",
    name: "Agent Performance",
    description: "Track your agent's performance metrics",
    defaultSize: "large",
    availableFor: ["developer"],
  },
  {
    type: "reputation_score",
    name: "Reputation Score",
    description: "Your current reputation and badges",
    defaultSize: "small",
    availableFor: ["developer"],
  },
  {
    type: "leaderboard",
    name: "Leaderboard",
    description: "Top performing agents",
    defaultSize: "medium",
    availableFor: ["business", "developer"],
  },
  {
    type: "recent_activity",
    name: "Recent Activity",
    description: "Latest platform activity",
    defaultSize: "medium",
    availableFor: ["business", "developer", "admin"],
  },
  {
    type: "submission_stats",
    name: "Submission Stats",
    description: "Submission success rate and metrics",
    defaultSize: "small",
    availableFor: ["developer"],
  },
  {
    type: "pending_reviews",
    name: "Pending Reviews",
    description: "Bounties awaiting your review",
    defaultSize: "medium",
    availableFor: ["business"],
  },
  {
    type: "quick_actions",
    name: "Quick Actions",
    description: "Shortcuts to common actions",
    defaultSize: "small",
    availableFor: ["business", "developer"],
  },
  {
    type: "notifications",
    name: "Notifications",
    description: "Recent notifications",
    defaultSize: "small",
    availableFor: ["business", "developer", "admin"],
  },
  {
    type: "platform_stats",
    name: "Platform Stats",
    description: "Overall platform statistics",
    defaultSize: "full",
    availableFor: ["admin"],
  },
  {
    type: "cost_analysis",
    name: "Cost Analysis",
    description: "AI execution cost breakdown",
    defaultSize: "medium",
    availableFor: ["developer"],
  },
  {
    type: "integration_status",
    name: "Integration Status",
    description: "Connected integrations status",
    defaultSize: "small",
    availableFor: ["business", "developer"],
  },
];

class CustomDashboardService {
  getWidgetDefinitions(role?: "business" | "developer" | "admin"): WidgetDefinition[] {
    if (!role) return WIDGET_DEFINITIONS;
    return WIDGET_DEFINITIONS.filter(w => w.availableFor.includes(role));
  }

  async initializeDefaultLayout(
    userId: string,
    role: "business" | "developer" | "admin" = "developer"
  ): Promise<void> {
    const existing = await db.select().from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId));
    
    if (existing.length > 0) return;

    await db.insert(dashboardLayouts).values({
      userId,
      layoutName: "default",
      theme: "default",
    });

    const defaultWidgets = this.getWidgetDefinitions(role).slice(0, 6);
    
    for (let i = 0; i < defaultWidgets.length; i++) {
      const widget = defaultWidgets[i];
      await db.insert(dashboardWidgets).values({
        userId,
        widgetType: widget.type,
        title: widget.name,
        position: i,
        size: widget.defaultSize,
        config: widget.defaultConfig ? JSON.stringify(widget.defaultConfig) : undefined,
        isVisible: true,
      });
    }
  }

  async addWidget(
    userId: string,
    widgetType: string,
    title?: string,
    size?: "small" | "medium" | "large" | "full",
    config?: Record<string, any>
  ): Promise<DashboardWidget> {
    const definition = WIDGET_DEFINITIONS.find(w => w.type === widgetType);
    if (!definition) throw new Error("Invalid widget type");

    const existingWidgets = await db.select().from(dashboardWidgets)
      .where(eq(dashboardWidgets.userId, userId));
    
    const maxPosition = existingWidgets.reduce((max, w) => 
      Math.max(max, w.position || 0), 0
    );

    const [widget] = await db.insert(dashboardWidgets).values({
      userId,
      widgetType,
      title: title || definition.name,
      position: maxPosition + 1,
      size: size || definition.defaultSize,
      config: config ? JSON.stringify(config) : undefined,
      isVisible: true,
    }).returning();

    return widget;
  }

  async updateWidget(
    widgetId: number,
    updates: Partial<{
      title: string;
      position: number;
      size: "small" | "medium" | "large" | "full";
      config: Record<string, any>;
      isVisible: boolean;
      refreshInterval: number;
    }>
  ): Promise<DashboardWidget> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.config) {
      updateData.config = JSON.stringify(updates.config);
    }

    const [widget] = await db.update(dashboardWidgets)
      .set(updateData)
      .where(eq(dashboardWidgets.id, widgetId))
      .returning();

    return widget;
  }

  async removeWidget(widgetId: number): Promise<void> {
    await db.delete(dashboardWidgets).where(eq(dashboardWidgets.id, widgetId));
  }

  async reorderWidgets(userId: string, widgetIds: number[]): Promise<void> {
    for (let i = 0; i < widgetIds.length; i++) {
      await db.update(dashboardWidgets)
        .set({ position: i, updatedAt: new Date() })
        .where(and(
          eq(dashboardWidgets.id, widgetIds[i]),
          eq(dashboardWidgets.userId, userId)
        ));
    }
  }

  async getUserWidgets(userId: string): Promise<DashboardWidget[]> {
    return db.select().from(dashboardWidgets)
      .where(eq(dashboardWidgets.userId, userId))
      .orderBy(dashboardWidgets.position);
  }

  async getUserLayout(userId: string): Promise<DashboardLayout | null> {
    const [layout] = await db.select().from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId));
    return layout || null;
  }

  async updateLayout(
    userId: string,
    updates: Partial<{
      layoutName: string;
      gridConfig: Record<string, any>;
      theme: "default" | "compact" | "expanded";
    }>
  ): Promise<DashboardLayout> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.gridConfig) {
      updateData.gridConfig = JSON.stringify(updates.gridConfig);
    }

    const [layout] = await db.update(dashboardLayouts)
      .set(updateData)
      .where(eq(dashboardLayouts.userId, userId))
      .returning();

    return layout;
  }

  async getFullDashboard(userId: string): Promise<{
    layout: DashboardLayout | null;
    widgets: DashboardWidget[];
    availableWidgets: WidgetDefinition[];
  }> {
    const [layout] = await db.select().from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId));

    const widgets = await db.select().from(dashboardWidgets)
      .where(and(
        eq(dashboardWidgets.userId, userId),
        eq(dashboardWidgets.isVisible, true)
      ))
      .orderBy(dashboardWidgets.position);

    return {
      layout: layout || null,
      widgets,
      availableWidgets: WIDGET_DEFINITIONS,
    };
  }

  async resetToDefaults(
    userId: string, 
    role: "business" | "developer" | "admin"
  ): Promise<void> {
    await db.delete(dashboardWidgets).where(eq(dashboardWidgets.userId, userId));
    await db.delete(dashboardLayouts).where(eq(dashboardLayouts.userId, userId));
    await this.initializeDefaultLayout(userId, role);
  }
}

export const customDashboardService = new CustomDashboardService();
