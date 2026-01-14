/**
 * Webhook Handlers Tests - Stripe payment lifecycle events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createMockBounty, 
  createMockCheckoutCompletedEvent,
  createMockChargeCapturedEvent,
  createMockChargeRefundedEvent,
} from './factories';

// Mock storage
const mockStorage = {
  getBounty: vi.fn(),
  getBountyByPaymentIntent: vi.fn(),
  updateBountyPaymentIntent: vi.fn(),
  updateBountyPaymentStatus: vi.fn(),
  updateBountyStatus: vi.fn(),
  addTimelineEvent: vi.fn(),
  getSubmission: vi.fn(),
  getUserProfileByStripeCustomerId: vi.fn(),
  updateUserSubscription: vi.fn(),
};

vi.mock('../storage', () => ({
  storage: mockStorage,
}));

// Mock reputationService
vi.mock('../reputationService', () => ({
  reputationService: {
    processBountyCompletion: vi.fn(),
  },
}));

// Import after mocking
const { WebhookHandlers } = await import('../webhookHandlers');

describe('WebhookHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleCheckoutCompleted', () => {
    it('should update bounty with payment intent and mark as funded', async () => {
      const bounty = createMockBounty({ id: 1, status: 'open', paymentStatus: 'pending' });
      mockStorage.getBounty.mockResolvedValue(bounty);
      
      const event = createMockCheckoutCompletedEvent(1, 'pi_test123');
      await WebhookHandlers.handleCheckoutCompleted(event.data.object);
      
      expect(mockStorage.updateBountyPaymentIntent).toHaveBeenCalledWith(1, 'pi_test123');
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'funded');
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(
        1,
        'funded',
        expect.stringContaining('funded')
      );
    });

    it('should skip if no bountyId in metadata', async () => {
      const event = { metadata: {}, payment_intent: 'pi_123' };
      await WebhookHandlers.handleCheckoutCompleted(event);
      
      expect(mockStorage.updateBountyPaymentIntent).not.toHaveBeenCalled();
    });

    it('should skip if no payment_intent in session', async () => {
      const event = { metadata: { bountyId: '1' } };
      await WebhookHandlers.handleCheckoutCompleted(event);
      
      expect(mockStorage.updateBountyPaymentIntent).not.toHaveBeenCalled();
    });
  });

  describe('handleChargeCaptured', () => {
    it('should mark bounty as completed and payment as released', async () => {
      const bounty = createMockBounty({ 
        id: 1, 
        status: 'under_review', 
        paymentStatus: 'funded',
        winnerId: 5,
      });
      mockStorage.getBountyByPaymentIntent.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue({ id: 5, agentId: 10 });
      
      const event = createMockChargeCapturedEvent('pi_test123');
      await WebhookHandlers.handleChargeCaptured(event.data.object);
      
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'released');
      expect(mockStorage.updateBountyStatus).toHaveBeenCalledWith(1, 'completed');
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(
        1,
        'payment_released',
        expect.stringContaining('released')
      );
    });

    it('should skip if no bounty found for payment intent', async () => {
      mockStorage.getBountyByPaymentIntent.mockResolvedValue(null);
      
      const event = createMockChargeCapturedEvent('pi_unknown');
      await WebhookHandlers.handleChargeCaptured(event.data.object);
      
      expect(mockStorage.updateBountyPaymentStatus).not.toHaveBeenCalled();
    });
  });

  describe('handleChargeRefunded', () => {
    it('should mark bounty as cancelled and payment as refunded', async () => {
      const bounty = createMockBounty({ 
        id: 1, 
        status: 'open', 
        paymentStatus: 'funded',
      });
      mockStorage.getBountyByPaymentIntent.mockResolvedValue(bounty);
      
      const event = createMockChargeRefundedEvent('pi_test123');
      await WebhookHandlers.handleChargeRefunded(event.data.object);
      
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'refunded');
      expect(mockStorage.updateBountyStatus).toHaveBeenCalledWith(1, 'cancelled');
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(
        1,
        'payment_refunded',
        expect.stringContaining('refunded')
      );
    });
  });

  describe('handlePaymentFailed', () => {
    it('should reset payment status to pending', async () => {
      const paymentIntent = {
        metadata: { bountyId: '1' },
      };
      
      await WebhookHandlers.handlePaymentFailed(paymentIntent);
      
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'pending');
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(
        1,
        'payment_failed',
        expect.stringContaining('failed')
      );
    });
  });

  describe('handleEvent', () => {
    it('should route checkout.session.completed to correct handler', async () => {
      const bounty = createMockBounty({ id: 1 });
      mockStorage.getBounty.mockResolvedValue(bounty);
      
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            payment_intent: 'pi_test123',
            metadata: { bountyId: '1' },
          },
        },
      };
      
      await WebhookHandlers.handleEvent(event);
      
      expect(mockStorage.updateBountyPaymentIntent).toHaveBeenCalled();
    });

    it('should route charge.captured to correct handler', async () => {
      const bounty = createMockBounty({ id: 1 });
      mockStorage.getBountyByPaymentIntent.mockResolvedValue(bounty);
      
      const event = {
        type: 'charge.captured',
        data: {
          object: {
            payment_intent: 'pi_test123',
          },
        },
      };
      
      await WebhookHandlers.handleEvent(event);
      
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'released');
    });

    it('should log unhandled event types', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      await WebhookHandlers.handleEvent({ type: 'unknown.event', data: {} });
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unhandled'));
    });
  });
});
