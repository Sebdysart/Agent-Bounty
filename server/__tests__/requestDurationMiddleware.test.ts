import { describe, it, expect, beforeEach } from "vitest";
import { Request, Response } from "express";
import {
  requestDurationMiddleware,
  getRequestDurationMetrics,
  getRawMetrics,
  resetMetrics,
  getEndpointMetrics,
  getEndpointErrorRate,
  getAllErrorRates,
} from "../requestDurationMiddleware";

function createMockRequest(method: string, path: string): Partial<Request> {
  return {
    method,
    path,
  };
}

function createMockResponse(statusCode: number = 200): Partial<Response> & { listeners: Map<string, Function[]>; statusCode: number } {
  const listeners = new Map<string, Function[]>();
  return {
    listeners,
    statusCode,
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

describe("error rate tracking", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("should track successful responses (2xx)", () => {
    const req = createMockRequest("GET", "/api/success");
    const res = createMockResponse(200);
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    const metrics = getEndpointMetrics("GET", "/api/success");
    expect(metrics).toBeDefined();
    expect(metrics!.errorCount).toBe(0);
    expect(metrics!.statusCodes.get(200)).toBe(1);
  });

  it("should track client errors (4xx)", () => {
    const req = createMockRequest("GET", "/api/client-error");
    const res = createMockResponse(404);
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    const metrics = getEndpointMetrics("GET", "/api/client-error");
    expect(metrics).toBeDefined();
    expect(metrics!.errorCount).toBe(1);
    expect(metrics!.statusCodes.get(404)).toBe(1);
  });

  it("should track server errors (5xx)", () => {
    const req = createMockRequest("POST", "/api/server-error");
    const res = createMockResponse(500);
    const next = () => {};

    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    const metrics = getEndpointMetrics("POST", "/api/server-error");
    expect(metrics).toBeDefined();
    expect(metrics!.errorCount).toBe(1);
    expect(metrics!.statusCodes.get(500)).toBe(1);
  });

  it("should calculate correct error rate", () => {
    const next = () => {};

    // 2 successful requests
    for (let i = 0; i < 2; i++) {
      const req = createMockRequest("GET", "/api/mixed");
      const res = createMockResponse(200);
      requestDurationMiddleware(req as Request, res as unknown as Response, next);
      res.emit("finish");
    }

    // 2 error requests
    for (let i = 0; i < 2; i++) {
      const req = createMockRequest("GET", "/api/mixed");
      const res = createMockResponse(500);
      requestDurationMiddleware(req as Request, res as unknown as Response, next);
      res.emit("finish");
    }

    const errorRate = getEndpointErrorRate("GET", "/api/mixed");
    expect(errorRate).toBe(50); // 2 errors out of 4 requests = 50%
  });

  it("should return 0 error rate for unknown endpoint", () => {
    const errorRate = getEndpointErrorRate("GET", "/api/unknown");
    expect(errorRate).toBe(0);
  });

  it("should track multiple status codes per endpoint", () => {
    const next = () => {};

    const statusCodes = [200, 201, 400, 401, 500];
    for (const statusCode of statusCodes) {
      const req = createMockRequest("GET", "/api/status-mix");
      const res = createMockResponse(statusCode);
      requestDurationMiddleware(req as Request, res as unknown as Response, next);
      res.emit("finish");
    }

    const metrics = getEndpointMetrics("GET", "/api/status-mix");
    expect(metrics).toBeDefined();
    expect(metrics!.count).toBe(5);
    expect(metrics!.errorCount).toBe(3); // 400, 401, 500
    expect(metrics!.statusCodes.size).toBe(5);
  });
});

describe("getEndpointErrorRate", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("should calculate percentage error rate", () => {
    const next = () => {};

    // 8 successful, 2 errors = 20% error rate
    for (let i = 0; i < 8; i++) {
      const req = createMockRequest("GET", "/api/rate-test");
      const res = createMockResponse(200);
      requestDurationMiddleware(req as Request, res as unknown as Response, next);
      res.emit("finish");
    }
    for (let i = 0; i < 2; i++) {
      const req = createMockRequest("GET", "/api/rate-test");
      const res = createMockResponse(500);
      requestDurationMiddleware(req as Request, res as unknown as Response, next);
      res.emit("finish");
    }

    expect(getEndpointErrorRate("GET", "/api/rate-test")).toBe(20);
  });
});

