import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// Extend session type to include CSRF token
declare module "express-session" {
  interface SessionData {
    csrfToken?: string;
  }
}

const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generates a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Middleware to ensure a CSRF token exists in the session
 * Creates one if it doesn't exist
 */
export function ensureCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  next();
}

/**
 * Middleware to validate CSRF token for state-changing operations
 * Checks POST, PUT, PATCH, DELETE requests for valid CSRF token
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();

  // Only validate state-changing methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }

  // Skip CSRF validation for specific paths that use external webhooks
  const skipPaths = [
    "/api/stripe/webhook",
    "/api/callback", // OAuth callback
    "/api/login",
    "/api/logout",
  ];

  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Skip for API token authentication (JWT-based requests)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return next();
  }

  // Require CSRF token for session-based authentication
  const sessionToken = req.session?.csrfToken;
  const requestToken = req.headers[CSRF_HEADER_NAME] as string || req.body?._csrf;

  if (!sessionToken) {
    return res.status(403).json({
      message: "CSRF validation failed: No session token",
      code: "CSRF_NO_SESSION"
    });
  }

  if (!requestToken) {
    return res.status(403).json({
      message: "CSRF validation failed: No token provided",
      code: "CSRF_TOKEN_MISSING"
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(sessionToken, requestToken)) {
    return res.status(403).json({
      message: "CSRF validation failed: Token mismatch",
      code: "CSRF_TOKEN_INVALID"
    });
  }

  next();
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Route handler to get the current CSRF token
 * Should be called on page load to get token for forms/requests
 */
export function getCsrfTokenHandler(req: Request, res: Response) {
  if (!req.session) {
    return res.status(500).json({ message: "Session not available" });
  }

  // Ensure token exists
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  res.json({ csrfToken: req.session.csrfToken });
}

/**
 * Combined middleware that ensures token exists and validates on state-changing operations
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Ensure token exists
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  // Then validate
  validateCsrfToken(req, res, next);
}

export default {
  generateCsrfToken,
  ensureCsrfToken,
  validateCsrfToken,
  getCsrfTokenHandler,
  csrfProtection,
};
