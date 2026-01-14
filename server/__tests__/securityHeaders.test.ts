import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { securityHeaders } from '../securityHeaders';

describe('securityHeaders middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let headers: Record<string, string>;

  beforeEach(() => {
    headers = {};
    mockReq = {
      path: '/api/test'
    };
    mockRes = {
      setHeader: vi.fn((name: string, value: string) => {
        headers[name] = value;
        return mockRes as Response;
      }),
      removeHeader: vi.fn()
    };
    nextFn = vi.fn();
  });

  it('sets X-Content-Type-Options header', () => {
    securityHeaders(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('sets X-XSS-Protection header', () => {
    securityHeaders(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
  });

  it('sets X-Frame-Options header to DENY', () => {
    securityHeaders(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  it('sets Referrer-Policy header', () => {
    securityHeaders(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  it('sets Content-Security-Policy header', () => {
    securityHeaders(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("default-src 'self'")
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("frame-ancestors 'none'")
    );
  });

  it('sets Permissions-Policy header', () => {
    securityHeaders(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
  });

  it('sets cache control headers for API routes', () => {
    mockReq.path = '/api/users';
    securityHeaders(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Expires', '0');
  });

  it('does not set cache headers for non-API routes', () => {
    mockReq.path = '/static/app.js';
    securityHeaders(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.setHeader).not.toHaveBeenCalledWith(
      'Cache-Control',
      expect.any(String)
    );
  });

  it('removes X-Powered-By header', () => {
    securityHeaders(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
  });

  it('calls next() to continue middleware chain', () => {
    securityHeaders(mockReq as Request, mockRes as Response, nextFn);
    expect(nextFn).toHaveBeenCalled();
  });

  describe('production mode', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('sets Strict-Transport-Security in production', () => {
      securityHeaders(mockReq as Request, mockRes as Response, nextFn);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    });
  });

  describe('development mode', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('does not set HSTS in development', () => {
      securityHeaders(mockReq as Request, mockRes as Response, nextFn);
      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });
  });
});
