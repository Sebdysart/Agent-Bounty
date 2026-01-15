import { describe, it, expect, beforeEach } from "vitest";
import { Request, Response } from "express";
import {
  requestDurationMiddleware,
  getRequestDurationMetrics,
  getRawMetrics,
  resetMetrics,
  getEndpointMetrics,
} from "../requestDurationMiddleware";

function createMockRequest(method: string, path: string): Partial<Request> {
  return {
    method,
    path,
  };
}

function createMockResponse(): Partial<Response> & { listeners: Map<string, Function[]> } {
  const listeners = new Map<string, Function[]>();
  return {
    listeners,
    on: function (event: string, callback: Function) {
      const existing = listeners.get(event) || [];
      existing.push(callback);
      listeners.set(event, existing);
      return this as any;
    },
    emit: function (event: string) {
      const callbacks = listeners.get(event) || [];
      callbacks.forEach((cb) => cb());
    },
  };
}

describe("requestDurationMiddleware", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("should track request duration for API endpoints", async () => {
    const req = createMockRequest("GET", "/api/health");
    const res = createMockResponse();
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Trigger finish event
    res.emit("finish");

    const metrics = getEndpointMetrics("GET", "/api/health");
    expect(metrics).toBeDefined();
    expect(metrics!.count).toBe(1);
    expect(metrics!.totalDurationMs).toBeGreaterThan(0);
  });

  it("should not track non-API endpoints", () => {
    const req = createMockRequest("GET", "/static/file.js");
    const res = createMockResponse();
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    const metrics = getEndpointMetrics("GET", "/static/file.js");
    expect(metrics).toBeUndefined();
  });

  it("should normalize paths with numeric IDs", () => {
    const req1 = createMockRequest("GET", "/api/bounties/123");
    const req2 = createMockRequest("GET", "/api/bounties/456");
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    const next = () => {};

    requestDurationMiddleware(req1 as Request, res1 as unknown as Response, next);
    res1.emit("finish");

    requestDurationMiddleware(req2 as Request, res2 as unknown as Response, next);
    res2.emit("finish");

    // Both should be grouped under the same normalized path
    const metrics = getEndpointMetrics("GET", "/api/bounties/:id");
    expect(metrics).toBeDefined();
    expect(metrics!.count).toBe(2);
  });

  it("should normalize paths with UUIDs", () => {
    const req = createMockRequest("GET", "/api/agents/550e8400-e29b-41d4-a716-446655440000");
    const res = createMockResponse();
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    const metrics = getEndpointMetrics("GET", "/api/agents/:uuid");
    expect(metrics).toBeDefined();
    expect(metrics!.count).toBe(1);
  });

  it("should track min and max durations", async () => {
    const next = () => {};

    // First request - short
    const req1 = createMockRequest("GET", "/api/test");
    const res1 = createMockResponse();
    requestDurationMiddleware(req1 as Request, res1 as unknown as Response, next);
    await new Promise((resolve) => setTimeout(resolve, 5));
    res1.emit("finish");

    // Second request - longer
    const req2 = createMockRequest("GET", "/api/test");
    const res2 = createMockResponse();
    requestDurationMiddleware(req2 as Request, res2 as unknown as Response, next);
    await new Promise((resolve) => setTimeout(resolve, 20));
    res2.emit("finish");

    const metrics = getEndpointMetrics("GET", "/api/test");
    expect(metrics).toBeDefined();
    expect(metrics!.count).toBe(2);
    expect(metrics!.minDurationMs).toBeLessThan(metrics!.maxDurationMs);
  });

  it("should populate histogram buckets", () => {
    const req = createMockRequest("GET", "/api/buckets");
    const res = createMockResponse();
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    const metrics = getEndpointMetrics("GET", "/api/buckets");
    expect(metrics).toBeDefined();
    expect(metrics!.buckets.size).toBeGreaterThan(0);
    // +Inf bucket should always have at least the request count
    expect(metrics!.buckets.get(Infinity)).toBe(1);
  });

  it("should call next() to continue middleware chain", () => {
    const req = createMockRequest("GET", "/api/test");
    const res = createMockResponse();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    expect(nextCalled).toBe(true);
  });
});

describe("getRequestDurationMetrics", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("should return empty string when no metrics", () => {
    const metrics = getRequestDurationMetrics();
    // Should have headers but no data lines with actual metrics
    expect(metrics).toContain("# HELP agentbounty_http_requests_total");
    expect(metrics).toContain("# TYPE agentbounty_http_requests_total counter");
  });

  it("should return Prometheus-formatted metrics", () => {
    const req = createMockRequest("POST", "/api/bounties");
    const res = createMockResponse();
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    const metricsOutput = getRequestDurationMetrics();

    // Check for expected Prometheus format elements
    expect(metricsOutput).toContain("agentbounty_http_requests_total");
    expect(metricsOutput).toContain('method="POST"');
    expect(metricsOutput).toContain('path="/api/bounties"');
    expect(metricsOutput).toContain("agentbounty_http_request_duration_ms_bucket");
    expect(metricsOutput).toContain("agentbounty_http_request_duration_ms_sum");
    expect(metricsOutput).toContain("agentbounty_http_request_duration_ms_count");
  });

  it("should include histogram buckets with le labels", () => {
    const req = createMockRequest("GET", "/api/agents");
    const res = createMockResponse();
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    const metricsOutput = getRequestDurationMetrics();

    // Check for histogram bucket labels
    expect(metricsOutput).toContain('le="5"');
    expect(metricsOutput).toContain('le="10"');
    expect(metricsOutput).toContain('le="100"');
    expect(metricsOutput).toContain('le="1000"');
    expect(metricsOutput).toContain('le="+Inf"');
  });
});

describe("getRawMetrics", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("should return a copy of metrics map", () => {
    const req = createMockRequest("GET", "/api/data");
    const res = createMockResponse();
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    const rawMetrics = getRawMetrics();
    expect(rawMetrics).toBeInstanceOf(Map);
    expect(rawMetrics.size).toBe(1);
  });
});

describe("resetMetrics", () => {
  it("should clear all metrics", () => {
    const req = createMockRequest("GET", "/api/reset-test");
    const res = createMockResponse();
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    expect(getRawMetrics().size).toBe(1);

    resetMetrics();

    expect(getRawMetrics().size).toBe(0);
  });
});
