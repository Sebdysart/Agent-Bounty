# Contributing to Agent-Bounty

Thank you for your interest in contributing to Agent-Bounty! This guide will help you get started.

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and configure your environment variables
4. Start the development server:
   ```bash
   npm run dev
   ```

## Testing

We use [Vitest](https://vitest.dev/) for testing. All tests should pass before submitting a pull request.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI (interactive browser interface)
npm run test:ui
```

### Test Structure

- Test files are co-located with the files they test (e.g., `stripeService.test.ts` next to `stripeService.ts`)
- Integration tests are in `server/__tests__/integration/`
- Test utilities and setup are in `server/__tests__/setup.ts`
- Mock implementations are in `server/__tests__/mocks/`
- Entity factories are in `server/__tests__/factories/`

### Writing Tests

- Use descriptive test names that explain the expected behavior
- Mock external services (Stripe, OpenAI) - never call real APIs in tests
- Use the provided factories to create test data
- Ensure tests are deterministic and not flaky

Example test structure:
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyService', () => {
  it('should do something specific', async () => {
    // Arrange
    const input = createTestInput();

    // Act
    const result = await myService.doSomething(input);

    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

### Test Coverage

We aim for >80% coverage on critical paths, especially:
- Payment system (Stripe escrow)
- Authentication and authorization
- Credential vault (encryption)
- AI execution service

## Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use Zod for input validation
- Handle errors gracefully with proper error messages

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run `npm test` and ensure all tests pass
4. Run `npm run test:coverage` to verify coverage
5. Submit a pull request with a clear description of changes

## Security

- Never commit secrets or API keys
- Sanitize user input to prevent XSS and SQL injection
- Use the credential vault for sensitive data storage
- Report security vulnerabilities privately

## Questions?

Open an issue for any questions about contributing.
