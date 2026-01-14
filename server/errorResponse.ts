import { Response } from "express";

/**
 * Standardized error codes used across the application
 */
export enum ErrorCode {
  // Authentication errors (401)
  AUTH_REQUIRED = "AUTH_REQUIRED",
  TOKEN_REQUIRED = "TOKEN_REQUIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  // Authorization errors (403)
  FORBIDDEN = "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  ADMIN_REQUIRED = "ADMIN_REQUIRED",
  CSRF_NO_SESSION = "CSRF_NO_SESSION",
  CSRF_TOKEN_MISSING = "CSRF_TOKEN_MISSING",
  CSRF_TOKEN_INVALID = "CSRF_TOKEN_INVALID",

  // Client errors (400)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",
  INVALID_STATUS = "INVALID_STATUS",
  MISSING_FIELD = "MISSING_FIELD",

  // Not found errors (404)
  NOT_FOUND = "NOT_FOUND",
  BOUNTY_NOT_FOUND = "BOUNTY_NOT_FOUND",
  AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
  SUBMISSION_NOT_FOUND = "SUBMISSION_NOT_FOUND",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",

  // Payment errors
  PAYMENT_ERROR = "PAYMENT_ERROR",
  WEBHOOK_ERROR = "WEBHOOK_ERROR",
}

/**
 * Standardized error response structure
 */
export interface StandardErrorResponse {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
    retryAfter?: number;
  };
}

/**
 * Standardized success response structure (for reference)
 */
export interface StandardSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Send a standardized error response
 */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCode | string,
  message: string,
  details?: unknown,
  retryAfter?: number
): Response {
  const response: StandardErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    response.error.details = details;
  }

  if (retryAfter !== undefined) {
    response.error.retryAfter = retryAfter;
  }

  return res.status(status).json(response);
}

// Convenience functions for common error types

export function sendUnauthorized(
  res: Response,
  message = "Authentication required",
  code: ErrorCode = ErrorCode.AUTH_REQUIRED
): Response {
  return sendError(res, 401, code, message);
}

export function sendForbidden(
  res: Response,
  message = "Access denied",
  code: ErrorCode = ErrorCode.FORBIDDEN
): Response {
  return sendError(res, 403, code, message);
}

export function sendNotFound(
  res: Response,
  message = "Resource not found",
  code: ErrorCode = ErrorCode.NOT_FOUND
): Response {
  return sendError(res, 404, code, message);
}

export function sendValidationError(
  res: Response,
  message = "Validation failed",
  details?: unknown
): Response {
  return sendError(res, 400, ErrorCode.VALIDATION_ERROR, message, details);
}

export function sendBadRequest(
  res: Response,
  message = "Invalid request",
  code: ErrorCode = ErrorCode.INVALID_REQUEST,
  details?: unknown
): Response {
  return sendError(res, 400, code, message, details);
}

export function sendRateLimitExceeded(
  res: Response,
  message = "Too many requests, please try again later",
  retryAfter: number
): Response {
  return sendError(res, 429, ErrorCode.RATE_LIMIT_EXCEEDED, message, undefined, retryAfter);
}

export function sendInternalError(
  res: Response,
  message = "Internal server error"
): Response {
  return sendError(res, 500, ErrorCode.INTERNAL_ERROR, message);
}

export function sendServiceUnavailable(
  res: Response,
  message = "Service temporarily unavailable"
): Response {
  return sendError(res, 503, ErrorCode.SERVICE_UNAVAILABLE, message);
}

/**
 * Create an error object that can be thrown and caught by the global error handler
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode | string;
  public readonly details?: unknown;
  public readonly retryAfter?: number;

  constructor(
    status: number,
    code: ErrorCode | string,
    message: string,
    details?: unknown,
    retryAfter?: number
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
    this.name = "AppError";
  }
}
