/**
 * XSS Protection for Stored Content
 *
 * This module provides functions to sanitize user content before storing in the database
 * to prevent stored XSS attacks. It works alongside the input sanitization middleware
 * to provide defense-in-depth protection.
 */

import { sanitizeHtml, sanitizeUserText } from "./validationSchemas";

/**
 * Fields that contain user-generated content and should be HTML-escaped before storage
 */
const HTML_CONTENT_FIELDS = [
  "title",
  "description",
  "content",
  "comment",
  "message",
  "name",
  "bio",
  "fullDescription",
  "shortDescription",
  "requirements",
  "subject",
  "body",
  "answer",
  "text",
  "reason",
  "resolution",
  "consentText",
] as const;

/**
 * Fields that may contain structured data (JSON) and should not be escaped
 */
const STRUCTURED_DATA_FIELDS = [
  "config",
  "configSchema",
  "metadata",
  "settings",
  "evidenceUrls",
  "tags",
  "features",
  "screenshots",
  "criteria",
  "capabilities",
  "tools",
] as const;

type HtmlContentField = (typeof HTML_CONTENT_FIELDS)[number];
type StructuredDataField = (typeof STRUCTURED_DATA_FIELDS)[number];

/**
 * Check if a field should be HTML-escaped
 */
function isHtmlContentField(field: string): field is HtmlContentField {
  return HTML_CONTENT_FIELDS.includes(field as HtmlContentField);
}

/**
 * Check if a field contains structured data that should not be escaped
 */
function isStructuredDataField(field: string): field is StructuredDataField {
  return STRUCTURED_DATA_FIELDS.includes(field as StructuredDataField);
}

/**
 * Sanitizes a string value for safe storage
 * Applies HTML encoding to prevent XSS when content is later rendered
 */
export function sanitizeForStorage(value: string): string {
  if (typeof value !== "string") return "";
  // First apply user text sanitization (removes dangerous patterns)
  // Then apply HTML encoding for safe display
  return sanitizeHtml(sanitizeUserText(value));
}

/**
 * Sanitizes user content before storage, applying HTML encoding to text fields
 * but preserving structured data fields
 *
 * @param data - The data object to sanitize
 * @param fieldsToSanitize - Optional specific fields to sanitize. If not provided, sanitizes HTML_CONTENT_FIELDS
 * @returns Sanitized data object
 */
export function sanitizeContentForStorage<T extends Record<string, any>>(
  data: T,
  fieldsToSanitize?: string[]
): T {
  if (!data || typeof data !== "object") {
    return data;
  }

  const result: Record<string, any> = {};
  const targetFields = fieldsToSanitize || (HTML_CONTENT_FIELDS as unknown as string[]);

  for (const [key, value] of Object.entries(data)) {
    // Skip null/undefined values
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    // Skip structured data fields
    if (isStructuredDataField(key)) {
      result[key] = value;
      continue;
    }

    // Sanitize string fields that match our target fields
    if (typeof value === "string" && targetFields.includes(key)) {
      result[key] = sanitizeForStorage(value);
    }
    // Recursively sanitize nested objects (but not arrays of structured data)
    else if (typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeContentForStorage(value, fieldsToSanitize);
    }
    // Handle arrays - sanitize string arrays that match target fields
    else if (Array.isArray(value) && targetFields.includes(key)) {
      result[key] = value.map((item) =>
        typeof item === "string" ? sanitizeForStorage(item) : item
      );
    }
    // Pass through other values unchanged
    else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Sanitizes bounty data before storage
 */
export function sanitizeBountyContent<T extends Record<string, any>>(data: T): T {
  return sanitizeContentForStorage(data, [
    "title",
    "description",
    "requirements",
  ]);
}

/**
 * Sanitizes agent data before storage
 */
export function sanitizeAgentContent<T extends Record<string, any>>(data: T): T {
  return sanitizeContentForStorage(data, [
    "name",
    "description",
    "bio",
    "fullDescription",
    "shortDescription",
  ]);
}

/**
 * Sanitizes submission/review data before storage
 */
export function sanitizeSubmissionContent<T extends Record<string, any>>(data: T): T {
  return sanitizeContentForStorage(data, ["comment", "content", "message"]);
}

/**
 * Sanitizes support ticket/dispute data before storage
 */
export function sanitizeTicketContent<T extends Record<string, any>>(data: T): T {
  return sanitizeContentForStorage(data, [
    "subject",
    "description",
    "message",
    "resolution",
    "reason",
  ]);
}

/**
 * Sanitizes user profile data before storage
 */
export function sanitizeProfileContent<T extends Record<string, any>>(data: T): T {
  return sanitizeContentForStorage(data, ["name", "bio", "description"]);
}

/**
 * Sanitizes discussion/comment data before storage
 */
export function sanitizeDiscussionContent<T extends Record<string, any>>(data: T): T {
  return sanitizeContentForStorage(data, ["title", "content", "body"]);
}

/**
 * Validates that a string doesn't contain potentially dangerous HTML
 * Returns true if the string is safe, false if it contains suspicious patterns
 */
export function isContentSafe(value: string): boolean {
  if (typeof value !== "string") return true;

  // Check for common XSS patterns
  const dangerousPatterns = [
    /<script\b/i,
    /<\/script>/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<form\b/i,
    /<input\b/i,
    /<button\b/i,
    /data:\s*text\/html/i,
    /<svg[^>]*\bon\w+/i,
    /<img[^>]*\bon\w+/i,
    /<body[^>]*\bon\w+/i,
    /<link\b/i,
    /<meta\b/i,
    /<style\b/i,
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(value));
}

/**
 * Checks all string fields in an object for potentially dangerous content
 * Returns an array of field names that contain suspicious patterns
 */
export function detectUnsafeContent(data: Record<string, any>): string[] {
  const unsafeFields: string[] = [];

  function checkValue(key: string, value: any, prefix = ""): void {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string" && !isContentSafe(value)) {
      unsafeFields.push(fieldPath);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "string" && !isContentSafe(item)) {
          unsafeFields.push(`${fieldPath}[${index}]`);
        } else if (typeof item === "object" && item !== null) {
          for (const [k, v] of Object.entries(item)) {
            checkValue(k, v, `${fieldPath}[${index}]`);
          }
        }
      });
    } else if (typeof value === "object" && value !== null) {
      for (const [k, v] of Object.entries(value)) {
        checkValue(k, v, fieldPath);
      }
    }
  }

  for (const [key, value] of Object.entries(data)) {
    checkValue(key, value);
  }

  return unsafeFields;
}

export default {
  sanitizeForStorage,
  sanitizeContentForStorage,
  sanitizeBountyContent,
  sanitizeAgentContent,
  sanitizeSubmissionContent,
  sanitizeTicketContent,
  sanitizeProfileContent,
  sanitizeDiscussionContent,
  isContentSafe,
  detectUnsafeContent,
};
