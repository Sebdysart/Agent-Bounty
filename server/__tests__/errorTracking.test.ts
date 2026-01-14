import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initErrorTracking,
  captureException,
  captureMessage,
  getRecentErrors,
  clearRecentErrors,
  setUser,
  clearUser,
  addBreadcrumb,
  setTag,
  setExtra,
  errorTrackingMiddleware,
  withErrorTracking,
  wrapWithErrorTracking,
  startTransaction,
  isConfigured,
  getConfig,
  ErrorSeverity,
} from "../errorTracking";
import type { Request, Response, NextFunction } from "express";

describe("errorTracking", () => {
  beforeEach(() => {
    clearRecentErrors();
    // Reset to default config
    initErrorTracking({
      environment: "test",
      sampleRate: 1.0,
      ignoreErrors: [],
    });
  });

  afterEach(() => {
    clearRecentErrors();
  });

  describe("initErrorTracking", () => {
    it("initializes with default configuration", () => {
      initErrorTracking();
      const config = getConfig();
      expect(config.environment).toBeDefined();
      expect(config.sampleRate).toBe(1.0);
    });

    it("accepts custom configuration", () => {
      initErrorTracking({
        environment: "staging",
        release: "1.0.0",
        sampleRate: 0.5,
      });
      const config = getConfig();
      expect(config.environment).toBe("staging");
      expect(config.release).toBe("1.0.0");
      expect(config.sampleRate).toBe(0.5);
    });

    it("marks as configured when DSN is provided", () => {
      initErrorTracking({ dsn: "https://test@sentry.io/123" });
      expect(isConfigured()).toBe(true);
    });

    it("marks as not configured without DSN", () => {
      initErrorTracking({ dsn: undefined });
      expect(isConfigured()).toBe(false);
    });
  });

  describe("captureException", () => {
    it("captures and stores an error", () => {
      const error = new Error("Test error");
      const eventId = captureException(error);

      expect(eventId).toBeTruthy();
      expect(eventId).toHaveLength(32);

      const errors = getRecentErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("Test error");
      expect(errors[0].level).toBe(ErrorSeverity.ERROR);
    });

    it("includes error stack in non-production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const error = new Error("Stack test");
      captureException(error);

      const errors = getRecentErrors();
      expect(errors[0].error?.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it("accepts custom severity", () => {
      const error = new Error("Warning error");
      captureException(error, {}, ErrorSeverity.WARNING);

      const errors = getRecentErrors();
      expect(errors[0].level).toBe(ErrorSeverity.WARNING);
    });

    it("includes context in captured error", () => {
      const error = new Error("Context test");
      captureException(error, {
        path: "/api/test",
        method: "POST",
        userId: "user-123",
      });

      const errors = getRecentErrors();
      expect(errors[0].context.path).toBe("/api/test");
      expect(errors[0].context.method).toBe("POST");
      expect(errors[0].context.userId).toBe("user-123");
    });

    it("scrubs sensitive data from context", () => {
      const error = new Error("Sensitive test");
      captureException(error, {
        extra: {
          password: "secret123",
          apiKey: "sk_test_123",
          safeField: "visible",
        },
      } as any);

      const errors = getRecentErrors();
      const extra = (errors[0].context as any).extra;
      expect(extra.password).toBe("[Filtered]");
      expect(extra.apiKey).toBe("[Filtered]");
      expect(extra.safeField).toBe("visible");
    });

    it("respects ignoreErrors configuration", () => {
      initErrorTracking({
        ignoreErrors: ["Ignored error", /Network.*timeout/],
      });

      captureException(new Error("Ignored error"));
      captureException(new Error("Network connection timeout"));
      captureException(new Error("Valid error"));

      const errors = getRecentErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("Valid error");
    });

    it("respects sampling rate", () => {
      initErrorTracking({ sampleRate: 0 });

      const eventId = captureException(new Error("Sampled out"));
      expect(eventId).toBeNull();
      expect(getRecentErrors()).toHaveLength(0);
    });

    it("allows beforeSend to modify events", () => {
      initErrorTracking({
        beforeSend: (event) => {
          event.context.tags = { modified: "true" };
          return event;
        },
      });

      captureException(new Error("Modified event"));

      const errors = getRecentErrors();
      expect(errors[0].context.tags).toEqual({ modified: "true" });
    });

    it("allows beforeSend to drop events", () => {
      initErrorTracking({
        beforeSend: () => null,
      });

      const eventId = captureException(new Error("Dropped event"));
      expect(eventId).toBeNull();
      expect(getRecentErrors()).toHaveLength(0);
    });
  });

  describe("captureMessage", () => {
    it("captures a message with default INFO severity", () => {
      const eventId = captureMessage("Test message");

      expect(eventId).toBeTruthy();

      const errors = getRecentErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("Test message");
      expect(errors[0].level).toBe(ErrorSeverity.INFO);
    });

    it("captures a message with custom severity", () => {
      captureMessage("Warning message", ErrorSeverity.WARNING);

      const errors = getRecentErrors();
      expect(errors[0].level).toBe(ErrorSeverity.WARNING);
    });

    it("includes context in captured message", () => {
      captureMessage("Context message", ErrorSeverity.INFO, {
        tags: { feature: "test" },
      });

      const errors = getRecentErrors();
      expect(errors[0].context.tags).toEqual({ feature: "test" });
    });
  });

  describe("getRecentErrors and clearRecentErrors", () => {
    it("returns empty array initially", () => {
      expect(getRecentErrors()).toEqual([]);
    });

    it("returns captured errors", () => {
      captureException(new Error("Error 1"));
      captureException(new Error("Error 2"));

      const errors = getRecentErrors();
      expect(errors).toHaveLength(2);
    });

    it("returns a copy of errors array", () => {
      captureException(new Error("Test"));
      const errors1 = getRecentErrors();
      const errors2 = getRecentErrors();

      expect(errors1).not.toBe(errors2);
      expect(errors1).toEqual(errors2);
    });

    it("clears all errors", () => {
      captureException(new Error("Error 1"));
      captureException(new Error("Error 2"));

      clearRecentErrors();

      expect(getRecentErrors()).toHaveLength(0);
    });

    it("limits stored errors to MAX_STORED_ERRORS", () => {
      for (let i = 0; i < 150; i++) {
        captureException(new Error(`Error ${i}`));
      }

      const errors = getRecentErrors();
      expect(errors.length).toBeLessThanOrEqual(100);
      // Should have the most recent errors
      expect(errors[errors.length - 1].message).toBe("Error 149");
    });
  });

  describe("user context functions", () => {
    it("setUser does not throw", () => {
      expect(() => setUser({ id: "user-1", email: "test@example.com" })).not.toThrow();
    });

    it("clearUser does not throw", () => {
      expect(() => clearUser()).not.toThrow();
    });
  });

  describe("context functions", () => {
    it("addBreadcrumb does not throw", () => {
      expect(() =>
        addBreadcrumb({
          category: "navigation",
          message: "User navigated to /home",
          level: ErrorSeverity.INFO,
        })
      ).not.toThrow();
    });

    it("setTag does not throw", () => {
      expect(() => setTag("environment", "test")).not.toThrow();
    });

    it("setExtra does not throw", () => {
      expect(() => setExtra("sessionData", { foo: "bar" })).not.toThrow();
    });
  });

  describe("errorTrackingMiddleware", () => {
    it("captures error from middleware chain", () => {
      const error = new Error("Middleware error");
      (error as any).status = 500;

      const req = {
        path: "/api/test",
        method: "POST",
        query: { foo: "bar" },
        headers: {
          "user-agent": "test-agent",
          "content-type": "application/json",
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = vi.fn();

      errorTrackingMiddleware(error, req, res, next);

      expect(next).toHaveBeenCalledWith(error);

      const errors = getRecentErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("Middleware error");
      expect(errors[0].context.path).toBe("/api/test");
      expect(errors[0].context.method).toBe("POST");
    });

    it("sets severity based on status code", () => {
      const clientError = new Error("Client error");
      (clientError as any).status = 400;

      const serverError = new Error("Server error");
      (serverError as any).status = 500;

      const req = {
        path: "/test",
        method: "GET",
        query: {},
        headers: {},
      } as unknown as Request;

      const res = {} as Response;
      const next = vi.fn();

      errorTrackingMiddleware(clientError, req, res, next);
      errorTrackingMiddleware(serverError, req, res, next);

      const errors = getRecentErrors();
      expect(errors[0].level).toBe(ErrorSeverity.WARNING);
      expect(errors[1].level).toBe(ErrorSeverity.ERROR);
    });
  });

  describe("withErrorTracking", () => {
    it("wraps handler and catches errors", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler error"));
      const wrappedHandler = withErrorTracking(handler);

      const req = { path: "/test", method: "GET" } as Request;
      const res = {} as Response;
      const next = vi.fn();

      await wrappedHandler(req, res, next);

      expect(next).toHaveBeenCalled();
      const errors = getRecentErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("Handler error");
    });

    it("does not capture when handler succeeds", async () => {
      const handler = vi.fn().mockResolvedValue("success");
      const wrappedHandler = withErrorTracking(handler);

      const req = { path: "/test", method: "GET" } as Request;
      const res = {} as Response;
      const next = vi.fn();

      await wrappedHandler(req, res, next);

      expect(getRecentErrors()).toHaveLength(0);
    });
  });

  describe("wrapWithErrorTracking", () => {
    it("wraps async function and captures errors", async () => {
      const asyncFn = async () => {
        throw new Error("Async error");
      };

      const wrapped = wrapWithErrorTracking(asyncFn, { extra: { test: true } });

      await expect(wrapped()).rejects.toThrow("Async error");

      const errors = getRecentErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("Async error");
    });

    it("returns result when function succeeds", async () => {
      const asyncFn = async () => "result";
      const wrapped = wrapWithErrorTracking(asyncFn);

      const result = await wrapped();
      expect(result).toBe("result");
      expect(getRecentErrors()).toHaveLength(0);
    });
  });

  describe("startTransaction", () => {
    it("returns transaction with finish and setStatus methods", () => {
      const transaction = startTransaction({
        name: "test-transaction",
        op: "http.request",
      });

      expect(transaction.finish).toBeInstanceOf(Function);
      expect(transaction.setStatus).toBeInstanceOf(Function);
    });

    it("allows setting status and finishing", () => {
      const transaction = startTransaction({
        name: "test",
        op: "test",
      });

      expect(() => {
        transaction.setStatus("error");
        transaction.finish();
      }).not.toThrow();
    });
  });

  describe("getConfig", () => {
    it("returns configuration without exposing DSN", () => {
      initErrorTracking({ dsn: "https://secret@sentry.io/123" });

      const config = getConfig();
      expect(config.dsn).toBe("[CONFIGURED]");
    });

    it("returns undefined DSN when not configured", () => {
      initErrorTracking({});

      const config = getConfig();
      expect(config.dsn).toBeUndefined();
    });
  });
});
