/**
 * Stripe Service Tests - Payment system critical path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStripe } from './setup';

// Re-mock stripeClient for this specific test file
vi.mock('../stripeClient', () => ({
  getUncachableStripeClient: vi.fn().mockResolvedValue(mockStripe),
}));

// Import after mocking
const { stripeService } = await import('../stripeService');

describe('StripeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCustomer', () => {
    it('should create a Stripe customer with email and userId', async () => {
      const result = await stripeService.createCustomer('test@example.com', 'user_123', 'Test User');
      
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user_123' },
      });
      expect(result.id).toBe('cus_test123');
    });

    it('should create customer without name if not provided', async () => {
      await stripeService.createCustomer('test@example.com', 'user_123');
      
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: undefined,
        metadata: { userId: 'user_123' },
      });
    });
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent with manual capture for escrow', async () => {
      const result = await stripeService.createPaymentIntent(1000, 'cus_123', 1);
      
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 100000, // Converted to cents
        currency: 'usd',
        customer: 'cus_123',
        metadata: { 
          bountyId: '1',
          type: 'bounty_escrow'
        },
        capture_method: 'manual', // Critical for escrow!
      });
      expect(result.id).toBe('pi_test123');
    });

    it('should correctly convert dollars to cents', async () => {
      await stripeService.createPaymentIntent(99.99, 'cus_123', 1);
      
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 9999 })
      );
    });
  });

  describe('capturePayment', () => {
    it('should capture a held payment intent (release escrow)', async () => {
      const result = await stripeService.capturePayment('pi_test123');
      
      expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith('pi_test123');
      expect(result.status).toBe('succeeded');
    });
  });

  describe('refundPayment', () => {
    it('should refund a payment intent for cancelled bounties', async () => {
      const result = await stripeService.refundPayment('pi_test123');
      
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test123',
      });
      expect(result.status).toBe('succeeded');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session with escrow configuration', async () => {
      const result = await stripeService.createCheckoutSession(
        'cus_123',
        1,
        'Test Bounty',
        1000,
        'https://app.com/success',
        'https://app.com/cancel'
      );
      
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Bounty: Test Bounty',
              description: 'Escrow payment for bounty #1',
            },
            unit_amount: 100000,
          },
          quantity: 1,
        }],
        mode: 'payment',
        payment_intent_data: {
          capture_method: 'manual', // Critical for escrow!
          metadata: {
            bountyId: '1',
            type: 'bounty_escrow'
          }
        },
        success_url: 'https://app.com/success',
        cancel_url: 'https://app.com/cancel',
        metadata: {
          bountyId: '1',
        }
      });
      expect(result.url).toBe('https://checkout.stripe.com/test');
    });
  });

  describe('createTransfer', () => {
    it('should transfer funds to winner with 15% platform fee', async () => {
      const result = await stripeService.createTransfer(1000, 'acct_winner123', 1);
      
      // 1000 - 15% = 850 dollars = 85000 cents
      expect(mockStripe.transfers.create).toHaveBeenCalledWith({
        amount: 85000,
        currency: 'usd',
        destination: 'acct_winner123',
        metadata: {
          bountyId: '1',
          type: 'bounty_payout'
        }
      });
    });
  });
});
