import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  logger,
  createLogger,
  requestIdMiddleware,
  httpLoggerMiddleware,
  getRequestId,
  getCurrentUserId,
  setCurrentUserId,
  LogLevel,
  requestContext,
} from '../logger';

describe('Logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger methods', () => {
    it('logs info messages with structured format', () => {
      logger.info('Test message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.message).toBe('Test message');
      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.source).toBe('app');
    });

    it('logs info messages with metadata', () => {
      logger.info('Test with metadata', { userId: 123, action: 'test' });

      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);

      expect(logEntry.metadata).toEqual({ userId: 123, action: 'test' });
    });

    it('logs warning messages', () => {
      logger.warn('Warning message');

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.warn.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.WARN);
      expect(logEntry.message).toBe('Warning message');
    });

    it('logs error messages with error object', () => {
      const testError = new Error('Test error');
      logger.error('Error occurred', testError);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.error.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.ERROR);
      expect(logEntry.message).toBe('Error occurred');
      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Test error');
    });

    it('logs HTTP requests with method, path, status, and duration', () => {
      logger.http('GET', '/api/test', 200, 50, { userAgent: 'test-agent' });

      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);

      expect(logEntry.method).toBe('GET');
      expect(logEntry.path).toBe('/api/test');
      expect(logEntry.statusCode).toBe(200);
      expect(logEntry.durationMs).toBe(50);
      expect(logEntry.metadata).toEqual({ userAgent: 'test-agent' });
    });

    it('does not log debug messages when LOG_LEVEL is not debug', () => {
      logger.debug('Debug message');

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('logs debug messages when LOG_LEVEL is debug', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'debug';

      logger.debug('Debug message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(logEntry.level).toBe(LogLevel.DEBUG);

      process.env.LOG_LEVEL = originalLogLevel;
    });
  });

  describe('createLogger', () => {
    it('creates a child logger with custom source', () => {
      const customLogger = createLogger('custom-service');
      customLogger.info('Custom message');

      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);

      expect(logEntry.source).toBe('custom-service');
    });
  });

  describe('requestIdMiddleware', () => {
    it('generates a new request ID when none provided', async () => {
      const req = {
        headers: {},
      } as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await new Promise<void>((resolve) => {
        const next: NextFunction = () => {
          const requestId = getRequestId();
          expect(requestId).toBeDefined();
          expect(typeof requestId).toBe('string');
          expect(requestId?.length).toBeGreaterThan(0);
          expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', requestId);
          resolve();
        };

        requestIdMiddleware(req, res, next);
      });
    });

    it('uses existing request ID from headers', async () => {
      const existingRequestId = 'existing-request-id-123';
      const req = {
        headers: {
          'x-request-id': existingRequestId,
        },
      } as unknown as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await new Promise<void>((resolve) => {
        const next: NextFunction = () => {
          const requestId = getRequestId();
          expect(requestId).toBe(existingRequestId);
          expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', existingRequestId);
          resolve();
        };

        requestIdMiddleware(req, res, next);
      });
    });

    it('includes request ID in log entries within request context', async () => {
      const req = {
        headers: {},
      } as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await new Promise<void>((resolve) => {
        const next: NextFunction = () => {
          logger.info('Test within context');
          const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
          expect(logEntry.requestId).toBeDefined();
          expect(typeof logEntry.requestId).toBe('string');
          resolve();
        };

        requestIdMiddleware(req, res, next);
      });
    });
  });

  describe('user ID context', () => {
    it('tracks user ID in request context', async () => {
      await new Promise<void>((resolve) => {
        requestContext.run({ requestId: 'test-123', startTime: Date.now() }, () => {
          setCurrentUserId(456);
          expect(getCurrentUserId()).toBe(456);

          logger.info('Test with user');
          const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
          expect(logEntry.userId).toBe(456);
          resolve();
        });
      });
    });

    it('returns undefined for user ID outside context', () => {
      expect(getCurrentUserId()).toBeUndefined();
    });
  });

  describe('httpLoggerMiddleware', () => {
    it('logs HTTP requests on response finish', async () => {
      await new Promise<void>((resolve) => {
        requestContext.run({ requestId: 'test-http-123', startTime: Date.now() }, () => {
          const req = {
            method: 'POST',
            path: '/api/test-endpoint',
            headers: {
              'user-agent': 'test-agent',
            },
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
          } as unknown as Request;

          const finishCallbacks: (() => void)[] = [];
          const res = {
            on: (event: string, callback: () => void) => {
              if (event === 'finish') {
                finishCallbacks.push(callback);
              }
            },
            get: vi.fn().mockReturnValue('100'),
            statusCode: 201,
          } as unknown as Response;

          const next: NextFunction = () => {
            // Simulate response finish
            finishCallbacks.forEach((cb) => cb());

            expect(consoleSpy.log).toHaveBeenCalled();
            const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
            expect(logEntry.method).toBe('POST');
            expect(logEntry.path).toBe('/api/test-endpoint');
            expect(logEntry.statusCode).toBe(201);
            expect(logEntry.requestId).toBe('test-http-123');
            resolve();
          };

          httpLoggerMiddleware(req, res, next);
        });
      });
    });

    it('does not log non-API requests', async () => {
      await new Promise<void>((resolve) => {
        requestContext.run({ requestId: 'test-static-123', startTime: Date.now() }, () => {
          const req = {
            method: 'GET',
            path: '/static/app.js',
            headers: {},
            socket: { remoteAddress: '127.0.0.1' },
          } as unknown as Request;

          const finishCallbacks: (() => void)[] = [];
          const res = {
            on: (event: string, callback: () => void) => {
              if (event === 'finish') {
                finishCallbacks.push(callback);
              }
            },
            get: vi.fn(),
            statusCode: 200,
          } as unknown as Response;

          const next: NextFunction = () => {
            // Simulate response finish
            finishCallbacks.forEach((cb) => cb());

            expect(consoleSpy.log).not.toHaveBeenCalled();
            resolve();
          };

          httpLoggerMiddleware(req, res, next);
        });
      });
    });
  });

  describe('getRequestId', () => {
    it('returns undefined outside request context', () => {
      expect(getRequestId()).toBeUndefined();
    });

    it('returns request ID within context', async () => {
      await new Promise<void>((resolve) => {
        requestContext.run({ requestId: 'context-test-id', startTime: Date.now() }, () => {
          expect(getRequestId()).toBe('context-test-id');
          resolve();
        });
      });
    });
  });
});
