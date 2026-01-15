# Fly.io Deployment Guide

This guide covers deploying Agent-Bounty to Fly.io.

## Prerequisites

1. Install the Fly.io CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Authenticate with Fly.io:
   ```bash
   fly auth login
   ```

3. Ensure you have accounts set up for:
   - [Neon](https://neon.tech) - PostgreSQL database
   - [Upstash](https://upstash.com) - Redis and Kafka (optional)
   - [Cloudflare R2](https://www.cloudflare.com/products/r2/) - Object storage (optional)
   - [Stripe](https://stripe.com) - Payment processing

## Quick Start

```bash
# Create the app (first time only)
fly apps create agent-bounty

# Set required secrets
./scripts/secrets.sh set

# Deploy
./scripts/deploy.sh
```

## Configuration Files

### fly.toml (Production)

The main configuration file defines:
- App name: `agent-bounty`
- Region: `sjc` (San Jose)
- VM specs: shared-cpu-1x, 512MB RAM
- Auto-scaling: min 1, max machines based on load
- Health checks: `/api/health` every 30s

### fly.staging.toml (Staging)

Staging environment with:
- App name: `agent-bounty-staging`
- Same region and specs as production
- Useful for testing before production deploys

### Dockerfile

Multi-stage build that:
1. Builds the application with all dev dependencies
2. Creates a slim production image with only runtime dependencies
3. Runs as non-root user for security
4. Uses `dumb-init` for proper signal handling

## Setting Secrets

### Required Secrets

```bash
fly secrets set DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
fly secrets set SESSION_SECRET="your-32-char-session-secret"
fly secrets set CREDENTIAL_ENCRYPTION_KEY="your-32-char-encryption-key"
fly secrets set STRIPE_SECRET_KEY="sk_live_..."
fly secrets set STRIPE_PUBLISHABLE_KEY="pk_live_..."
fly secrets set OPENAI_API_KEY="sk-..."
```

### Optional Secrets

```bash
# Stripe webhooks
fly secrets set STRIPE_WEBHOOK_SECRET="whsec_..."

# Additional AI providers
fly secrets set ANTHROPIC_API_KEY="sk-ant-..."
fly secrets set GROQ_API_KEY="gsk_..."

# Upstash Redis (for caching)
fly secrets set UPSTASH_REDIS_REST_URL="https://..."
fly secrets set UPSTASH_REDIS_REST_TOKEN="..."

# Upstash Kafka (for message queue)
fly secrets set UPSTASH_KAFKA_REST_URL="https://..."
fly secrets set UPSTASH_KAFKA_REST_USERNAME="..."
fly secrets set UPSTASH_KAFKA_REST_PASSWORD="..."

# Cloudflare R2 (for storage)
fly secrets set R2_ACCOUNT_ID="..."
fly secrets set R2_ACCESS_KEY_ID="..."
fly secrets set R2_SECRET_ACCESS_KEY="..."
fly secrets set R2_BUCKET_NAME="agent-bounty"

# Admin configuration
fly secrets set ADMIN_USER_IDS="1,2,3"
```

### Using the Secrets Script

```bash
# List current secrets
./scripts/secrets.sh list

# Check if all required secrets are set
./scripts/secrets.sh check

# Set secrets interactively
./scripts/secrets.sh set

# Set secrets from local .env file
./scripts/secrets.sh set-from-env

# Remove a secret
./scripts/secrets.sh unset SECRET_NAME

# Work with staging environment
./scripts/secrets.sh --staging list
```

## Deployment

### Production Deployment

```bash
# Full deployment with tests
./scripts/deploy.sh

# Skip tests (not recommended)
./scripts/deploy.sh --skip-tests

# Skip local build check
./scripts/deploy.sh --skip-build
```

### Staging Deployment

```bash
./scripts/deploy.sh --staging
```

### Manual Deployment

```bash
fly deploy --config fly.toml --app agent-bounty
```

## Monitoring

### View Logs

```bash
# Stream logs
fly logs --app agent-bounty

# View recent logs
fly logs --app agent-bounty -n 100
```

### Check Status

```bash
fly status --app agent-bounty
```

### Health Endpoints

- `/api/health` - Comprehensive health check (database, Redis, Kafka, R2)
- `/api/ready` - Readiness probe for load balancers
- `/api/metrics` - Prometheus-format metrics

### SSH into Machine

```bash
fly ssh console --app agent-bounty
```

## Scaling

### Manual Scaling

```bash
# Scale to 3 machines
fly scale count 3 --app agent-bounty

# Upgrade VM size
fly scale vm shared-cpu-2x --memory 1024 --app agent-bounty
```

### Auto-scaling

Auto-scaling is configured in `fly.toml`:
- `auto_stop_machines = "stop"` - Stop idle machines
- `auto_start_machines = true` - Start machines on demand
- `min_machines_running = 1` - Always keep at least 1 machine running

## Regions

### Add Regions

```bash
# Add Frankfurt region
fly regions add fra --app agent-bounty

# List regions
fly regions list --app agent-bounty
```

### Primary Region

The primary region is set in `fly.toml`:
```toml
primary_region = "sjc"
```

## Database Considerations

### Neon PostgreSQL

Agent-Bounty uses Neon PostgreSQL which is serverless-friendly:
- Connection pooling is handled by Neon
- Use the pooler connection string (port 5432)
- Connections auto-scale with demand

### Database Migrations

Run migrations before deployment:
```bash
npm run db:migrate
```

Or include in your deployment pipeline:
```bash
npm run db:migrate && fly deploy
```

## Troubleshooting

### Common Issues

**App won't start:**
```bash
# Check logs for errors
fly logs --app agent-bounty

# Verify secrets are set
fly secrets list --app agent-bounty
```

**Health checks failing:**
```bash
# Check the health endpoint directly
curl https://agent-bounty.fly.dev/api/health

# SSH in and check locally
fly ssh console --app agent-bounty
wget -qO- http://localhost:3000/api/health
```

**Out of memory:**
```bash
# Increase memory
fly scale vm shared-cpu-1x --memory 1024 --app agent-bounty
```

**Slow cold starts:**
- Ensure `min_machines_running = 1` to avoid cold starts
- Consider upgrading to dedicated CPU for consistent performance

### Rollback

```bash
# List recent deployments
fly releases --app agent-bounty

# Rollback to previous version
fly deploy --image registry.fly.io/agent-bounty:v123 --app agent-bounty
```

### Restart

```bash
fly apps restart agent-bounty
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

Generate a deploy token:
```bash
fly tokens create deploy --app agent-bounty
```

## Cost Optimization

- Use `auto_stop_machines = "stop"` to pause idle machines
- Start with `shared-cpu-1x` and scale up as needed
- Monitor usage with `fly scale show --app agent-bounty`
- Consider reserved pricing for predictable workloads

## Security Best Practices

1. Never commit secrets to version control
2. Use `fly secrets` for all sensitive configuration
3. The Dockerfile runs as non-root user
4. Health checks don't expose sensitive information
5. Use HTTPS (forced via `force_https = true`)
6. Regularly rotate API keys and secrets

## Related Documentation

- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Complete list of configuration options
- [Fly.io Documentation](https://fly.io/docs/)
- [Neon Documentation](https://neon.tech/docs)
- [Upstash Documentation](https://upstash.com/docs)
