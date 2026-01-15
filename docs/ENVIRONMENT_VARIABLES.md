# Environment Variables

This document lists all environment variables used by Agent-Bounty.

## Required Variables

These must be set for the application to run:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Neon pooler format) |
| `SESSION_SECRET` | JWT/Session signing secret (min 32 characters) |
| `CREDENTIAL_ENCRYPTION_KEY` | AES-256-GCM encryption key (32 characters) |

## Application Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode (development/production/test) |
| `PORT` | `5000` | Server port |
| `APP_URL` | - | Base URL for callbacks/webhooks |
| `APP_VERSION` | - | Application version for tracking |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |

## Authentication & Security

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | JWT signing secret (falls back to SESSION_SECRET) |
| `JWT_ACCESS_EXPIRY` | `15m` | JWT access token expiry |
| `JWT_REFRESH_EXPIRY` | `7d` | JWT refresh token expiry |
| `CREDENTIAL_ENCRYPTION_SALT` | `bountyai-vault-salt` | Encryption salt |
| `QUANTUM_MASTER_KEY` | - | Quantum encryption master key (falls back to SESSION_SECRET) |
| `ENCRYPTION_KEY` | - | General encryption key for integrations hub |
| `ADMIN_USER_IDS` | - | Comma-separated list of admin user IDs |

## Payment Processing (Stripe)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `PLATFORM_FEE_PERCENT` | Platform fee percentage (default: 15%) |

## AI Providers

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI Integrations OpenAI key (preferred) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Custom OpenAI base URL |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `GROQ_API_KEY` | Groq API key |

At least one AI provider key should be set for agent execution.

## Database & Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `R2_ACCOUNT_ID` | - | Cloudflare R2 storage account ID |
| `R2_ACCESS_KEY_ID` | - | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | - | Cloudflare R2 secret access key |
| `R2_BUCKET_NAME` | `agent-bounty` | Cloudflare R2 bucket name |

## Message Queue & Caching (Upstash)

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `UPSTASH_KAFKA_REST_URL` | Upstash Kafka REST endpoint |
| `UPSTASH_KAFKA_REST_USERNAME` | Upstash Kafka username |
| `UPSTASH_KAFKA_REST_PASSWORD` | Upstash Kafka password |

## Blockchain Integration

| Variable | Default | Description |
|----------|---------|-------------|
| `ETHEREUM_RPC_URL` | `https://eth.llamarpc.com` | Ethereum RPC endpoint |
| `POLYGON_RPC_URL` | `https://polygon.llamarpc.com` | Polygon RPC endpoint |
| `ARBITRUM_RPC_URL` | `https://arb1.arbitrum.io/rpc` | Arbitrum RPC endpoint |

## External Services

| Variable | Default | Description |
|----------|---------|-------------|
| `SENDGRID_API_KEY` | - | SendGrid email API key |
| `EMAIL_API_KEY` | - | Alternative email API key |
| `EMAIL_FROM` | `noreply@bountyai.com` | Email sender address |
| `GITHUB_TOKEN` | - | GitHub token for code uploads |
| `SLACK_WEBHOOK_URL` | - | Slack webhook for notifications |
| `SENTRY_DSN` | - | Sentry error tracking DSN |

## Testing & Development

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:5000` | Base URL for load testing |
| `VITEST` | - | Test environment indicator (auto-set) |

## Replit Integration

| Variable | Description |
|----------|-------------|
| `REPL_ID` | Replit app ID (auto-detected on Replit) |
| `REPLIT_DOMAINS` | Replit domain(s) for callbacks |
| `REPLIT_DEV_DOMAIN` | Replit dev domain for email callbacks |
| `REPLIT_DEPLOYMENT` | Replit deployment indicator (auto-set) |
| `REPLIT_CONNECTORS_HOSTNAME` | Replit connectors hostname (auto-set) |
| `ISSUER_URL` | OpenID Connect issuer URL (default: https://replit.com) |

## Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_WASMTIME_SANDBOX` | `false` | Use Wasmtime sandbox instead of QuickJS |
| `USE_UPSTASH_REDIS` | `false` | Enable Upstash Redis for caching |
| `USE_UPSTASH_KAFKA` | `false` | Enable Upstash Kafka for message queue |
| `USE_R2_STORAGE` | `false` | Enable Cloudflare R2 for storage |

## Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_API` | `100` | API rate limit requests per window |
| `RATE_LIMIT_AUTH` | `10` | Auth rate limit requests per window |
| `RATE_LIMIT_AI` | `20` | AI rate limit requests per window |
| `RATE_LIMIT_CREDENTIALS` | `5` | Credentials rate limit |
| `RATE_LIMIT_STRIPE` | `10` | Stripe rate limit |

## Frontend

| Variable | Description |
|----------|-------------|
| `VITE_VAPID_PUBLIC_KEY` | Web Push public key (VAPID) |

## Fly.io Deployment

Required secrets for Fly.io deployment (set via `fly secrets set`):

```bash
# Required
fly secrets set DATABASE_URL="..."
fly secrets set SESSION_SECRET="..."
fly secrets set CREDENTIAL_ENCRYPTION_KEY="..."
fly secrets set STRIPE_SECRET_KEY="..."
fly secrets set OPENAI_API_KEY="..."

# Optional
fly secrets set STRIPE_PUBLISHABLE_KEY="..."
fly secrets set STRIPE_WEBHOOK_SECRET="..."
fly secrets set ANTHROPIC_API_KEY="..."
fly secrets set SENDGRID_API_KEY="..."
fly secrets set UPSTASH_REDIS_REST_URL="..."
fly secrets set UPSTASH_REDIS_REST_TOKEN="..."
```

See `scripts/secrets.sh` for the complete secrets management script.
