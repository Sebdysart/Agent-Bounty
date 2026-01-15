import { Request, Response, NextFunction } from "express";

interface RequestMetrics {
  count: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  buckets: Map<number, number>; // histogram buckets
  errorCount: number; // 4xx and 5xx responses
  statusCodes: Map<number, number>; // count per status code
}

interface EndpointKey {
  method: string;
  path: string;
}

// Histogram bucket boundaries in milliseconds
const HISTOGRAM_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

// Store metrics per endpoint
const endpointMetrics = new Map<string, RequestMetrics>();

function getEndpointKey(method: string, path: string): string {
  // Normalize path by replacing dynamic segments with placeholders
  const normalizedPath = path
    .replace(/\/\d+/g, "/:id")
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:uuid");
  return `${method}:${normalizedPath}`;
}

function initMetrics(): RequestMetrics {
  const buckets = new Map<number, number>();
  for (const bucket of HISTOGRAM_BUCKETS) {
    buckets.set(bucket, 0);
  }
  buckets.set(Infinity, 0); // +Inf bucket
  return {
    count: 0,
    totalDurationMs: 0,
    minDurationMs: Infinity,
    maxDurationMs: 0,
    buckets,
    errorCount: 0,
    statusCodes: new Map<number, number>(),
  };
}

function recordDuration(key: string, durationMs: number): void {
  let metrics = endpointMetrics.get(key);
  if (!metrics) {
    metrics = initMetrics();
    endpointMetrics.set(key, metrics);
  }

  metrics.count++;
  metrics.totalDurationMs += durationMs;
  metrics.minDurationMs = Math.min(metrics.minDurationMs, durationMs);
  metrics.maxDurationMs = Math.max(metrics.maxDurationMs, durationMs);

  // Update histogram buckets
  for (const bucket of HISTOGRAM_BUCKETS) {
    if (durationMs <= bucket) {
      metrics.buckets.set(bucket, (metrics.buckets.get(bucket) || 0) + 1);
    }
  }
  // Always increment +Inf bucket
  metrics.buckets.set(Infinity, (metrics.buckets.get(Infinity) || 0) + 1);
}

function recordStatusCode(key: string, statusCode: number): void {
  let metrics = endpointMetrics.get(key);
  if (!metrics) {
    metrics = initMetrics();
    endpointMetrics.set(key, metrics);
  }

  // Track status code count
  metrics.statusCodes.set(statusCode, (metrics.statusCodes.get(statusCode) || 0) + 1);

  // Track error count (4xx and 5xx)
  if (statusCode >= 400) {
    metrics.errorCount++;
  }
}

/**
 * Middleware to track request duration metrics
 */
export function requestDurationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  res.on("finish", () => {
    // Only track API endpoints
    if (!req.path.startsWith("/api")) {
      return;
    }

    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - startTime);
    const durationMs = durationNs / 1_000_000;

    const key = getEndpointKey(req.method, req.path);
    recordDuration(key, durationMs);
    recordStatusCode(key, res.statusCode);
  });

  next();
}

/**
 * Get all tracked metrics in Prometheus format
 */