describe("getAllErrorRates", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("should return all endpoints sorted by error rate", () => {
    const next = () => {};

    // Endpoint A: 0% error rate
    const reqA = createMockRequest("GET", "/api/endpoint-a");
    const resA = createMockResponse(200);
    requestDurationMiddleware(reqA as Request, resA as unknown as Response, next);
    resA.emit("finish");

    // Endpoint B: 100% error rate
    const reqB = createMockRequest("GET", "/api/endpoint-b");
    const resB = createMockResponse(500);
    requestDurationMiddleware(reqB as Request, resB as unknown as Response, next);
    resB.emit("finish");

    // Endpoint C: 50% error rate
    for (let i = 0; i < 2; i++) {
      const req = createMockRequest("GET", "/api/endpoint-c");
      const res = createMockResponse(i === 0 ? 200 : 500);
      requestDurationMiddleware(req as Request, res as unknown as Response, next);
      res.emit("finish");
    }

    const errorRates = getAllErrorRates();
    expect(errorRates).toHaveLength(3);
    // Should be sorted by error rate descending
    expect(errorRates[0].path).toBe("/api/endpoint-b");
    expect(errorRates[0].errorRate).toBe(100);
    expect(errorRates[1].path).toBe("/api/endpoint-c");
    expect(errorRates[1].errorRate).toBe(50);
    expect(errorRates[2].path).toBe("/api/endpoint-a");
    expect(errorRates[2].errorRate).toBe(0);
  });

  it("should include error count and total count", () => {
    const next = () => {};

    const req = createMockRequest("POST", "/api/with-errors");
    const res = createMockResponse(400);
    requestDurationMiddleware(req as Request, res as unknown as Response, next);
    res.emit("finish");

    const errorRates = getAllErrorRates();
    expect(errorRates[0]).toEqual({
      method: "POST",
      path: "/api/with-errors",
      errorRate: 100,
      errorCount: 1,
      totalCount: 1,
    });
  });
});

describe("Prometheus error metrics output", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("should include error metrics in Prometheus format", () => {
    const next = () => {};

    // Create some requests with mixed status codes
    const req1 = createMockRequest("GET", "/api/prometheus-test");
    const res1 = createMockResponse(200);
    requestDurationMiddleware(req1 as Request, res1 as unknown as Response, next);
    res1.emit("finish");

    const req2 = createMockRequest("GET", "/api/prometheus-test");
    const res2 = createMockResponse(500);
    requestDurationMiddleware(req2 as Request, res2 as unknown as Response, next);
    res2.emit("finish");

    const metricsOutput = getRequestDurationMetrics();

    // Check for error count metric
    expect(metricsOutput).toContain("# HELP agentbounty_http_errors_total");
    expect(metricsOutput).toContain("# TYPE agentbounty_http_errors_total counter");
    expect(metricsOutput).toContain('agentbounty_http_errors_total{method="GET",path="/api/prometheus-test"} 1');

    // Check for error rate metric
    expect(metricsOutput).toContain("# HELP agentbounty_http_error_rate");
    expect(metricsOutput).toContain("# TYPE agentbounty_http_error_rate gauge");
    expect(metricsOutput).toContain('agentbounty_http_error_rate{method="GET",path="/api/prometheus-test"} 50.00');

    // Check for status code breakdown
    expect(metricsOutput).toContain("# HELP agentbounty_http_responses_total");
    expect(metricsOutput).toContain("# TYPE agentbounty_http_responses_total counter");
    expect(metricsOutput).toContain('agentbounty_http_responses_total{method="GET",path="/api/prometheus-test",status="200"} 1');
    expect(metricsOutput).toContain('agentbounty_http_responses_total{method="GET",path="/api/prometheus-test",status="500"} 1');
  });
});
