import { Request, Response, NextFunction } from "express";
import { sanitizeObject, sanitizeUserText, sanitizeHtml } from "./validationSchemas";

/**
 * Middleware that sanitizes all string fields in req.body
 * Applies sanitizeUserText to remove dangerous patterns
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body, false);
  }
  next();
}

/**
 * Middleware that sanitizes query parameters
 */
export function sanitizeQueryParams(req: Request, res: Response, next: NextFunction) {
  if (req.query && typeof req.query === "object") {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string") {
        (req.query as Record<string, any>)[key] = sanitizeUserText(value);
      }
    }
  }
  next();
}

/**
 * Middleware that sanitizes route parameters
 */
export function sanitizeRouteParams(req: Request, res: Response, next: NextFunction) {
  if (req.params && typeof req.params === "object") {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === "string") {
        // Route params are usually IDs, but sanitize anyway
        req.params[key] = sanitizeUserText(value);
      }
    }
  }
  next();
}

/**
 * Combined middleware that sanitizes body, query, and params
 */
export function sanitizeAllInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize body
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body, false);
  }

  // Sanitize query
  if (req.query && typeof req.query === "object") {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string") {
        (req.query as Record<string, any>)[key] = sanitizeUserText(value);
      }
    }
  }

  // Sanitize params
  if (req.params && typeof req.params === "object") {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === "string") {
        req.params[key] = sanitizeUserText(value);
      }
    }
  }

  next();
}

/**
 * Factory function to create a sanitization middleware for specific fields
 * @param fields - Array of field names to sanitize (dot notation supported for nested)
 * @param htmlEscape - Whether to also HTML-escape the values
 */
export function sanitizeFields(fields: string[], htmlEscape: boolean = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== "object") {
      return next();
    }

    for (const field of fields) {
      const parts = field.split(".");
      let obj: any = req.body;

      for (let i = 0; i < parts.length - 1; i++) {
        if (obj && typeof obj === "object") {
          obj = obj[parts[i]];
        } else {
          obj = undefined;
          break;
        }
      }

      const lastPart = parts[parts.length - 1];
      if (obj && typeof obj === "object" && typeof obj[lastPart] === "string") {
        obj[lastPart] = htmlEscape
          ? sanitizeHtml(sanitizeUserText(obj[lastPart]))
          : sanitizeUserText(obj[lastPart]);
      }
    }

    next();
  };
}

export default {
  sanitizeRequestBody,
  sanitizeQueryParams,
  sanitizeRouteParams,
  sanitizeAllInput,
  sanitizeFields,
};
