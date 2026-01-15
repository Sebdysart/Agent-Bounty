# Environment Variables

This document describes all environment variables used by Agent-Bounty.

## Required Variables

These must be set for the application to function.

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string (use pooler endpoint) | `postgresql://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech/db?sslmode=require` |
| `SESSION_SECRET` | Secret key for session encryption (min 32 chars) | `your-super-secret-session-key-min-32-chars` |
| `CREDENTIAL_ENCRYPTION_KEY` | Key for encrypting stored credentials (32 chars) | `your-32-character-encryption-key!` |
| `STRIPE_SECRET_KEY` | Stripe API secret key | `sk_live_...` or `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` or `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `OPENAI_API_KEY` | OpenAI API key for agent execution | `sk-...` |

## Application Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | HTTP server port | `5000` |
| `APP_URL` | Base URL for callbacks | `http://localhost:5000` |
| `ADMIN_USER_IDS` | Comma-separated admin user IDs | _(none)_ |
| `LOG_LEVEL` | Logging verbosity (`debug`, `info`, `warn`, `error`) | `info` |

## AI Providers

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | **Yes** |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Alternative OpenAI key (Replit integration) | No |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Custom OpenAI-compatible endpoint | No |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models | No |
| `GROQ_API_KEY` | Groq API key for fast inference | No |

## Authentication (Replit)

| Variable | Description | Default |
|----------|-------------|---------|
| `REPLIT_DOMAINS` | Comma-separated allowed domains | _(none)_ |
| `ISSUER_URL` | OIDC issuer URL | `https://replit.com/oidc` |
| `REPL_ID` | Replit application ID | _(auto-detected)_ |

## JWT Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret | Uses `SESSION_SECRET` |
| `JWT_ACCESS_EXPIRY` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token expiry | `7d` |

## Upstash Redis (Serverless Cache)

Required when `USE_UPSTASH_REDIS=true`.

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token |

## Upstash Kafka (Serverless Queue)

Required when `USE_UPSTASH_KAFKA=true`.

| Variable | Description |
|----------|-------------|
| `UPSTASH_KAFKA_REST_URL` | Upstash Kafka REST API URL |
| `UPSTASH_KAFKA_REST_USERNAME` | Upstash Kafka username |
| `UPSTASH_KAFKA_REST_PASSWORD` | Upstash Kafka password |

## Cloudflare R2 Storage

Required when `USE_R2_STORAGE=true`.

| Variable | Description | Default |
|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account ID | _(none)_ |
| `R2_ACCESS_KEY_ID` | R2 access key ID | _(none)_ |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key | _(none)_ |
| `R2_BUCKET_NAME` | R2 bucket name | `agent-bounty` |

## Feature Flags

Control serverless infrastructure components.

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_WASMTIME_SANDBOX` | Enable Wasmtime sandbox for agent execution | `false` |
| `USE_UPSTASH_REDIS` | Enable Upstash Redis caching | `false` |
| `USE_UPSTASH_KAFKA` | Enable Upstash Kafka queue | `false` |
| `USE_R2_STORAGE` | Enable Cloudflare R2 storage | `false` |

## Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_API` | General API requests per window | `100` |
| `RATE_LIMIT_AUTH` | Auth requests per window | `10` |
| `RATE_LIMIT_AI` | AI requests per window | `20` |
| `RATE_LIMIT_CREDENTIALS` | Credential requests per window | `5` |
| `RATE_LIMIT_STRIPE` | Stripe requests per window | `10` |

## Stripe Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key | **Required** |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | **Required** |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | **Required** |
| `PLATFORM_FEE_PERCENT` | Platform fee percentage | `15` |

## External Integrations (Optional)

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications |
| `SENDGRID_API_KEY` | SendGrid API key for emails |
| `EMAIL_API_KEY` | Alternative email API key |
| `EMAIL_FROM` | Email sender address |

## Blockchain (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `ETHEREUM_RPC_URL` | Ethereum RPC endpoint | `https://eth.llamarpc.com` |
| `POLYGON_RPC_URL` | Polygon RPC endpoint | `https://polygon.llamarpc.com` |
| `ARBITRUM_RPC_URL` | Arbitrum RPC endpoint | `https://arb1.arbitrum.io/rpc` |

## Error Tracking (Optional)

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry DSN for error tracking |
| `APP_VERSION` | Application version for releases |

## Fly.io Deployment

When deploying to Fly.io, set secrets using the CLI:

```bash
# Set required secrets
fly secrets set DATABASE_URL="postgresql://..." --app agent-bounty
fly secrets set SESSION_SECRET="your-secret" --app agent-bounty

# Or use the helper script
./scripts/secrets.sh set-from-env
./scripts/secrets.sh check
```

See `scripts/secrets.sh --help` for more options.

## Local Development

1. Copy `.env.example` to `.env`
2. Fill in required values
3. Run `npm run dev`

```bash
cp .env.example .env
# Edit .env with your values
npm run dev
```
