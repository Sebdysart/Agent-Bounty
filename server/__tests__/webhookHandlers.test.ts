/**
 * WebhookHandlers Tests - Stripe Webhook Processing
 *
 * Tests the webhook event handlers for:
 * - Checkout session completion (bounty funding)
 * - Payment failures
 * - Charge captures (payment release)
 * - Charge refunds (bounty cancellation)
 * - Subscription lifecycle events
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to define mock functions before module mocking
const {
  mockUpdateBountyPaymentIntent,
  mockUpdateBountyPaymentStatus,
  mockUpdateBountyStatus,
  mockGetBounty,
  mockGetBountyByPaymentIntent,
  mockGetSubmission,
  mockAddTimelineEvent,
  mockGetUserProfileByStripeCustomerId,
  mockUpdateUserSubscription,
  mockProcessBountyCompletion,
  mockProductsRetrieve,
  mockProcessWebhook,
} = vi.hoisted(() => ({
  mockUpdateBountyPaymentIntent: vi.fn(() => Promise.resolve()),
  mockUpdateBountyPaymentStatus: vi.fn(() => Promise.resolve()),
  mockUpdateBountyStatus: vi.fn(() => Promise.resolve()),
  mockGetBounty: vi.fn(() => Promise.resolve(null)),
  mockGetBountyByPaymentIntent: vi.fn(() => Promise.resolve(null)),
  mockGetSubmission: vi.fn(() => Promise.resolve(null)),
  mockAddTimelineEvent: vi.fn(() => Promise.resolve({ id: 1 })),
  mockGetUserProfileByStripeCustomerId: vi.fn(() => Promise.resolve(null)),
  mockUpdateUserSubscription: vi.fn(() => Promise.resolve()),
  mockProcessBountyCompletion: vi.fn(() => Promise.resolve()),
  mockProductsRetrieve: vi.fn(() => Promise.resolve({ id: 'prod_test', metadata: { tier: 'pro' } })),
  mockProcessWebhook: vi.fn(() => Promise.resolve()),
}));

// Mock modules
vi.mock('../storage', () => ({
  storage: {
    updateBountyPaymentIntent: mockUpdateBountyPaymentIntent,
    updateBountyPaymentStatus: mockUpdateBountyPaymentStatus,
    updateBountyStatus: mockUpdateBountyStatus,
    getBounty: mockGetBounty,
    getBountyByPaymentIntent: mockGetBountyByPaymentIntent,
    getSubmission: mockGetSubmission,
    addTimelineEvent: mockAddTimelineEvent,
    getUserProfileByStripeCustomerId: mockGetUserProfileByStripeCustomerId,
    updateUserSubscription: mockUpdateUserSubscription,
  },
}));

vi.mock('../reputationService', () => ({
  reputationService: {
    processBountyCompletion: mockProcessBountyCompletion,
    initializeReputation: vi.fn(() => Promise.resolve()),
    recordEvent: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../stripeClient', () => ({
  getUncachableStripeClient: vi.fn(() => Promise.resolve({
    products: {
      retrieve: mockProductsRetrieve,
    },
  })),
  getStripeSync: vi.fn(() => Promise.resolve({
    processWebhook: mockProcessWebhook,
  })),
}));

// Import factories and WebhookHandlers after mocks are set up
import { factories, resetIdCounter } from './factories';
import { WebhookHandlers } from '../webhookHandlers';

describe('WebhookHandlers', () => {
  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleEvent', () => {
    it('should route checkout.session.completed to handleCheckoutCompleted', async () => {
      const session = {
        id: 'cs_test123',
        metadata: { bountyId: '1' },
        payment_intent: 'pi_test123',
      };

      mockGetBounty.mockResolvedValueOnce(factories.createBounty({ id: 1, status: 'open' }));

      await WebhookHandlers.handleEvent({
        type: 'checkout.session.completed',
        data: { object: session },
      });

      expect(mockUpdateBountyPaymentIntent).toHaveBeenCalledWith(1, 'pi_test123');
    });

    it('should route payment_intent.payment_failed to handlePaymentFailed', async () => {
      const paymentIntent = {
        id: 'pi_test123',
        metadata: { bountyId: '5' },
      };

      await WebhookHandlers.handleEvent({
        type: 'payment_intent.payment_failed',
        data: { object: paymentIntent },
      });

      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(5, 'pending');
    });

    it('should route charge.captured to handleChargeCaptured', async () => {
      const charge = {
        id: 'ch_test123',
        payment_intent: 'pi_test123',
      };

      const bounty = factories.createBounty({
        id: 10,
        stripePaymentIntentId: 'pi_test123',
        winnerId: 1,
      });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);
      mockGetSubmission.mockResolvedValueOnce(factories.createSubmission({ id: 1, agentId: 5 }));

      await WebhookHandlers.handleEvent({
        type: 'charge.captured',
        data: { object: charge },
      });

      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(10, 'released');
    });

    it('should route charge.refunded to handleChargeRefunded', async () => {
      const charge = {
        id: 'ch_test123',
        payment_intent: 'pi_refund123',
      };

      const bounty = factories.createBounty({ id: 20, stripePaymentIntentId: 'pi_refund123' });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);

      await WebhookHandlers.handleEvent({
        type: 'charge.refunded',
        data: { object: charge },
      });

      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(20, 'refunded');
    });

    it('should route customer.subscription.updated to handleSubscriptionUpdated', async () => {
      const subscription = {
        id: 'sub_test123',
        customer: 'cus_test123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{
            price: {
              id: 'price_pro',
              product: 'prod_pro',
            },
          }],
        },
      };

      const profile = factories.createUserProfile({ id: 'user-123', stripeCustomerId: 'cus_test123' });
      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(profile);
      mockProductsRetrieve.mockResolvedValueOnce({ id: 'prod_pro', metadata: { tier: 'pro' } });

      await WebhookHandlers.handleEvent({
        type: 'customer.subscription.updated',
        data: { object: subscription },
      });

      expect(mockUpdateUserSubscription).toHaveBeenCalled();
    });

    it('should route customer.subscription.deleted to handleSubscriptionDeleted', async () => {
      const subscription = {
        id: 'sub_test123',
        customer: 'cus_delete123',
      };

      const profile = factories.createUserProfile({ id: 'user-456', stripeCustomerId: 'cus_delete123' });
      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(profile);

      await WebhookHandlers.handleEvent({
        type: 'customer.subscription.deleted',
        data: { object: subscription },
      });

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith('user-456', 'free', null, null);
    });

    it('should log unhandled event types without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await WebhookHandlers.handleEvent({
        type: 'some.unknown.event',
        data: { object: {} },
      });

      expect(consoleSpy).toHaveBeenCalledWith('Unhandled event type: some.unknown.event');
      consoleSpy.mockRestore();
    });
  });

  describe('handleCheckoutCompleted', () => {
    it('should update bounty status to funded', async () => {
      const session = {
        id: 'cs_test123',
        metadata: { bountyId: '42' },
        payment_intent: 'pi_checkout123',
      };

      const bounty = factories.createBounty({ id: 42, status: 'open' });
      mockGetBounty.mockResolvedValueOnce(bounty);

      await WebhookHandlers.handleCheckoutCompleted(session);

      expect(mockUpdateBountyPaymentIntent).toHaveBeenCalledWith(42, 'pi_checkout123');
      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(42, 'funded');
    });

    it('should add timeline event for funded bounty', async () => {
      const session = {
        id: 'cs_test123',
        metadata: { bountyId: '42' },
        payment_intent: 'pi_timeline123',
      };

      const bounty = factories.createBounty({ id: 42, status: 'open' });
      mockGetBounty.mockResolvedValueOnce(bounty);

      await WebhookHandlers.handleCheckoutCompleted(session);

      expect(mockAddTimelineEvent).toHaveBeenCalledWith(
        42,
        'funded',
        'Bounty funded and payment held in escrow. Now accepting agent submissions.'
      );
    });

    it('should transition bounty from draft to open when funded', async () => {
      const session = {
        id: 'cs_draft123',
        metadata: { bountyId: '99' },
        payment_intent: 'pi_draft123',
      };

      const bounty = factories.createBounty({ id: 99, status: 'draft' });
      mockGetBounty.mockResolvedValueOnce(bounty);

      await WebhookHandlers.handleCheckoutCompleted(session);

      expect(mockUpdateBountyStatus).toHaveBeenCalledWith(99, 'open');
    });

    it('should handle missing bountyId gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const session = {
        id: 'cs_no_bounty',
        metadata: {},
        payment_intent: 'pi_test123',
      };

      await WebhookHandlers.handleCheckoutCompleted(session);

      expect(mockUpdateBountyPaymentIntent).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No bountyId in checkout session metadata');
      consoleSpy.mockRestore();
    });

    it('should handle missing payment_intent gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const session = {
        id: 'cs_no_pi',
        metadata: { bountyId: '1' },
        payment_intent: null,
      };

      await WebhookHandlers.handleCheckoutCompleted(session);

      expect(mockUpdateBountyPaymentIntent).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No payment_intent in checkout session');
      consoleSpy.mockRestore();
    });

    it('should not update status if bounty is already in a different state', async () => {
      const session = {
        id: 'cs_completed',
        metadata: { bountyId: '50' },
        payment_intent: 'pi_completed123',
      };

      const bounty = factories.createBounty({ id: 50, status: 'completed' });
      mockGetBounty.mockResolvedValueOnce(bounty);

      await WebhookHandlers.handleCheckoutCompleted(session);

      expect(mockUpdateBountyPaymentIntent).toHaveBeenCalled();
      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalled();
      expect(mockUpdateBountyStatus).not.toHaveBeenCalledWith(50, 'open');
    });
  });

  describe('handlePaymentFailed', () => {
    it('should revert bounty to pending status', async () => {
      const paymentIntent = {
        id: 'pi_failed123',
        metadata: { bountyId: '15' },
      };

      await WebhookHandlers.handlePaymentFailed(paymentIntent);

      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(15, 'pending');
    });

    it('should add timeline event for payment failure', async () => {
      const paymentIntent = {
        id: 'pi_failed456',
        metadata: { bountyId: '25' },
      };

      await WebhookHandlers.handlePaymentFailed(paymentIntent);

      expect(mockAddTimelineEvent).toHaveBeenCalledWith(
        25,
        'payment_failed',
        'Payment authorization failed. Please try funding again.'
      );
    });

    it('should handle missing bountyId gracefully', async () => {
      const paymentIntent = {
        id: 'pi_no_bounty',
        metadata: {},
      };

      await WebhookHandlers.handlePaymentFailed(paymentIntent);

      expect(mockUpdateBountyPaymentStatus).not.toHaveBeenCalled();
      expect(mockAddTimelineEvent).not.toHaveBeenCalled();
    });
  });

  describe('handleChargeCaptured', () => {
    it('should mark payment as released', async () => {
      const charge = {
        id: 'ch_capture123',
        payment_intent: 'pi_captured123',
      };

      const bounty = factories.createBounty({
        id: 30,
        stripePaymentIntentId: 'pi_captured123',
        winnerId: 5,
      });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);
      mockGetSubmission.mockResolvedValueOnce(factories.createSubmission({ id: 5, agentId: 10 }));

      await WebhookHandlers.handleChargeCaptured(charge);

      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(30, 'released');
    });

    it('should mark bounty as completed', async () => {
      const charge = {
        id: 'ch_complete123',
        payment_intent: 'pi_complete123',
      };

      const bounty = factories.createBounty({
        id: 35,
        stripePaymentIntentId: 'pi_complete123',
        winnerId: 8,
      });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);
      mockGetSubmission.mockResolvedValueOnce(factories.createSubmission({ id: 8, agentId: 15 }));

      await WebhookHandlers.handleChargeCaptured(charge);

      expect(mockUpdateBountyStatus).toHaveBeenCalledWith(35, 'completed');
    });

    it('should add timeline event for payment release', async () => {
      const charge = {
        id: 'ch_timeline123',
        payment_intent: 'pi_timeline456',
      };

      const bounty = factories.createBounty({
        id: 40,
        stripePaymentIntentId: 'pi_timeline456',
        winnerId: 12,
      });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);
      mockGetSubmission.mockResolvedValueOnce(factories.createSubmission({ id: 12, agentId: 20 }));

      await WebhookHandlers.handleChargeCaptured(charge);

      expect(mockAddTimelineEvent).toHaveBeenCalledWith(
        40,
        'payment_released',
        'Payment has been released to the winning agent.'
      );
    });

    it('should trigger reputation update for winning agent', async () => {
      const charge = {
        id: 'ch_reputation123',
        payment_intent: 'pi_reputation123',
      };

      const bounty = factories.createBounty({
        id: 45,
        stripePaymentIntentId: 'pi_reputation123',
        winnerId: 100,
      });
      const submission = factories.createSubmission({ id: 100, agentId: 25 });

      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);
      mockGetSubmission.mockResolvedValueOnce(submission);

      await WebhookHandlers.handleChargeCaptured(charge);

      expect(mockProcessBountyCompletion).toHaveBeenCalledWith(25, 45, true);
    });

    it('should handle missing payment_intent gracefully', async () => {
      const charge = {
        id: 'ch_no_pi',
        payment_intent: null,
      };

      await WebhookHandlers.handleChargeCaptured(charge);

      expect(mockGetBountyByPaymentIntent).not.toHaveBeenCalled();
    });

    it('should handle bounty not found gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const charge = {
        id: 'ch_no_bounty',
        payment_intent: 'pi_unknown123',
      };

      mockGetBountyByPaymentIntent.mockResolvedValueOnce(null);

      await WebhookHandlers.handleChargeCaptured(charge);

      expect(consoleSpy).toHaveBeenCalledWith('No bounty found for payment intent pi_unknown123');
      expect(mockUpdateBountyPaymentStatus).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should skip reputation update when no winner is set', async () => {
      const charge = {
        id: 'ch_no_winner',
        payment_intent: 'pi_no_winner123',
      };

      const bounty = factories.createBounty({
        id: 50,
        stripePaymentIntentId: 'pi_no_winner123',
        winnerId: null,
      });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);

      await WebhookHandlers.handleChargeCaptured(charge);

      expect(mockProcessBountyCompletion).not.toHaveBeenCalled();
    });

    it('should skip reputation update when submission not found', async () => {
      const charge = {
        id: 'ch_no_submission',
        payment_intent: 'pi_no_sub123',
      };

      const bounty = factories.createBounty({
        id: 55,
        stripePaymentIntentId: 'pi_no_sub123',
        winnerId: 999,
      });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);
      mockGetSubmission.mockResolvedValueOnce(null);

      await WebhookHandlers.handleChargeCaptured(charge);

      expect(mockProcessBountyCompletion).not.toHaveBeenCalled();
    });
  });

  describe('handleChargeRefunded', () => {
    it('should cancel bounty on refund', async () => {
      const charge = {
        id: 'ch_refund123',
        payment_intent: 'pi_refund789',
      };

      const bounty = factories.createBounty({
        id: 60,
        stripePaymentIntentId: 'pi_refund789',
      });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);

      await WebhookHandlers.handleChargeRefunded(charge);

      expect(mockUpdateBountyStatus).toHaveBeenCalledWith(60, 'cancelled');
    });

    it('should update payment status to refunded', async () => {
      const charge = {
        id: 'ch_refund456',
        payment_intent: 'pi_refund456',
      };

      const bounty = factories.createBounty({
        id: 65,
        stripePaymentIntentId: 'pi_refund456',
      });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);

      await WebhookHandlers.handleChargeRefunded(charge);

      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(65, 'refunded');
    });

    it('should add timeline event for refund', async () => {
      const charge = {
        id: 'ch_refund_timeline',
        payment_intent: 'pi_refund_timeline',
      };

      const bounty = factories.createBounty({
        id: 70,
        stripePaymentIntentId: 'pi_refund_timeline',
      });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bounty);

      await WebhookHandlers.handleChargeRefunded(charge);

      expect(mockAddTimelineEvent).toHaveBeenCalledWith(
        70,
        'payment_refunded',
        'Bounty cancelled and payment refunded to poster.'
      );
    });

    it('should handle missing payment_intent gracefully', async () => {
      const charge = {
        id: 'ch_refund_no_pi',
        payment_intent: null,
      };

      await WebhookHandlers.handleChargeRefunded(charge);

      expect(mockGetBountyByPaymentIntent).not.toHaveBeenCalled();
    });

    it('should handle bounty not found gracefully', async () => {
      const charge = {
        id: 'ch_refund_no_bounty',
        payment_intent: 'pi_not_found',
      };

      mockGetBountyByPaymentIntent.mockResolvedValueOnce(null);

      await WebhookHandlers.handleChargeRefunded(charge);

      expect(mockUpdateBountyPaymentStatus).not.toHaveBeenCalled();
      expect(mockUpdateBountyStatus).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionUpdated', () => {
    it('should update user tier to pro for active subscription', async () => {
      const subscription = {
        id: 'sub_pro123',
        customer: 'cus_tier_pro',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{
            price: {
              id: 'price_pro',
              product: 'prod_pro123',
            },
          }],
        },
      };

      const profile = factories.createUserProfile({ id: 'user-pro', stripeCustomerId: 'cus_tier_pro' });
      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(profile);
      mockProductsRetrieve.mockResolvedValueOnce({ id: 'prod_pro123', metadata: { tier: 'pro' } });

      await WebhookHandlers.handleSubscriptionUpdated(subscription);

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith(
        'user-pro',
        'pro',
        'sub_pro123',
        expect.any(Date)
      );
    });

    it('should update user tier to enterprise for enterprise subscription', async () => {
      const subscription = {
        id: 'sub_enterprise123',
        customer: 'cus_tier_enterprise',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{
            price: {
              id: 'price_enterprise',
              product: 'prod_enterprise123',
            },
          }],
        },
      };

      const profile = factories.createUserProfile({ id: 'user-enterprise', stripeCustomerId: 'cus_tier_enterprise' });
      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(profile);
      mockProductsRetrieve.mockResolvedValueOnce({ id: 'prod_enterprise123', metadata: { tier: 'enterprise' } });

      await WebhookHandlers.handleSubscriptionUpdated(subscription);

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith(
        'user-enterprise',
        'enterprise',
        'sub_enterprise123',
        expect.any(Date)
      );
    });

    it('should handle inactive subscription by setting free tier', async () => {
      const subscription = {
        id: 'sub_inactive',
        customer: 'cus_inactive',
        status: 'past_due',
        current_period_end: Math.floor(Date.now() / 1000),
        items: {
          data: [{
            price: {
              id: 'price_inactive',
              product: 'prod_inactive',
            },
          }],
        },
      };

      const profile = factories.createUserProfile({ id: 'user-inactive', stripeCustomerId: 'cus_inactive' });
      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(profile);

      await WebhookHandlers.handleSubscriptionUpdated(subscription);

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith(
        'user-inactive',
        'free',
        'sub_inactive',
        expect.any(Date)
      );
    });

    it('should handle missing customerId gracefully', async () => {
      const subscription = {
        id: 'sub_no_customer',
        customer: null,
        status: 'active',
      };

      await WebhookHandlers.handleSubscriptionUpdated(subscription);

      expect(mockGetUserProfileByStripeCustomerId).not.toHaveBeenCalled();
    });

    it('should handle user not found gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const subscription = {
        id: 'sub_unknown_user',
        customer: 'cus_unknown',
        status: 'active',
      };

      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(null);

      await WebhookHandlers.handleSubscriptionUpdated(subscription);

      expect(consoleSpy).toHaveBeenCalledWith('No user found for customer cus_unknown');
      expect(mockUpdateUserSubscription).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should default to pro tier when product metadata is missing', async () => {
      const subscription = {
        id: 'sub_no_tier',
        customer: 'cus_no_tier',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{
            price: {
              id: 'price_no_tier',
              product: 'prod_no_tier',
            },
          }],
        },
      };

      const profile = factories.createUserProfile({ id: 'user-no-tier', stripeCustomerId: 'cus_no_tier' });
      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(profile);
      mockProductsRetrieve.mockResolvedValueOnce({ id: 'prod_no_tier', metadata: {} });

      await WebhookHandlers.handleSubscriptionUpdated(subscription);

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith(
        'user-no-tier',
        'pro',
        'sub_no_tier',
        expect.any(Date)
      );
    });

    it('should calculate correct expiration date from current_period_end', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60; // 15 days from now
      const subscription = {
        id: 'sub_expiry',
        customer: 'cus_expiry',
        status: 'active',
        current_period_end: periodEnd,
        items: {
          data: [{
            price: {
              id: 'price_expiry',
              product: 'prod_expiry',
            },
          }],
        },
      };

      const profile = factories.createUserProfile({ id: 'user-expiry', stripeCustomerId: 'cus_expiry' });
      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(profile);
      mockProductsRetrieve.mockResolvedValueOnce({ id: 'prod_expiry', metadata: { tier: 'pro' } });

      await WebhookHandlers.handleSubscriptionUpdated(subscription);

      const expectedDate = new Date(periodEnd * 1000);
      expect(mockUpdateUserSubscription).toHaveBeenCalledWith(
        'user-expiry',
        'pro',
        'sub_expiry',
        expectedDate
      );
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('should revert user to free tier', async () => {
      const subscription = {
        id: 'sub_deleted123',
        customer: 'cus_delete_tier',
      };

      const profile = factories.createUserProfile({ id: 'user-downgrade', stripeCustomerId: 'cus_delete_tier' });
      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(profile);

      await WebhookHandlers.handleSubscriptionDeleted(subscription);

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith('user-downgrade', 'free', null, null);
    });

    it('should clear subscription ID and expiry', async () => {
      const subscription = {
        id: 'sub_clear123',
        customer: 'cus_clear_sub',
      };

      const profile = factories.createUserProfile({
        id: 'user-clear',
        stripeCustomerId: 'cus_clear_sub',
        stripeSubscriptionId: 'sub_clear123',
        subscriptionTier: 'pro',
      });
      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(profile);

      await WebhookHandlers.handleSubscriptionDeleted(subscription);

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith('user-clear', 'free', null, null);
    });

    it('should handle missing customerId gracefully', async () => {
      const subscription = {
        id: 'sub_no_cust_delete',
        customer: null,
      };

      await WebhookHandlers.handleSubscriptionDeleted(subscription);

      expect(mockGetUserProfileByStripeCustomerId).not.toHaveBeenCalled();
    });

    it('should handle user not found gracefully', async () => {
      const subscription = {
        id: 'sub_unknown_delete',
        customer: 'cus_unknown_delete',
      };

      mockGetUserProfileByStripeCustomerId.mockResolvedValueOnce(null);

      await WebhookHandlers.handleSubscriptionDeleted(subscription);

      expect(mockUpdateUserSubscription).not.toHaveBeenCalled();
    });
  });

  describe('processWebhook', () => {
    it('should throw error when payload is not a Buffer', async () => {
      await expect(
        WebhookHandlers.processWebhook('not a buffer' as any, 'sig_test')
      ).rejects.toThrow('STRIPE WEBHOOK ERROR: Payload must be a Buffer');
    });

    it('should include helpful error message with received type', async () => {
      await expect(
        WebhookHandlers.processWebhook({ parsed: 'json' } as any, 'sig_test')
      ).rejects.toThrow('Received type: object');
    });

    it('should accept valid Buffer payloads', async () => {
      const payload = Buffer.from(JSON.stringify({ type: 'test.event', data: {} }));

      await expect(
        WebhookHandlers.processWebhook(payload, 'sig_valid')
      ).resolves.not.toThrow();
    });
  });

  describe('Full Escrow Lifecycle Integration', () => {
    it('should handle complete lifecycle: fund -> complete -> release payment', async () => {
      const bountyId = 100;
      const agentId = 50;
      const submissionId = 75;

      // Step 1: Checkout completed (bounty funded)
      const checkoutSession = {
        id: 'cs_lifecycle',
        metadata: { bountyId: String(bountyId) },
        payment_intent: 'pi_lifecycle123',
      };

      const bountyAtFunding = factories.createBounty({
        id: bountyId,
        status: 'open',
        paymentStatus: 'pending',
      });
      mockGetBounty.mockResolvedValueOnce(bountyAtFunding);

      await WebhookHandlers.handleEvent({
        type: 'checkout.session.completed',
        data: { object: checkoutSession },
      });

      expect(mockUpdateBountyPaymentIntent).toHaveBeenCalledWith(bountyId, 'pi_lifecycle123');
      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(bountyId, 'funded');
      expect(mockAddTimelineEvent).toHaveBeenCalledWith(
        bountyId,
        'funded',
        expect.any(String)
      );

      vi.clearAllMocks();

      // Step 2: Charge captured (payment released to winner)
      const charge = {
        id: 'ch_lifecycle',
        payment_intent: 'pi_lifecycle123',
      };

      const bountyAtCapture = factories.createBounty({
        id: bountyId,
        status: 'open',
        paymentStatus: 'funded',
        winnerId: submissionId,
        stripePaymentIntentId: 'pi_lifecycle123',
      });
      const submission = factories.createSubmission({ id: submissionId, agentId });

      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bountyAtCapture);
      mockGetSubmission.mockResolvedValueOnce(submission);

      await WebhookHandlers.handleEvent({
        type: 'charge.captured',
        data: { object: charge },
      });

      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(bountyId, 'released');
      expect(mockUpdateBountyStatus).toHaveBeenCalledWith(bountyId, 'completed');
      expect(mockAddTimelineEvent).toHaveBeenCalledWith(
        bountyId,
        'payment_released',
        expect.any(String)
      );
      expect(mockProcessBountyCompletion).toHaveBeenCalledWith(agentId, bountyId, true);
    });

    it('should handle cancelled lifecycle: fund -> refund', async () => {
      const bountyId = 200;

      // Step 1: Checkout completed (bounty funded)
      const checkoutSession = {
        id: 'cs_cancel',
        metadata: { bountyId: String(bountyId) },
        payment_intent: 'pi_cancel123',
      };

      const bountyAtFunding = factories.createBounty({
        id: bountyId,
        status: 'open',
        paymentStatus: 'pending',
      });
      mockGetBounty.mockResolvedValueOnce(bountyAtFunding);

      await WebhookHandlers.handleEvent({
        type: 'checkout.session.completed',
        data: { object: checkoutSession },
      });

      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(bountyId, 'funded');

      vi.clearAllMocks();

      // Step 2: Charge refunded (bounty cancelled)
      const charge = {
        id: 'ch_cancel',
        payment_intent: 'pi_cancel123',
      };

      const bountyAtRefund = factories.createBounty({
        id: bountyId,
        status: 'open',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_cancel123',
      });
      mockGetBountyByPaymentIntent.mockResolvedValueOnce(bountyAtRefund);

      await WebhookHandlers.handleEvent({
        type: 'charge.refunded',
        data: { object: charge },
      });

      expect(mockUpdateBountyPaymentStatus).toHaveBeenCalledWith(bountyId, 'refunded');
      expect(mockUpdateBountyStatus).toHaveBeenCalledWith(bountyId, 'cancelled');
      expect(mockAddTimelineEvent).toHaveBeenCalledWith(
        bountyId,
        'payment_refunded',
        expect.any(String)
      );
    });
  });
});
