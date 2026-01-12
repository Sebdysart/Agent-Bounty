import { db } from "./db";
import { 
  hubConnectors, userIntegrations,
  type HubConnector, type UserIntegration,
  type InsertHubConnector, type InsertUserIntegration,
  integrationHubCategories
} from "@shared/schema";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import crypto from "crypto";

export interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri: string;
}

export interface ConnectorEndpoint {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  parameters?: Record<string, { type: string; required: boolean; description: string }>;
}

const PRESET_CONNECTORS: Omit<InsertHubConnector, "id">[] = [
  { name: "Salesforce", slug: "salesforce", description: "Enterprise CRM platform", category: "crm", authType: "oauth2", baseUrl: "https://api.salesforce.com", webhookSupport: true, isPremium: false },
  { name: "HubSpot", slug: "hubspot", description: "Marketing and sales automation", category: "crm", authType: "oauth2", baseUrl: "https://api.hubspot.com", webhookSupport: true, isPremium: false },
  { name: "Pipedrive", slug: "pipedrive", description: "Sales pipeline management", category: "crm", authType: "api_key", baseUrl: "https://api.pipedrive.com", webhookSupport: true, isPremium: false },
  { name: "Zendesk", slug: "zendesk", description: "Customer service platform", category: "crm", authType: "oauth2", baseUrl: "https://api.zendesk.com", webhookSupport: true, isPremium: false },
  { name: "Mailchimp", slug: "mailchimp", description: "Email marketing automation", category: "marketing", authType: "oauth2", baseUrl: "https://api.mailchimp.com", webhookSupport: true, isPremium: false },
  { name: "SendGrid", slug: "sendgrid", description: "Email delivery service", category: "marketing", authType: "api_key", baseUrl: "https://api.sendgrid.com", webhookSupport: true, isPremium: false },
  { name: "Google Ads", slug: "google-ads", description: "Advertising platform", category: "marketing", authType: "oauth2", baseUrl: "https://googleads.googleapis.com", webhookSupport: false, isPremium: true },
  { name: "Facebook Ads", slug: "facebook-ads", description: "Social media advertising", category: "marketing", authType: "oauth2", baseUrl: "https://graph.facebook.com", webhookSupport: true, isPremium: true },
  { name: "Snowflake", slug: "snowflake", description: "Cloud data warehouse", category: "data", authType: "oauth2", baseUrl: "https://account.snowflakecomputing.com", webhookSupport: false, isPremium: true },
  { name: "BigQuery", slug: "bigquery", description: "Google cloud data analytics", category: "data", authType: "oauth2", baseUrl: "https://bigquery.googleapis.com", webhookSupport: false, isPremium: false },
  { name: "MongoDB Atlas", slug: "mongodb", description: "NoSQL database service", category: "data", authType: "api_key", baseUrl: "https://cloud.mongodb.com", webhookSupport: true, isPremium: false },
  { name: "PostgreSQL", slug: "postgresql", description: "Relational database", category: "data", authType: "basic", baseUrl: "", webhookSupport: false, isPremium: false },
  { name: "GitHub", slug: "github", description: "Code hosting and collaboration", category: "devops", authType: "oauth2", baseUrl: "https://api.github.com", webhookSupport: true, isPremium: false },
  { name: "GitLab", slug: "gitlab", description: "DevOps platform", category: "devops", authType: "oauth2", baseUrl: "https://gitlab.com/api/v4", webhookSupport: true, isPremium: false },
  { name: "Jenkins", slug: "jenkins", description: "CI/CD automation server", category: "devops", authType: "basic", baseUrl: "", webhookSupport: true, isPremium: false },
  { name: "Docker Hub", slug: "docker-hub", description: "Container registry", category: "devops", authType: "bearer", baseUrl: "https://hub.docker.com", webhookSupport: true, isPremium: false },
  { name: "AWS", slug: "aws", description: "Amazon Web Services", category: "devops", authType: "api_key", baseUrl: "https://aws.amazon.com", webhookSupport: true, isPremium: true },
  { name: "OpenAI", slug: "openai", description: "GPT and AI models", category: "ai_ml", authType: "bearer", baseUrl: "https://api.openai.com", webhookSupport: false, isPremium: false },
  { name: "Anthropic", slug: "anthropic", description: "Claude AI models", category: "ai_ml", authType: "bearer", baseUrl: "https://api.anthropic.com", webhookSupport: false, isPremium: false },
  { name: "Hugging Face", slug: "huggingface", description: "ML model hub", category: "ai_ml", authType: "bearer", baseUrl: "https://api-inference.huggingface.co", webhookSupport: false, isPremium: false },
  { name: "Replicate", slug: "replicate", description: "ML model hosting", category: "ai_ml", authType: "bearer", baseUrl: "https://api.replicate.com", webhookSupport: true, isPremium: false },
  { name: "Stripe", slug: "stripe", description: "Payment processing", category: "finance", authType: "bearer", baseUrl: "https://api.stripe.com", webhookSupport: true, isPremium: false },
  { name: "PayPal", slug: "paypal", description: "Online payments", category: "finance", authType: "oauth2", baseUrl: "https://api.paypal.com", webhookSupport: true, isPremium: false },
  { name: "QuickBooks", slug: "quickbooks", description: "Accounting software", category: "finance", authType: "oauth2", baseUrl: "https://quickbooks.api.intuit.com", webhookSupport: true, isPremium: true },
  { name: "Plaid", slug: "plaid", description: "Banking API", category: "finance", authType: "api_key", baseUrl: "https://plaid.com", webhookSupport: true, isPremium: true },
  { name: "Slack", slug: "slack", description: "Team communication", category: "communication", authType: "oauth2", baseUrl: "https://slack.com/api", webhookSupport: true, isPremium: false },
  { name: "Discord", slug: "discord", description: "Community platform", category: "communication", authType: "oauth2", baseUrl: "https://discord.com/api", webhookSupport: true, isPremium: false },
  { name: "Twilio", slug: "twilio", description: "SMS and voice API", category: "communication", authType: "basic", baseUrl: "https://api.twilio.com", webhookSupport: true, isPremium: false },
  { name: "Microsoft Teams", slug: "teams", description: "Team collaboration", category: "communication", authType: "oauth2", baseUrl: "https://graph.microsoft.com", webhookSupport: true, isPremium: false },
  { name: "Notion", slug: "notion", description: "Workspace and notes", category: "productivity", authType: "bearer", baseUrl: "https://api.notion.com", webhookSupport: false, isPremium: false },
  { name: "Airtable", slug: "airtable", description: "Spreadsheet database", category: "productivity", authType: "bearer", baseUrl: "https://api.airtable.com", webhookSupport: true, isPremium: false },
  { name: "Asana", slug: "asana", description: "Project management", category: "productivity", authType: "oauth2", baseUrl: "https://app.asana.com/api", webhookSupport: true, isPremium: false },
  { name: "Trello", slug: "trello", description: "Kanban boards", category: "productivity", authType: "oauth2", baseUrl: "https://api.trello.com", webhookSupport: true, isPremium: false },
  { name: "Jira", slug: "jira", description: "Issue tracking", category: "productivity", authType: "oauth2", baseUrl: "https://api.atlassian.com", webhookSupport: true, isPremium: false },
  { name: "Google Analytics", slug: "google-analytics", description: "Web analytics", category: "analytics", authType: "oauth2", baseUrl: "https://analyticsdata.googleapis.com", webhookSupport: false, isPremium: false },
  { name: "Mixpanel", slug: "mixpanel", description: "Product analytics", category: "analytics", authType: "api_key", baseUrl: "https://api.mixpanel.com", webhookSupport: false, isPremium: false },
  { name: "Amplitude", slug: "amplitude", description: "Digital analytics", category: "analytics", authType: "api_key", baseUrl: "https://api.amplitude.com", webhookSupport: false, isPremium: false },
  { name: "Segment", slug: "segment", description: "Customer data platform", category: "analytics", authType: "bearer", baseUrl: "https://api.segment.io", webhookSupport: true, isPremium: true },
  { name: "AWS S3", slug: "aws-s3", description: "Object storage", category: "storage", authType: "api_key", baseUrl: "https://s3.amazonaws.com", webhookSupport: true, isPremium: false },
  { name: "Google Cloud Storage", slug: "gcs", description: "Cloud object storage", category: "storage", authType: "oauth2", baseUrl: "https://storage.googleapis.com", webhookSupport: true, isPremium: false },
  { name: "Dropbox", slug: "dropbox", description: "File hosting service", category: "storage", authType: "oauth2", baseUrl: "https://api.dropboxapi.com", webhookSupport: true, isPremium: false },
  { name: "Box", slug: "box", description: "Enterprise content management", category: "storage", authType: "oauth2", baseUrl: "https://api.box.com", webhookSupport: true, isPremium: true },
  { name: "Zapier", slug: "zapier", description: "Workflow automation", category: "productivity", authType: "api_key", baseUrl: "https://api.zapier.com", webhookSupport: true, isPremium: false },
  { name: "Make", slug: "make", description: "Visual automation platform", category: "productivity", authType: "api_key", baseUrl: "https://eu1.make.com/api", webhookSupport: true, isPremium: false },
  { name: "n8n", slug: "n8n", description: "Open-source workflow automation", category: "productivity", authType: "api_key", baseUrl: "https://api.n8n.io", webhookSupport: true, isPremium: false },
  { name: "Intercom", slug: "intercom", description: "Customer messaging platform", category: "communication", authType: "bearer", baseUrl: "https://api.intercom.io", webhookSupport: true, isPremium: true },
  { name: "Shopify", slug: "shopify", description: "E-commerce platform", category: "finance", authType: "oauth2", baseUrl: "https://shopify.com/admin/api", webhookSupport: true, isPremium: false },
  { name: "WooCommerce", slug: "woocommerce", description: "WordPress e-commerce", category: "finance", authType: "basic", baseUrl: "", webhookSupport: true, isPremium: false },
  { name: "Datadog", slug: "datadog", description: "Monitoring and analytics", category: "devops", authType: "api_key", baseUrl: "https://api.datadoghq.com", webhookSupport: true, isPremium: true },
  { name: "PagerDuty", slug: "pagerduty", description: "Incident management", category: "devops", authType: "bearer", baseUrl: "https://api.pagerduty.com", webhookSupport: true, isPremium: false },
  { name: "Linear", slug: "linear", description: "Issue tracking for teams", category: "productivity", authType: "bearer", baseUrl: "https://api.linear.app", webhookSupport: true, isPremium: false },
];