export function getRequestDurationMetrics(): string {
  const lines: string[] = [];

  // Request count
  lines.push("# HELP agentbounty_http_requests_total Total number of HTTP requests");
  lines.push("# TYPE agentbounty_http_requests_total counter");
  for (const [key, metrics] of endpointMetrics) {
    const [method, path] = key.split(":");
    lines.push(`agentbounty_http_requests_total{method="${method}",path="${path}"} ${metrics.count}`);
  }

  // Request duration histogram
  lines.push("");
  lines.push("# HELP agentbounty_http_request_duration_ms HTTP request duration in milliseconds");
  lines.push("# TYPE agentbounty_http_request_duration_ms histogram");
  for (const [key, metrics] of endpointMetrics) {
    const [method, path] = key.split(":");

    // Output bucket values (cumulative)
    for (const bucket of HISTOGRAM_BUCKETS) {
      const cumulativeCount = Array.from(metrics.buckets.entries())
        .filter(([b]) => b <= bucket)
        .reduce((sum, [, count]) => sum + count, 0);
      lines.push(`agentbounty_http_request_duration_ms_bucket{method="${method}",path="${path}",le="${bucket}"} ${cumulativeCount}`);
    }
    lines.push(`agentbounty_http_request_duration_ms_bucket{method="${method}",path="${path}",le="+Inf"} ${metrics.count}`);

    // Sum and count
    lines.push(`agentbounty_http_request_duration_ms_sum{method="${method}",path="${path}"} ${metrics.totalDurationMs.toFixed(3)}`);
    lines.push(`agentbounty_http_request_duration_ms_count{method="${method}",path="${path}"} ${metrics.count}`);
  }

  // Min/max gauges for convenience
  lines.push("");
  lines.push("# HELP agentbounty_http_request_duration_min_ms Minimum HTTP request duration");
  lines.push("# TYPE agentbounty_http_request_duration_min_ms gauge");
  for (const [key, metrics] of endpointMetrics) {
    const [method, path] = key.split(":");
    if (metrics.minDurationMs !== Infinity) {
      lines.push(`agentbounty_http_request_duration_min_ms{method="${method}",path="${path}"} ${metrics.minDurationMs.toFixed(3)}`);
    }
  }

  lines.push("");
  lines.push("# HELP agentbounty_http_request_duration_max_ms Maximum HTTP request duration");
  lines.push("# TYPE agentbounty_http_request_duration_max_ms gauge");
  for (const [key, metrics] of endpointMetrics) {
    const [method, path] = key.split(":");
    lines.push(`agentbounty_http_request_duration_max_ms{method="${method}",path="${path}"} ${metrics.maxDurationMs.toFixed(3)}`);
  }

  // Average duration
  lines.push("");
  lines.push("# HELP agentbounty_http_request_duration_avg_ms Average HTTP request duration");
  lines.push("# TYPE agentbounty_http_request_duration_avg_ms gauge");
  for (const [key, metrics] of endpointMetrics) {
    const [method, path] = key.split(":");
    const avg = metrics.count > 0 ? metrics.totalDurationMs / metrics.count : 0;
    lines.push(`agentbounty_http_request_duration_avg_ms{method="${method}",path="${path}"} ${avg.toFixed(3)}`);
  }

  // Error count per endpoint
  lines.push("");
  lines.push("# HELP agentbounty_http_errors_total Total number of HTTP errors (4xx and 5xx)");
  lines.push("# TYPE agentbounty_http_errors_total counter");
  for (const [key, metrics] of endpointMetrics) {
    const [method, path] = key.split(":");
    lines.push(`agentbounty_http_errors_total{method="${method}",path="${path}"} ${metrics.errorCount}`);
  }

  // Error rate per endpoint (percentage)
  lines.push("");
  lines.push("# HELP agentbounty_http_error_rate Error rate as percentage (0-100)");
  lines.push("# TYPE agentbounty_http_error_rate gauge");
  for (const [key, metrics] of endpointMetrics) {
    const [method, path] = key.split(":");
    const errorRate = metrics.count > 0 ? (metrics.errorCount / metrics.count) * 100 : 0;
    lines.push(`agentbounty_http_error_rate{method="${method}",path="${path}"} ${errorRate.toFixed(2)}`);
  }

  // HTTP status code breakdown
  lines.push("");
  lines.push("# HELP agentbounty_http_responses_total Total HTTP responses by status code");
  lines.push("# TYPE agentbounty_http_responses_total counter");
  for (const [key, metrics] of endpointMetrics) {
    const [method, path] = key.split(":");
    for (const [statusCode, count] of metrics.statusCodes) {
      lines.push(`agentbounty_http_responses_total{method="${method}",path="${path}",status="${statusCode}"} ${count}`);
    }
  }

  return lines.join("\n");
}

/**
 * Get raw metrics data for programmatic access
 */
export function getRawMetrics(): Map<string, RequestMetrics> {
  return new Map(endpointMetrics);
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  endpointMetrics.clear();
}

/**
 * Get metrics summary for a specific endpoint
 */
export function getEndpointMetrics(method: string, path: string): RequestMetrics | undefined {
  const key = getEndpointKey(method, path);
  return endpointMetrics.get(key);
}

/**
 * Get error rate for a specific endpoint (percentage 0-100)
 */
export function getEndpointErrorRate(method: string, path: string): number {
  const metrics = getEndpointMetrics(method, path);
  if (!metrics || metrics.count === 0) {
    return 0;
  }
  return (metrics.errorCount / metrics.count) * 100;
}

/**
 * Get all endpoints with their error rates
 */
export function getAllErrorRates(): Array<{ method: string; path: string; errorRate: number; errorCount: number; totalCount: number }> {
  const results: Array<{ method: string; path: string; errorRate: number; errorCount: number; totalCount: number }> = [];
  for (const [key, metrics] of endpointMetrics) {
    const [method, path] = key.split(":");
    const errorRate = metrics.count > 0 ? (metrics.errorCount / metrics.count) * 100 : 0;
    results.push({
      method,
      path,
      errorRate,
      errorCount: metrics.errorCount,
      totalCount: metrics.count,
    });
  }
  return results.sort((a, b) => b.errorRate - a.errorRate);
}
