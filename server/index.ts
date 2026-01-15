import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { wsService } from './websocket';
import { sanitizeAllInput } from './sanitizationMiddleware';
import { securityHeaders } from './securityHeaders';
import { AppError, ErrorCode, sendError } from './errorResponse';
import { logger, requestIdMiddleware, httpLoggerMiddleware, createLogger } from './logger';
import { initErrorTracking, errorTrackingMiddleware } from './errorTracking';
import { sanitizeErrorMessage } from './errorSanitizer';
import { requestDurationMiddleware } from './requestDurationMiddleware';

const app = express();

// Apply security headers to all requests (before other middleware)
app.use(securityHeaders);

// Apply request ID middleware early for request tracking
app.use(requestIdMiddleware);

// Apply HTTP logging middleware
app.use(httpLoggerMiddleware);

// Apply request duration tracking middleware
app.use(requestDurationMiddleware);

// Initialize error tracking (Sentry-ready)
initErrorTracking({
  environment: process.env.NODE_ENV || 'development',
  release: process.env.APP_VERSION,
});

const httpServer = createServer(app);
const stripeLogger = createLogger('stripe');

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    stripeLogger.info('DATABASE_URL not set, skipping Stripe initialization');
    return;
  }

  try {
    stripeLogger.info('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    stripeLogger.info('Stripe schema ready');

    const stripeSync = await getStripeSync();

    const replitDomains = process.env.REPLIT_DOMAINS;
    if (replitDomains) {
      stripeLogger.info('Setting up managed webhook...');
      const webhookBaseUrl = `https://${replitDomains.split(',')[0]}`;
      try {
        const result = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
        if (result?.webhook?.url) {
          stripeLogger.info('Webhook configured', { url: result.webhook.url });
        } else {
          stripeLogger.info('Webhook configured successfully');
        }
      } catch (webhookError) {
        stripeLogger.info('Webhook setup skipped (may already exist or not needed in dev)');
      }
    } else {
      stripeLogger.info('REPLIT_DOMAINS not set, skipping webhook setup');
    }

    stripeSync.syncBackfill()
      .then(() => stripeLogger.info('Stripe data synced'))
      .catch((err: Error) => stripeLogger.error('Error syncing Stripe data', err));
  } catch (error) {
    stripeLogger.error('Failed to initialize Stripe', error instanceof Error ? error : new Error(String(error)));
  }
}

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return sendError(res, 400, ErrorCode.WEBHOOK_ERROR, "Missing stripe-signature");
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        return sendError(res, 500, ErrorCode.WEBHOOK_ERROR, "Webhook processing error");
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      stripeLogger.error('Webhook error', error instanceof Error ? error : new Error(error.message));
      sendError(res, 400, ErrorCode.WEBHOOK_ERROR, "Webhook processing error");
    }
  }
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Apply input sanitization globally to all requests
// This sanitizes body, query params, and route params to prevent XSS
app.use(sanitizeAllInput);

// Legacy log function - use logger from './logger' for structured logging
export function log(message: string, source = "express") {
  logger.info(message, { legacySource: source });
}

(async () => {
  await initStripe();
  wsService.initialize(httpServer);
  await registerRoutes(httpServer, app);

  // Error tracking middleware (captures errors before they're handled)
  app.use(errorTrackingMiddleware);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Sanitize error message to prevent sensitive data leakage
    const rawMessage = err.message || "Internal Server Error";
    const message = sanitizeErrorMessage(rawMessage);
    const code = err.code || (err instanceof AppError ? err.code : ErrorCode.INTERNAL_ERROR);
    const details = err.details;
    const retryAfter = err.retryAfter;

    sendError(res, status, code, message, details, retryAfter);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      logger.info('Server started', { port, host: '0.0.0.0' });
    },
  );
})();
