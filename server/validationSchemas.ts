import { z } from "zod";

// Generic validation helper
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError["errors"] } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.errors };
}

// Common validation schemas for endpoints that might be missing them

export const selectWinnerSchema = z.object({
  submissionId: z.number().int().positive(),
  autoRelease: z.boolean().optional().default(false),
});

export const agentReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(1).max(200).optional(),
  comment: z.string().max(2000).optional(),
  isVerifiedPurchase: z.boolean().optional().default(false),
});

export const badgeAwardSchema = z.object({
  badgeType: z.enum([
    "verified_secure", "top_performer", "trending", 
    "featured", "enterprise_ready", "community_favorite", "new_release"
  ]),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const integrationConnectorSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  category: z.enum(["ai_ml", "communication", "productivity", "data", "marketing", "payment", "developer"]),
  iconUrl: z.string().url().optional(),
  authType: z.enum(["oauth", "api_key", "basic", "none"]).optional(),
  configSchema: z.record(z.any()).optional(),
  docsUrl: z.string().url().optional(),
  isPremium: z.boolean().optional().default(false),
});

export const agentListingSchema = z.object({
  title: z.string().min(1).max(200),
  shortDescription: z.string().max(500).optional(),
  fullDescription: z.string().max(5000).optional(),
  price: z.number().min(0).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  screenshots: z.array(z.string().url()).optional(),
  demoUrl: z.string().url().optional(),
});

export const llmConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic", "groq", "custom"]),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  apiKey: z.string().optional(), // Will be encrypted
  baseUrl: z.string().url().optional(),
});

export const credentialConsentSchema = z.object({
  agentId: z.number().int().positive(),
  consentText: z.string().max(2000).optional(),
  expiresAt: z.string().datetime().optional(),
  credentials: z.record(z.string()).optional(),
});

export const disputeCreateSchema = z.object({
  submissionId: z.number().int().positive(),
  category: z.enum(["quality", "incomplete", "criteria_mismatch", "deadline_missed", "payment_issue", "other"]),
  description: z.string().min(10).max(5000),
  evidenceUrls: z.array(z.string().url()).optional(),
});

export const ticketCreateSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  category: z.enum(["billing", "technical", "account", "bounty", "agent", "dispute", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  relatedBountyId: z.number().int().positive().optional(),
  relatedAgentId: z.number().int().positive().optional(),
});

// Sanitization helpers
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export function sanitizeForDb(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      // Basic SQL injection prevention (already handled by Drizzle, but extra safety)
      sanitized[key] = value.replace(/[\x00-\x1F\x7F]/g, "");
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForDb(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
