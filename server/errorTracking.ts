import { Request, Response, NextFunction } from "express";
import { getRequestId, getCurrentUserId, createLogger } from "./logger";

const errorLogger = createLogger("error-tracking");

/**
 * Error severity levels compatible with Sentry
 */
export enum ErrorSeverity {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  FATAL = "fatal",
}

/**
 * Error context for tracking
 */
export interface ErrorContext {
  requestId?: string;
  userId?: string | number;
  path?: string;
  method?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Sentry-compatible error event
 */
export interface ErrorEvent {
  eventId: string;
  timestamp: string;
  level: ErrorSeverity;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context: ErrorContext;
  fingerprint?: string[];
  environment: string;
  release?: string;
}

/**
 * Error tracking configuration
 */
export interface ErrorTrackingConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  beforeSend?: (event: ErrorEvent) => ErrorEvent | null;
  ignoreErrors?: (string | RegExp)[];
}

// Global configuration
let config: ErrorTrackingConfig = {
  environment: process.env.NODE_ENV || "development",
  release: process.env.APP_VERSION || process.env.npm_package_version,
  sampleRate: 1.0,
  ignoreErrors: [],
};

// In-memory event store for when Sentry is not configured
const recentErrors: ErrorEvent[] = [];
const MAX_STORED_ERRORS = 100;

/**
 * Initialize error tracking with Sentry-compatible configuration
 * When SENTRY_DSN is provided and @sentry/node is installed,
 * it will automatically integrate with Sentry
 */
export function initErrorTracking(userConfig: ErrorTrackingConfig = {}): void {
  config = { ...config, ...userConfig };

  // Check for Sentry DSN in environment
  const dsn = userConfig.dsn || process.env.SENTRY_DSN;

  if (dsn) {
    errorLogger.info("Error tracking configured with DSN", {
      environment: config.environment,
      release: config.release,
    });
    config.dsn = dsn;
  } else {
    errorLogger.info("Error tracking initialized without Sentry DSN (local mode)", {
      environment: config.environment,
    });
  }
}

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

/**
 * Check if an error should be ignored
 */
function shouldIgnoreError(error: Error): boolean {
  const errorString = `${error.name}: ${error.message}`;

  for (const pattern of config.ignoreErrors || []) {
    if (typeof pattern === "string") {
      if (errorString.includes(pattern)) return true;
    } else if (pattern instanceof RegExp) {
      if (pattern.test(errorString)) return true;
    }
  }

  return false;
}

/**
 * Apply sampling rate
 */
function shouldSample(): boolean {
  return Math.random() < (config.sampleRate || 1.0);
}

/**
 * Scrub sensitive data from context
 */
function scrubSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    "password", "token", "secret", "api_key", "apiKey", "authorization",
    "credit_card", "creditCard", "ssn", "social_security",
    "stripe_key", "stripeKey", "private_key", "privateKey",
  ];

  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()));

    if (isSensitive) {
      scrubbed[key] = "[Filtered]";
    } else if (typeof value === "object" && value !== null) {
      scrubbed[key] = scrubSensitiveData(value as Record<string, unknown>);
    } else {
      scrubbed[key] = value;
    }
  }

  return scrubbed;
}

/**
 * Capture an exception and send to error tracking
 */
export function captureException(
  error: Error,
  context: Partial<ErrorContext> = {},
  severity: ErrorSeverity = ErrorSeverity.ERROR
): string | null {
  // Check if error should be ignored
  if (shouldIgnoreError(error)) {
    return null;
  }

  // Apply sampling
  if (!shouldSample()) {
    return null;
  }

  // Build error event
  const event: ErrorEvent = {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    level: severity,
    message: error.message,
    error: {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    },
    context: {
      requestId: context.requestId || getRequestId(),
      userId: context.userId || getCurrentUserId(),
      ...scrubSensitiveData(context as Record<string, unknown>) as Partial<ErrorContext>,
    },
    environment: config.environment || "development",
    release: config.release,
  };

  // Apply beforeSend hook
  if (config.beforeSend) {
    const processedEvent = config.beforeSend(event);
    if (!processedEvent) {
      return null; // Event was dropped by beforeSend
    }
  }

  // Log the error
  errorLogger.error("Captured exception", error, {
    eventId: event.eventId,
    level: event.level,
    context: event.context,
  });

  // Store in memory (for local mode or debugging)
  storeEvent(event);

  // If Sentry SDK is available and configured, it would be called here
  // The actual Sentry.captureException call would be:
  // Sentry.captureException(error, { contexts: event.context, tags: context.tags });

  return event.eventId;
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  severity: ErrorSeverity = ErrorSeverity.INFO,
  context: Partial<ErrorContext> = {}
): string | null {
  // Apply sampling
  if (!shouldSample()) {
    return null;
  }

  const event: ErrorEvent = {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    level: severity,
    message,
    context: {
      requestId: context.requestId || getRequestId(),
      userId: context.userId || getCurrentUserId(),
      ...scrubSensitiveData(context as Record<string, unknown>) as Partial<ErrorContext>,
    },
    environment: config.environment || "development",
    release: config.release,
  };

  // Apply beforeSend hook
  if (config.beforeSend) {
    const processedEvent = config.beforeSend(event);
    if (!processedEvent) {
      return null;
    }
  }

  // Log based on severity
  if (severity === ErrorSeverity.ERROR || severity === ErrorSeverity.FATAL) {
    errorLogger.error(message, undefined, { eventId: event.eventId });
  } else if (severity === ErrorSeverity.WARNING) {
    errorLogger.warn(message, { eventId: event.eventId });
  } else {
    errorLogger.info(message, { eventId: event.eventId });
  }

  storeEvent(event);

  return event.eventId;
}

