import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Log levels for structured logging
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  message: string;
  source?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  userId?: string | number;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

// Store request ID in async local storage for access across the request lifecycle
import { AsyncLocalStorage } from "async_hooks";

interface RequestContext {
  requestId: string;
  userId?: string | number;
  startTime: number;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request ID from context
 */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

/**
 * Get the current user ID from context
 */
export function getCurrentUserId(): string | number | undefined {
  return requestContext.getStore()?.userId;
}

/**
 * Set the current user ID in context
 */
export function setCurrentUserId(userId: string | number): void {
  const store = requestContext.getStore();
  if (store) {
    store.userId = userId;
  }
}

/**
 * Format log entry as JSON string for structured logging
 */
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Core logger class with structured logging support
 */
class Logger {
  private source: string;

  constructor(source: string = "app") {
    this.source = source;
  }

  private createEntry(level: LogLevel, message: string, metadata?: Record<string, unknown>): LogEntry {
    const store = requestContext.getStore();
    return {
      timestamp: new Date().toISOString(),
      level,
      requestId: store?.requestId,
      userId: store?.userId,
      message,
      source: this.source,
      metadata,
    };
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === "debug") {
      console.log(formatLogEntry(this.createEntry(LogLevel.DEBUG, message, metadata)));
    }
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    console.log(formatLogEntry(this.createEntry(LogLevel.INFO, message, metadata)));
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    console.warn(formatLogEntry(this.createEntry(LogLevel.WARN, message, metadata)));
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const entry = this.createEntry(LogLevel.ERROR, message, metadata);
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
      };
    }
    console.error(formatLogEntry(entry));
  }

  /**
   * Log HTTP request/response
   */
  http(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    metadata?: Record<string, unknown>
  ): void {
    const entry = this.createEntry(LogLevel.INFO, `${method} ${path}`, metadata);
    entry.method = method;
    entry.path = path;
    entry.statusCode = statusCode;
    entry.durationMs = durationMs;
    console.log(formatLogEntry(entry));
  }

  /**
   * Create a child logger with a different source
   */
  child(source: string): Logger {
    return new Logger(source);
  }
}

// Default logger instance
export const logger = new Logger();

/**
 * Express middleware to attach request ID and set up logging context
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check for existing request ID in headers (for distributed tracing)
  const existingRequestId = req.headers["x-request-id"];
  const requestId = typeof existingRequestId === "string" ? existingRequestId : randomUUID();

  // Set request ID on response headers for correlation
  res.setHeader("X-Request-Id", requestId);

  // Run the rest of the request in the async context
  requestContext.run(
    {
      requestId,
      startTime: Date.now(),
    },
    () => {
      next();
    }
  );
}

/**
 * Express middleware for HTTP request logging
 */
export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const store = requestContext.getStore();
  const startTime = store?.startTime || Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    // Only log API requests to keep logs focused
    if (req.path.startsWith("/api")) {
      logger.http(req.method, req.path, res.statusCode, duration, {
        userAgent: req.headers["user-agent"],
        ip: req.ip || req.socket.remoteAddress,
        contentLength: res.get("Content-Length"),
      });
    }
  });

  next();
}

/**
 * Create a logger for a specific service/module
 */
export function createLogger(source: string): Logger {
  return logger.child(source);
}

// Re-export for convenience
export default logger;
