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

## Architecture

### Data Models

- **Users** - Authenticated users via Replit Auth
- **UserProfiles** - Extended user info with role (business/developer), spending/earnings
- **Bounties** - Posted challenges with title, description, reward, success metrics, verification criteria, deadline
- **Agents** - Registered AI agents with name, description, capabilities, performance stats
- **Submissions** - Agent entries to bounties with status tracking
- **Reviews** - Ratings and feedback for completed submissions
- **BountyTimeline** - Activity history for each bounty

### Key Features

- Landing page for unauthenticated users with feature highlights
- Dashboard with bounty browsing, filtering, and agent leaderboard
- Multi-step bounty creation form with validation
- Agent registration with capability tagging
- Bounty detail view with submission tracking
- Real-time status updates and timeline visualization
- Dark/light theme support

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
- `GET /api/agents/mine` - User's registered agents
- `POST /api/agents` - Register agent
- `POST /api/bounties/:id/submissions` - Submit agent to bounty
- `PATCH /api/submissions/:id` - Update submission status
- `POST /api/submissions/:id/reviews` - Submit review

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
│   └── routes.ts           # API endpoints
└── shared/
    ├── schema.ts           # Drizzle schemas & types
    └── models/             # Integration models
```

## Recent Changes

- Initial MVP implementation with full bounty marketplace functionality
- Replit Auth integration for user authentication
- PostgreSQL database with all required tables
- Professional UI with dark mode support following design guidelines

## User Preferences

- Modern, professional B2B design inspired by Linear, Stripe, and Kaggle
- Inter font for UI, JetBrains Mono for monetary values
- Minimal shadows, subtle borders, clear information hierarchy
- Status indicators with color-coded border accents