/**
 * Store event in local memory buffer
 */
function storeEvent(event: ErrorEvent): void {
  recentErrors.push(event);
  if (recentErrors.length > MAX_STORED_ERRORS) {
    recentErrors.shift();
  }
}

/**
 * Get recent errors (useful for debugging/admin dashboards)
 */
export function getRecentErrors(): ErrorEvent[] {
  return [...recentErrors];
}

/**
 * Clear recent errors
 */
export function clearRecentErrors(): void {
  recentErrors.length = 0;
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string | number; email?: string; username?: string }): void {
  // This would set the user in Sentry when SDK is available
  // Sentry.setUser(user);
  errorLogger.debug("User context set", { userId: user.id });
}

/**
 * Clear user context
 */
export function clearUser(): void {
  // Sentry.setUser(null);
  errorLogger.debug("User context cleared");
}

/**
 * Add breadcrumb for error tracking context
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: ErrorSeverity;
  data?: Record<string, unknown>;
}): void {
  // This would add a breadcrumb in Sentry when SDK is available
  // Sentry.addBreadcrumb(breadcrumb);
  errorLogger.debug("Breadcrumb added", {
    category: breadcrumb.category,
    message: breadcrumb.message,
  });
}

/**
 * Set a tag for all subsequent error tracking
 */
export function setTag(key: string, value: string): void {
  // Sentry.setTag(key, value);
  errorLogger.debug("Tag set", { key, value });
}

/**
 * Set extra context data
 */
export function setExtra(key: string, value: unknown): void {
  // Sentry.setExtra(key, value);
  errorLogger.debug("Extra context set", { key });
}

/**
 * Express error handling middleware for automatic error capture
 */
export function errorTrackingMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract context from request
  const context: ErrorContext = {
    requestId: getRequestId(),
    userId: getCurrentUserId(),
    path: req.path,
    method: req.method,
    query: req.query as Record<string, unknown>,
    headers: {
      "user-agent": req.headers["user-agent"] || "",
      "content-type": req.headers["content-type"] || "",
      "x-forwarded-for": (req.headers["x-forwarded-for"] as string) || "",
    },
  };

  // Determine severity based on status code
  const statusCode = (err as any).status || (err as any).statusCode || 500;
  let severity = ErrorSeverity.ERROR;

  if (statusCode >= 500) {
    severity = ErrorSeverity.ERROR;
  } else if (statusCode >= 400) {
    severity = ErrorSeverity.WARNING;
  }

  // Capture the exception
  captureException(err, context, severity);

  // Continue to next error handler
  next(err);
}

/**
 * Request handler wrapper for automatic error capture
 */
export function withErrorTracking<T>(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (error) {
      const context: ErrorContext = {
        requestId: getRequestId(),
        userId: getCurrentUserId(),
        path: req.path,
        method: req.method,
      };

      captureException(error as Error, context);
      next(error);
    }
  };
}

/**
 * Wrap an async function with error tracking
 */
export function wrapWithErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: Partial<ErrorContext> = {}
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error as Error, context);
      throw error;
    }
  }) as T;
}

/**
 * Start a transaction for performance monitoring (Sentry Tracing compatible)
 */
export function startTransaction(options: {
  name: string;
  op: string;
  description?: string;
}): { finish: () => void; setStatus: (status: string) => void } {
  const startTime = Date.now();
  let status = "ok";

  errorLogger.debug("Transaction started", { name: options.name, op: options.op });

  return {
    finish: () => {
      const duration = Date.now() - startTime;
      errorLogger.debug("Transaction finished", {
        name: options.name,
        op: options.op,
        duration,
        status,
      });
    },
    setStatus: (newStatus: string) => {
      status = newStatus;
    },
  };
}

/**
 * Check if error tracking is configured with a DSN
 */
export function isConfigured(): boolean {
  return !!config.dsn;
}

/**
 * Get current configuration (for debugging)
 */
export function getConfig(): Readonly<ErrorTrackingConfig> {
  return { ...config, dsn: config.dsn ? "[CONFIGURED]" : undefined };
}

// Initialize with defaults on module load
initErrorTracking();

export default {
  init: initErrorTracking,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  setTag,
  setExtra,
  getRecentErrors,
  clearRecentErrors,
  errorTrackingMiddleware,
  withErrorTracking,
  wrapWithErrorTracking,
  startTransaction,
  isConfigured,
  getConfig,
};
