/**
 * Mock Stripe client for testing
 */

import { vi } from 'vitest';

// Mock Stripe responses
export const mockStripeResponses = {
  customer: {
    id: 'cus_test123',
    email: 'test@example.com',
    metadata: { userId: 'test-user-id' },
  },
  paymentIntent: {
    id: 'pi_test123',
    amount: 10000,
    currency: 'usd',
    status: 'requires_capture',
    metadata: { bountyId: '1', type: 'bounty_escrow' },
  },
  checkoutSession: {
    id: 'cs_test123',
    url: 'https://checkout.stripe.com/test',
    payment_intent: 'pi_test123',
    metadata: { bountyId: '1' },
  },
  charge: {
    id: 'ch_test123',
    payment_intent: 'pi_test123',
    status: 'succeeded',
  },
  refund: {
    id: 're_test123',
    payment_intent: 'pi_test123',
    status: 'succeeded',
  },
  transfer: {
    id: 'tr_test123',
    amount: 8500, // After 15% fee
    destination: 'acct_test123',
  },
  subscription: {
    id: 'sub_test123',
    status: 'active',
    customer: 'cus_test123',
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    items: {
      data: [{
        price: {
          id: 'price_test123',
          product: 'prod_test123',
        },
      }],
    },
  },
  product: {
    id: 'prod_test123',
    name: 'Pro Plan',
    metadata: { tier: 'pro' },
  },
  price: {
    id: 'price_test123',
    product: 'prod_test123',
    unit_amount: 9900,
    recurring: { interval: 'month' },
  },
};

export const mockStripe = {
  customers: {
    create: vi.fn(() => Promise.resolve(mockStripeResponses.customer)),
    retrieve: vi.fn(() => Promise.resolve(mockStripeResponses.customer)),
  },
  paymentIntents: {
    create: vi.fn(() => Promise.resolve(mockStripeResponses.paymentIntent)),
    capture: vi.fn(() => Promise.resolve({ ...mockStripeResponses.paymentIntent, status: 'succeeded' })),
    retrieve: vi.fn(() => Promise.resolve(mockStripeResponses.paymentIntent)),
  },
  checkout: {
    sessions: {
      create: vi.fn(() => Promise.resolve(mockStripeResponses.checkoutSession)),
    },
  },
  refunds: {
    create: vi.fn(() => Promise.resolve(mockStripeResponses.refund)),
  },
  transfers: {
    create: vi.fn(() => Promise.resolve(mockStripeResponses.transfer)),
  },
  subscriptions: {
    create: vi.fn(() => Promise.resolve(mockStripeResponses.subscription)),
    cancel: vi.fn(() => Promise.resolve({ ...mockStripeResponses.subscription, status: 'canceled' })),
    retrieve: vi.fn(() => Promise.resolve(mockStripeResponses.subscription)),
  },
  products: {
    create: vi.fn(() => Promise.resolve(mockStripeResponses.product)),
    list: vi.fn(() => Promise.resolve({ data: [mockStripeResponses.product] })),
    retrieve: vi.fn(() => Promise.resolve(mockStripeResponses.product)),
  },
  prices: {
    create: vi.fn(() => Promise.resolve(mockStripeResponses.price)),
    list: vi.fn(() => Promise.resolve({ data: [mockStripeResponses.price] })),
  },
  webhooks: {
    constructEvent: vi.fn((payload, sig, secret) => {
      return JSON.parse(payload.toString());
    }),
  },
};

// Mock the Stripe client module
vi.mock('../../stripeClient', () => ({
  getUncachableStripeClient: vi.fn(() => Promise.resolve(mockStripe)),
  getStripeSync: vi.fn(() => Promise.resolve({
    processWebhook: vi.fn(() => Promise.resolve()),
    syncBackfill: vi.fn(() => Promise.resolve()),
    findOrCreateManagedWebhook: vi.fn(() => Promise.resolve({ webhook: { url: 'https://test.com/webhook' } })),
  })),
  getStripePublishableKey: vi.fn(() => 'pk_test_mock'),
}));

export const resetStripeMocks = () => {
  vi.clearAllMocks();
};

export default mockStripe;