class IntegrationsHubService {
  async initializeConnectors(): Promise<void> {
    const existing = await db.select({ slug: hubConnectors.slug }).from(hubConnectors);
    const existingSlugs = new Set(existing.map(c => c.slug));

    const newConnectors = PRESET_CONNECTORS.filter(c => !existingSlugs.has(c.slug));
    
    if (newConnectors.length > 0) {
      await db.insert(hubConnectors).values(newConnectors as any);
    }
  }

  async getAllConnectors(): Promise<HubConnector[]> {
    return db.select()
      .from(hubConnectors)
      .orderBy(hubConnectors.category, hubConnectors.name);
  }

  async getConnectorsByCategory(category: typeof integrationHubCategories[number]): Promise<HubConnector[]> {
    return db.select()
      .from(hubConnectors)
      .where(eq(hubConnectors.category, category))
      .orderBy(hubConnectors.name);
  }

  async searchConnectors(query: string): Promise<HubConnector[]> {
    return db.select()
      .from(hubConnectors)
      .where(ilike(hubConnectors.name, `%${query}%`))
      .orderBy(desc(hubConnectors.usageCount));
  }

  async getConnector(connectorId: number): Promise<HubConnector | null> {
    const [connector] = await db.select()
      .from(hubConnectors)
      .where(eq(hubConnectors.id, connectorId));
    return connector || null;
  }

