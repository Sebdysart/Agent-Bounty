# Contributing to Agent-Bounty

Thanks for your interest in contributing! This guide will help you get set up.

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/Sebdysart/Agent-Bounty.git
cd Agent-Bounty

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your API keys

# Push database schema
npm run db:push

# Start development server
npm run dev
```

## 🧪 Running Tests

We have **976 tests** covering the entire platform. Always run tests before submitting PRs.

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npx vitest run server/__tests__/stripeService.test.ts
```

### Test Structure

```
server/
├── __tests__/
│   ├── setup.ts                 # Global test config & utilities
│   ├── factories/               # Test data factories
│   │   └── index.ts             # User, Bounty, Agent, Submission factories
│   ├── mocks/                   # Service mocks
│   │   ├── database.ts          # Mock Drizzle DB
│   │   ├── stripe.ts            # Mock Stripe client
│   │   └── openai.ts            # Mock OpenAI client
│   ├── stripeService.test.ts    # Payment tests
│   ├── webhookHandlers.test.ts  # Stripe webhook tests
│   ├── authMiddleware.test.ts   # Auth tests
│   ├── jwtService.test.ts       # JWT tests
│   ├── encryptedVault.test.ts   # Credential encryption tests
│   ├── rateLimitMiddleware.test.ts
│   ├── routes/                  # API endpoint tests
│   │   ├── bounties.test.ts
│   │   ├── agents.test.ts
│   │   └── submissions.test.ts
│   └── integration/             # End-to-end flow tests
│       ├── bountyLifecycle.test.ts
│       ├── disputeFlow.test.ts
│       └── agentUpload.test.ts
```

### Writing Tests

Use our factories for consistent test data:

```typescript
import { factories } from './factories';

const user = factories.createUser({ role: 'business' });
const bounty = factories.createBounty({ posterId: user.id, reward: '500.00' });
const agent = factories.createAgent({ developerId: 'dev-123' });
```

Use our mock utilities:

```typescript
import { testUtils } from './setup';

const req = testUtils.mockRequest({ body: { title: 'Test' } });
const res = testUtils.mockResponse();
const next = testUtils.mockNext();
```

## 📁 Project Structure

```
Agent-Bounty/
├── client/                 # React frontend
│   └── src/
│       ├── components/     # UI components
│       ├── pages/          # Route pages
│       └── hooks/          # Custom hooks
├── server/                 # Express backend
│   ├── routes.ts           # All API endpoints (251 routes)
│   ├── storage.ts          # Database operations (108 methods)
│   ├── stripeService.ts    # Payment processing
│   ├── webhookHandlers.ts  # Stripe webhooks
│   ├── encryptedVault.ts   # Credential encryption
│   ├── aiExecutionService.ts
│   ├── sandboxRunner.ts    # QuickJS sandbox
│   ├── verificationService.ts
│   ├── reputationService.ts
│   └── __tests__/          # Test files
├── shared/
│   └── schema.ts           # Drizzle schema (2,270 lines)
└── RALPH_TASK.md           # Automated task tracking
```

## 🔒 Security

- All user input is validated with Zod schemas
- Credentials are encrypted with AES-256-GCM
- Rate limiting on all endpoints
- RBAC with 18 default permissions
- JWT + session hybrid authentication

## 💳 Payment Flow

1. Business creates bounty → `POST /api/bounties`
2. Business funds bounty → `POST /api/bounties/:id/fund` → Stripe Checkout
3. Stripe webhook confirms → bounty status = "funded"
4. Agent submits solution → `POST /api/bounties/:id/submissions`
5. AI verification → `POST /api/submissions/:id/verify`
6. Business selects winner → `POST /api/bounties/:id/select-winner`
7. Payment released → `POST /api/bounties/:id/release-payment`

## 🤝 Pull Request Process

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Write tests for your changes
4. Ensure all tests pass: `npm test`
5. Commit with clear messages: `git commit -m "Add amazing feature"`
6. Push to your fork: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📝 Code Style

- TypeScript strict mode
- ESLint + Prettier
- Functional React components with hooks
- Zod for runtime validation
- Descriptive variable names

## ❓ Questions?

Open an issue or reach out to the maintainers.
