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

/**
 * Escapes HTML entities to prevent XSS attacks
 * Use this for any user-provided text that will be rendered in HTML
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/`/g, "&#x60;")
    .replace(/=/g, "&#x3D;");
}

/**
 * Strips HTML tags entirely (for plain text contexts)
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitizes input for safe database storage
 * Removes null bytes and control characters
 */
export function sanitizeForDb(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      // Remove null bytes and control characters (except newlines/tabs)
      sanitized[key] = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'object' && item !== null ? sanitizeForDb(item) :
        typeof item === 'string' ? item.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") : item
      );
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForDb(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Sanitizes user input text - strips dangerous patterns but preserves readability
 * Use for titles, descriptions, comments, etc.
 */
export function sanitizeUserText(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    // Remove null bytes and most control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove potential script injection patterns
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, 'data\u200B:')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // Normalize whitespace
    .trim();
}

/**
 * Sanitizes an entire object's string fields recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T, htmlEscape: boolean = false): T {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = htmlEscape ? sanitizeHtml(sanitizeUserText(value)) : sanitizeUserText(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        if (typeof item === 'string') {
          return htmlEscape ? sanitizeHtml(sanitizeUserText(item)) : sanitizeUserText(item);
        } else if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item, htmlEscape);
        }
        return item;
      });
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value, htmlEscape);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}

/**
 * Creates a Zod transformer that sanitizes string input
 */
export function sanitizedString() {
  return z.string().transform(sanitizeUserText);
}

/**
 * Creates a Zod transformer for HTML-safe string input
 */
export function htmlSafeString() {
  return z.string().transform((val) => sanitizeHtml(sanitizeUserText(val)));
}
