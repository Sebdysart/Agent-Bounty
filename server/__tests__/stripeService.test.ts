/**
 * StripeService Tests - Payment system critical path
 *
 * Tests the core payment functionality including:
 * - Customer creation with metadata
 * - Payment intents with manual capture (escrow)
 * - Checkout sessions with bounty metadata
 * - Payment capture (releasing held funds)
 * - Refunds for cancelled bounties
 * - Transfers with platform fee deduction (15%)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStripe, mockStripeResponses, resetStripeMocks } from './mocks/stripe';

// Import the service after mocks are set up
import { stripeService, StripeService } from '../stripeService';

describe('StripeService', () => {
  beforeEach(() => {
    resetStripeMocks();
  });

  describe('createCustomer', () => {
    it('should create a Stripe customer with email and userId metadata', async () => {
      const result = await stripeService.createCustomer('test@example.com', 'user-123', 'John Doe');

      expect(mockStripe.customers.create).toHaveBeenCalledTimes(1);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'John Doe',
        metadata: { userId: 'user-123' },
      });
      expect(result.id).toBe('cus_test123');
      expect(result.email).toBe('test@example.com');
      expect(result.metadata.userId).toBe('test-user-id');
    });

    it('should create customer without name when not provided', async () => {
      await stripeService.createCustomer('test@example.com', 'user-456');

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: undefined,
        metadata: { userId: 'user-456' },
      });
    });

    it('should store userId in metadata for later reference', async () => {
      const userId = 'user-special-id';
      await stripeService.createCustomer('user@example.com', userId);

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { userId },
        })
      );
    });
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent with manual capture method for escrow', async () => {
      const result = await stripeService.createPaymentIntent(100, 'cus_test123', 1);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(1);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10000, // $100 converted to cents
        currency: 'usd',
        customer: 'cus_test123',
        metadata: {
          bountyId: '1',
          type: 'bounty_escrow',
        },
        capture_method: 'manual', // CRITICAL: This enables escrow pattern
      });
      expect(result.id).toBe('pi_test123');
      expect(result.status).toBe('requires_capture');
    });

    it('should correctly convert dollars to cents', async () => {
      await stripeService.createPaymentIntent(99.99, 'cus_test123', 2);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 9999, // Rounded: 99.99 * 100 = 9999
        })
      );
    });

    it('should handle large bounty amounts', async () => {
      await stripeService.createPaymentIntent(10000, 'cus_test123', 3);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000000, // $10,000 = 1,000,000 cents
        })
      );
    });

    it('should include bountyId in metadata for tracking', async () => {
      const bountyId = 42;
      await stripeService.createPaymentIntent(500, 'cus_test123', bountyId);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            bountyId: '42',
            type: 'bounty_escrow',
          },
        })
      );
    });

    it('should set currency to USD', async () => {
      await stripeService.createPaymentIntent(100, 'cus_test123', 1);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'usd',
        })
      );
    });
  });

  describe('capturePayment', () => {
    it('should capture a held payment intent to release escrow funds', async () => {
      const result = await stripeService.capturePayment('pi_test123');

      expect(mockStripe.paymentIntents.capture).toHaveBeenCalledTimes(1);
      expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith('pi_test123');
      expect(result.status).toBe('succeeded');
    });

    it('should capture different payment intents correctly', async () => {
      await stripeService.capturePayment('pi_different456');

      expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith('pi_different456');
    });
  });

  describe('refundPayment', () => {
    it('should create a refund for a payment intent', async () => {
      const result = await stripeService.refundPayment('pi_test123');

      expect(mockStripe.refunds.create).toHaveBeenCalledTimes(1);
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test123',
      });
      expect(result.status).toBe('succeeded');
      expect(result.id).toBe('re_test123');
    });

    it('should return funds to customer for cancelled bounties', async () => {
      await stripeService.refundPayment('pi_cancelled_bounty');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_cancelled_bounty',
      });
    });
  });

  describe('createCheckoutSession', () => {
    const defaultParams = {
      customerId: 'cus_test123',
      bountyId: 1,
      bountyTitle: 'Test Bounty',
      amount: 100,
      successUrl: 'https://app.example.com/success',
      cancelUrl: 'https://app.example.com/cancel',
    };

    it('should create checkout session with bounty metadata', async () => {
      const result = await stripeService.createCheckoutSession(
        defaultParams.customerId,
        defaultParams.bountyId,
        defaultParams.bountyTitle,
        defaultParams.amount,
        defaultParams.successUrl,
        defaultParams.cancelUrl
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Bounty: Test Bounty',
              description: 'Escrow payment for bounty #1',
            },
            unit_amount: 10000,
          },
          quantity: 1,
        }],
        mode: 'payment',
        payment_intent_data: {
          capture_method: 'manual', // CRITICAL: Escrow pattern
          metadata: {
            bountyId: '1',
            type: 'bounty_escrow',
          },
        },
        success_url: 'https://app.example.com/success',
        cancel_url: 'https://app.example.com/cancel',
        metadata: {
          bountyId: '1',
        },
      });
      expect(result.id).toBe('cs_test123');
      expect(result.url).toBe('https://checkout.stripe.com/test');
    });

    it('should include manual capture for escrow functionality', async () => {
      await stripeService.createCheckoutSession(
        defaultParams.customerId,
        defaultParams.bountyId,
        defaultParams.bountyTitle,
        defaultParams.amount,
        defaultParams.successUrl,
        defaultParams.cancelUrl
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent_data: expect.objectContaining({
            capture_method: 'manual',
          }),
        })
      );
    });

    it('should include bounty metadata at session level', async () => {
      const bountyId = 99;
      await stripeService.createCheckoutSession(
        defaultParams.customerId,
        bountyId,
        'Important Bounty',
        500,
        defaultParams.successUrl,
        defaultParams.cancelUrl
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            bountyId: '99',
          },
        })
      );
    });

    it('should format bounty title and description correctly', async () => {
      await stripeService.createCheckoutSession(
        defaultParams.customerId,
        42,
        'Fix Critical Bug',
        250,
        defaultParams.successUrl,
        defaultParams.cancelUrl
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: expect.objectContaining({
              product_data: {
                name: 'Bounty: Fix Critical Bug',
                description: 'Escrow payment for bounty #42',
              },
            }),
            quantity: 1,
          }],
        })
      );
    });

    it('should correctly convert amount to cents', async () => {
      await stripeService.createCheckoutSession(
        defaultParams.customerId,
        1,
        'Test',
        199.99,
        defaultParams.successUrl,
        defaultParams.cancelUrl
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: expect.objectContaining({
              unit_amount: 19999,
            }),
            quantity: 1,
          }],
        })
      );
    });

    it('should set success and cancel URLs correctly', async () => {
      const successUrl = 'https://myapp.com/payment/success?session_id={CHECKOUT_SESSION_ID}';
      const cancelUrl = 'https://myapp.com/payment/cancelled';

      await stripeService.createCheckoutSession(
        defaultParams.customerId,
        1,
        'Test',
        100,
        successUrl,
        cancelUrl
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: successUrl,
          cancel_url: cancelUrl,
        })
      );
    });
  });

  describe('createTransfer', () => {
    it('should transfer funds minus 15% platform fee', async () => {
      const result = await stripeService.createTransfer(1000, 'acct_winner123', 1);

      // 1000 - 15% = 850 dollars = 85000 cents
      expect(mockStripe.transfers.create).toHaveBeenCalledTimes(1);
      expect(mockStripe.transfers.create).toHaveBeenCalledWith({
        amount: 85000,
        currency: 'usd',
        destination: 'acct_winner123',
        metadata: {
          bountyId: '1',
          type: 'bounty_payout',
        },
      });
      expect(result.id).toBe('tr_test123');
    });

    it('should calculate 15% platform fee correctly for various amounts', async () => {
      // Test with $100 bounty
      await stripeService.createTransfer(100, 'acct_test', 1);
      expect(mockStripe.transfers.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          amount: 8500, // $100 - 15% = $85 = 8500 cents
        })
      );

      vi.clearAllMocks();

      // Test with $500 bounty
      await stripeService.createTransfer(500, 'acct_test', 2);
      expect(mockStripe.transfers.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          amount: 42500, // $500 - 15% = $425 = 42500 cents
        })
      );

      vi.clearAllMocks();

      // Test with $10,000 bounty
      await stripeService.createTransfer(10000, 'acct_test', 3);
      expect(mockStripe.transfers.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          amount: 850000, // $10,000 - 15% = $8,500 = 850000 cents
        })
      );
    });

    it('should include bountyId in transfer metadata', async () => {
      const bountyId = 123;
      await stripeService.createTransfer(100, 'acct_test', bountyId);

      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            bountyId: '123',
            type: 'bounty_payout',
          },
        })
      );
    });

    it('should send funds to the correct destination account', async () => {
      const destinationAccount = 'acct_winner_specific';
      await stripeService.createTransfer(100, destinationAccount, 1);

      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: destinationAccount,
        })
      );
    });

    it('should set currency to USD for transfers', async () => {
      await stripeService.createTransfer(100, 'acct_test', 1);

      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'usd',
        })
      );
    });

    it('should handle fractional cent amounts by rounding', async () => {
      // $99.99 - 15% = $84.9915, which rounds to 8499 cents
      await stripeService.createTransfer(99.99, 'acct_test', 1);

      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 8499, // Math.round(99.99 * 0.85 * 100)
        })
      );
    });
  });

  describe('createSubscriptionCheckout', () => {
    it('should create subscription checkout session', async () => {
      const result = await stripeService.createSubscriptionCheckout(
        'cus_test123',
        'price_pro_monthly',
        'user-123',
        'https://app.example.com/success',
        'https://app.example.com/cancel'
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        payment_method_types: ['card'],
        line_items: [{
          price: 'price_pro_monthly',
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: 'https://app.example.com/success',
        cancel_url: 'https://app.example.com/cancel',
        metadata: {
          userId: 'user-123',
          type: 'subscription',
        },
      });
      expect(result.id).toBe('cs_test123');
    });

    it('should include userId in subscription metadata', async () => {
      const userId = 'user-premium';
      await stripeService.createSubscriptionCheckout(
        'cus_test123',
        'price_test',
        userId,
        'https://success.com',
        'https://cancel.com'
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            userId,
            type: 'subscription',
          },
        })
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel a subscription', async () => {
      const result = await stripeService.cancelSubscription('sub_test123');

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test123');
      expect(result.status).toBe('canceled');
    });
  });

  describe('getOrCreatePrices', () => {
    it('should return existing products and prices when they exist', async () => {
      // Mock existing products
      mockStripe.products.list.mockResolvedValueOnce({
        data: [
          { id: 'prod_pro', metadata: { tier: 'pro' } },
          { id: 'prod_enterprise', metadata: { tier: 'enterprise' } },
        ],
      });
      mockStripe.prices.list.mockResolvedValueOnce({
        data: [
          { id: 'price_pro', product: 'prod_pro', recurring: { interval: 'month' } },
          { id: 'price_enterprise', product: 'prod_enterprise', recurring: { interval: 'month' } },
        ],
      });

      const result = await stripeService.getOrCreatePrices();

      expect(mockStripe.products.create).not.toHaveBeenCalled();
      expect(mockStripe.prices.create).not.toHaveBeenCalled();
      expect(result.pro.productId).toBe('prod_pro');
      expect(result.pro.priceId).toBe('price_pro');
      expect(result.enterprise.productId).toBe('prod_enterprise');
      expect(result.enterprise.priceId).toBe('price_enterprise');
    });

    it('should create products if they do not exist', async () => {
      mockStripe.products.list.mockResolvedValueOnce({ data: [] });
      mockStripe.products.create
        .mockResolvedValueOnce({ id: 'prod_new_pro' })
        .mockResolvedValueOnce({ id: 'prod_new_enterprise' });
      mockStripe.prices.list.mockResolvedValueOnce({ data: [] });
      mockStripe.prices.create
        .mockResolvedValueOnce({ id: 'price_new_pro' })
        .mockResolvedValueOnce({ id: 'price_new_enterprise' });

      const result = await stripeService.getOrCreatePrices();

      expect(mockStripe.products.create).toHaveBeenCalledTimes(2);
      expect(mockStripe.products.create).toHaveBeenCalledWith({
        name: 'Pro Plan',
        description: 'Unlimited bounties, priority support, advanced analytics',
        metadata: { tier: 'pro' },
      });
      expect(mockStripe.products.create).toHaveBeenCalledWith({
        name: 'Enterprise Plan',
        description: 'Custom SLAs, dedicated agents, compliance tools, API access',
        metadata: { tier: 'enterprise' },
      });
      expect(result.pro.productId).toBe('prod_new_pro');
      expect(result.enterprise.productId).toBe('prod_new_enterprise');
    });

    it('should create prices with correct amounts', async () => {
      mockStripe.products.list.mockResolvedValueOnce({
        data: [{ id: 'prod_pro', metadata: { tier: 'pro' } }],
      });
      mockStripe.products.create.mockResolvedValueOnce({ id: 'prod_enterprise' });
      mockStripe.prices.list.mockResolvedValueOnce({ data: [] });
      mockStripe.prices.create
        .mockResolvedValueOnce({ id: 'price_pro' })
        .mockResolvedValueOnce({ id: 'price_enterprise' });

      await stripeService.getOrCreatePrices();

      expect(mockStripe.prices.create).toHaveBeenCalledWith({
        product: 'prod_pro',
        unit_amount: 9900, // $99
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      expect(mockStripe.prices.create).toHaveBeenCalledWith({
        product: 'prod_enterprise',
        unit_amount: 99900, // $999
        currency: 'usd',
        recurring: { interval: 'month' },
      });
    });
  });

  describe('error handling', () => {
    it('should propagate Stripe API errors', async () => {
      const stripeError = new Error('Card declined');
      mockStripe.customers.create.mockRejectedValueOnce(stripeError);

      await expect(stripeService.createCustomer('test@example.com', 'user-123'))
        .rejects.toThrow('Card declined');
    });

    it('should propagate payment intent capture errors', async () => {
      const stripeError = new Error('Payment intent not found');
      mockStripe.paymentIntents.capture.mockRejectedValueOnce(stripeError);

      await expect(stripeService.capturePayment('pi_invalid'))
        .rejects.toThrow('Payment intent not found');
    });

    it('should propagate refund errors', async () => {
      const stripeError = new Error('Charge already refunded');
      mockStripe.refunds.create.mockRejectedValueOnce(stripeError);

      await expect(stripeService.refundPayment('pi_already_refunded'))
        .rejects.toThrow('Charge already refunded');
    });
  });

  describe('StripeService class instantiation', () => {
    it('should be able to create new instances', () => {
      const service = new StripeService();
      expect(service).toBeInstanceOf(StripeService);
    });

    it('should have all required methods', () => {
      const service = new StripeService();
      expect(typeof service.createCustomer).toBe('function');
      expect(typeof service.createPaymentIntent).toBe('function');
      expect(typeof service.capturePayment).toBe('function');
      expect(typeof service.refundPayment).toBe('function');
      expect(typeof service.createCheckoutSession).toBe('function');
      expect(typeof service.createTransfer).toBe('function');
      expect(typeof service.createSubscriptionCheckout).toBe('function');
      expect(typeof service.cancelSubscription).toBe('function');
      expect(typeof service.getOrCreatePrices).toBe('function');
    });
  });
});
