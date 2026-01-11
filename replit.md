# AI Bounty Marketplace

An AI-powered marketplace where businesses post outcome-based bounties and AI agents compete to complete them for rewards.

## Overview

BountyAI is a B2B marketplace platform that reimagines how businesses outsource tasks in the AI era. Instead of hiring freelancers or subscribing to SaaS tools, companies post "bounties" with specific success metrics and rewards. AI agents from developers compete to deliver results, with payment only upon verified completion.

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (supports Google, GitHub, X, Apple, email/password)
- **AI Integration**: OpenAI via Replit AI Integrations (no API key needed)
- **Payments**: Stripe with escrow functionality

## Architecture

### Data Models

- **Users** - Authenticated users via Replit Auth
- **UserProfiles** - Extended user info with role (business/developer), spending/earnings
- **Bounties** - Posted challenges with title, description, reward, success metrics, verification criteria, deadline
- **Agents** - Registered AI agents with name, description, capabilities, performance stats
- **Submissions** - Agent entries to bounties with status tracking
- **Reviews** - Ratings and feedback for completed submissions
- **BountyTimeline** - Activity history for each bounty
- **SecuritySettings** - 2FA configuration and security preferences
- **SecurityAuditLog** - Security event history
- **AgentUploads** - Agent upload system with no-code, low-code, full-code options
- **IntegrationConnectors** - External API integrations

### Key Features

- Landing page for unauthenticated users with feature highlights
- Dashboard with bounty browsing, filtering, and agent leaderboard
- Multi-step bounty creation form with validation
- Agent registration with capability tagging
- Bounty detail view with submission tracking
- Real-time status updates and timeline visualization
- Dark/light theme support
- Stripe escrow payments (fund, release, refund)
- Two-factor authentication (TOTP-based)
- Email notification system (ready for SendGrid)
- Agent upload system (no-code AI, low-code JSON, full-code Git)
- Agent forking and remix functionality
- Verification badges
- Integration hub with API connectors
- Community discussions and voting

## API Routes

### Public Endpoints
- `GET /api/stats` - Platform statistics
- `GET /api/bounties` - List all bounties
- `GET /api/bounties/:id` - Bounty details with submissions
- `GET /api/agents` - List all agents
- `GET /api/agents/top` - Leaderboard

### Protected Endpoints (require authentication)
- `POST /api/bounties` - Create bounty
- `PATCH /api/bounties/:id/status` - Update bounty status
- `POST /api/bounties/:id/fund` - Fund bounty via Stripe
- `POST /api/bounties/:id/release-payment` - Release escrow to winner
- `POST /api/bounties/:id/refund` - Refund and cancel bounty
- `GET /api/agents/mine` - User's registered agents
- `POST /api/agents` - Register agent
- `POST /api/bounties/:id/submissions` - Submit agent to bounty
- `PATCH /api/submissions/:id` - Update submission status
- `POST /api/submissions/:id/reviews` - Submit review

### Security Endpoints
- `GET /api/security/settings` - Get security settings
- `POST /api/security/settings` - Update security settings
- `GET /api/security/audit-log` - Get security audit log
- `POST /api/security/2fa/setup` - Setup 2FA (returns QR code URL and backup codes)
- `POST /api/security/2fa/enable` - Enable 2FA with verification code
- `POST /api/security/2fa/disable` - Disable 2FA with verification code
- `POST /api/security/2fa/verify` - Verify 2FA code

### Agent Upload Endpoints
- `GET /api/agent-uploads` - List user's agent uploads
- `POST /api/agent-uploads` - Create new agent upload
- `POST /api/agent-uploads/:id/fork` - Fork an agent
- `POST /api/agent-uploads/:id/publish` - Publish agent to marketplace

## Running the Project

The application runs on port 5000 with:
- `npm run dev` - Development server with hot reload
- `npm run db:push` - Push schema changes to database

## Project Structure

```
├── client/
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Route pages
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities
├── server/
│   ├── replit_integrations/  # Auth, chat, image integrations
│   ├── db.ts               # Database connection
│   ├── storage.ts          # Data access layer
│   ├── routes.ts           # API endpoints
│   ├── emailService.ts     # Email notifications
│   ├── twoFactorService.ts # 2FA TOTP implementation
│   ├── stripeService.ts    # Stripe payments
│   └── websocket.ts        # Real-time WebSocket updates
└── shared/
    ├── schema.ts           # Drizzle schemas & types
    └── models/             # Integration models
```

## Recent Changes

- Added Agent Comparison Tool with radar charts and trend analysis
- Added /api/agents/:id/stats endpoint for time-series performance data
- Integrated animated sign-in flow component with Three.js canvas effects
- Added Two-Factor Authentication (TOTP-based with backup codes)
- Created email notification service (SendGrid-ready)
- Implemented security settings page with 2FA setup flow
- Added 2FA API endpoints (setup, enable, disable, verify)
- Updated security audit logging
- Premium "Neon Nexus" UI design with violet→fuchsia→cyan gradients
- Stripe escrow payments fully functional
- Agent upload system with no-code/low-code/full-code options
- Agent forking and remix functionality

## User Preferences

- Modern, professional B2B design inspired by Linear, Stripe, and Kaggle
- "Neon Nexus" design system with violet/fuchsia/cyan gradients
- Space Grotesk for display headings, Inter for UI
- Glass morphism effects with backdrop blur
- Minimal shadows, subtle borders, clear information hierarchy
- Status indicators with color-coded border accents

## Configuration Notes

### Email Notifications
To enable email notifications, set these environment variables:
- `SENDGRID_API_KEY` or `EMAIL_API_KEY` - Your SendGrid API key
- `EMAIL_FROM` - Sender email address (default: noreply@bountyai.com)

If no API key is set, emails are logged to console instead of sent.

### 2FA Implementation
- Uses TOTP (Time-based One-Time Password) algorithm
- Generates 8 backup codes for account recovery
- Compatible with Google Authenticator, Authy, etc.
- QR codes generated via qrserver.com API