  async getConnectorBySlug(slug: string): Promise<HubConnector | null> {
    const [connector] = await db.select()
      .from(hubConnectors)
      .where(eq(hubConnectors.slug, slug));
    return connector || null;
  }

  async connectIntegration(
    userId: string,
    connectorId: number,
    credentials: Record<string, string>,
    config?: Record<string, any>
  ): Promise<UserIntegration> {
    const connector = await this.getConnector(connectorId);
    if (!connector) throw new Error("Connector not found");

    const encryptedCredentials = this.encryptCredentials(credentials);
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    const [integration] = await db.insert(userIntegrations).values({
      userId,
      connectorId,
      credentials: encryptedCredentials,
      webhookSecret,
      config: config ? JSON.stringify(config) : null,
      isActive: true,
    }).returning();

    await db.update(hubConnectors)
      .set({ usageCount: sql`${hubConnectors.usageCount} + 1` })
      .where(eq(hubConnectors.id, connectorId));

    return integration;
  }

  async updateIntegration(
    integrationId: number,
    userId: string,
    updates: {
      credentials?: Record<string, string>;
      config?: Record<string, any>;
      isActive?: boolean;
    }
  ): Promise<UserIntegration> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.credentials) {
      updateData.credentials = this.encryptCredentials(updates.credentials);
    }
    if (updates.config !== undefined) {
      updateData.config = JSON.stringify(updates.config);
    }
    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive;
    }

    const [integration] = await db.update(userIntegrations)
      .set(updateData)
      .where(and(
        eq(userIntegrations.id, integrationId),
        eq(userIntegrations.userId, userId)
      ))
      .returning();

    return integration;
  }

  async disconnectIntegration(integrationId: number, userId: string): Promise<void> {
    await db.delete(userIntegrations)
      .where(and(
        eq(userIntegrations.id, integrationId),
        eq(userIntegrations.userId, userId)
      ));
  }

  async getUserIntegrations(userId: string): Promise<(UserIntegration & { connector: HubConnector })[]> {
    const result = await db.select()
      .from(userIntegrations)
      .innerJoin(hubConnectors, eq(userIntegrations.connectorId, hubConnectors.id))
      .where(eq(userIntegrations.userId, userId));

    return result.map(r => ({
      ...r.user_integrations,
      connector: r.hub_connectors,
    }));
  }

  async getIntegration(integrationId: number, userId: string): Promise<UserIntegration | null> {
    const [integration] = await db.select()
      .from(userIntegrations)
      .where(and(
        eq(userIntegrations.id, integrationId),
        eq(userIntegrations.userId, userId)
      ));
    return integration || null;
  }

  async recordUsage(integrationId: number): Promise<void> {
    await db.update(userIntegrations)
      .set({ lastUsedAt: new Date() })
      .where(eq(userIntegrations.id, integrationId));
  }

  generateOAuthUrl(connector: HubConnector, state: string): string {
    if (connector.authType !== "oauth2" || !connector.authConfig) {
      throw new Error("Connector does not support OAuth2");
    }

    const config = JSON.parse(connector.authConfig) as OAuthConfig;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: config.scopes.join(" "),
      state,
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async exchangeOAuthCode(
    connector: HubConnector,
    code: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    if (connector.authType !== "oauth2" || !connector.authConfig) {
      throw new Error("Connector does not support OAuth2");
    }

    const config = JSON.parse(connector.authConfig) as OAuthConfig;
    
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to exchange OAuth code");
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  private encryptCredentials(credentials: Record<string, string>): string {
    const key = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(key.slice(0, 32)), iv);
    
    let encrypted = cipher.update(JSON.stringify(credentials), "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString("hex"),
      encrypted,
      authTag: authTag.toString("hex"),
    });
  }

  async getPopularConnectors(limit: number = 10): Promise<HubConnector[]> {
    return db.select()
      .from(hubConnectors)
      .orderBy(desc(hubConnectors.usageCount))
      .limit(limit);
  }

  async getCategoryStats(): Promise<Record<string, number>> {
    const result = await db.select({
      category: hubConnectors.category,
      count: sql<number>`count(*)`,
    })
    .from(hubConnectors)
    .groupBy(hubConnectors.category);

    return result.reduce((acc, r) => {
      acc[r.category] = Number(r.count);
      return acc;
    }, {} as Record<string, number>);
  }
}

export const integrationsHubService = new IntegrationsHubService();
