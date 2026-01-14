import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { stripeService } from './stripeService';
import { reputationService } from './reputationService';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }

  static async handleEvent(event: any): Promise<void> {
    console.log(`Processing Stripe event: ${event.type}`);
    
    switch (event.type) {
      case 'checkout.session.completed':
        await WebhookHandlers.handleCheckoutCompleted(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await WebhookHandlers.handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await WebhookHandlers.handlePaymentFailed(event.data.object);
        break;
      case 'charge.captured':
        await WebhookHandlers.handleChargeCaptured(event.data.object);
        break;
      case 'charge.refunded':
        await WebhookHandlers.handleChargeRefunded(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await WebhookHandlers.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await WebhookHandlers.handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  static async handleCheckoutCompleted(session: any): Promise<void> {
    const bountyId = parseInt(session.metadata?.bountyId);
    if (!bountyId) {
      console.log('No bountyId in checkout session metadata');
      return;
    }

    const paymentIntentId = session.payment_intent;
    if (!paymentIntentId) {
      console.log('No payment_intent in checkout session');
      return;
    }

    console.log(`Checkout completed for bounty ${bountyId}, payment intent: ${paymentIntentId}`);
    
    // Update bounty with payment intent ID
    await storage.updateBountyPaymentIntent(bountyId, paymentIntentId);
    
    // Update payment status to funded (escrow held)
    await storage.updateBountyPaymentStatus(bountyId, "funded");
    
    // Transition bounty status from draft/open to active (ready for agents)
    const bounty = await storage.getBounty(bountyId);
    if (bounty && (bounty.status === "open" || bounty.status === "draft")) {
      await storage.updateBountyStatus(bountyId, "open"); // Confirmed open for submissions
    }
    
    // Add timeline event
    await storage.addTimelineEvent(
      bountyId, 
      "funded", 
      "Bounty funded and payment held in escrow. Now accepting agent submissions."
    );
    
    console.log(`Bounty ${bountyId} is now funded and open for submissions`);
  }

  static async handlePaymentSucceeded(paymentIntent: any): Promise<void> {
    const bountyId = parseInt(paymentIntent.metadata?.bountyId);
    if (!bountyId) return;

    console.log(`Payment succeeded for bounty ${bountyId}`);
    
    // This fires when initial authorization succeeds
    // The actual capture happens when we release payment to winner
  }

  static async handlePaymentFailed(paymentIntent: any): Promise<void> {
    const bountyId = parseInt(paymentIntent.metadata?.bountyId);
    if (!bountyId) return;

    console.log(`Payment failed for bounty ${bountyId}`);
    
    await storage.updateBountyPaymentStatus(bountyId, "pending");
    await storage.addTimelineEvent(
      bountyId,
      "payment_failed",
      "Payment authorization failed. Please try funding again."
    );
  }

  static async handleChargeCaptured(charge: any): Promise<void> {
    // This fires when we capture the held payment (release to winner)
    const paymentIntentId = charge.payment_intent;
    if (!paymentIntentId) return;

    // Find bounty by payment intent
    const bounty = await storage.getBountyByPaymentIntent(paymentIntentId);
    if (!bounty) {
      console.log(`No bounty found for payment intent ${paymentIntentId}`);
      return;
    }

    console.log(`Payment captured for bounty ${bounty.id}`);
    
    // Update payment status to released
    await storage.updateBountyPaymentStatus(bounty.id, "released");
    
    // Mark bounty as completed
    await storage.updateBountyStatus(bounty.id, "completed");
    
    // Add timeline event
    await storage.addTimelineEvent(
      bounty.id,
      "payment_released",
      "Payment has been released to the winning agent."
    );
    
    // Update winner agent's reputation
    if (bounty.winnerId) {
      const submission = await storage.getSubmission(bounty.winnerId);
      if (submission) {
        await reputationService.processBountyCompletion(submission.agentId, bounty.id, true);
      }
    }
    
    console.log(`Bounty ${bounty.id} completed and payment released`);
  }

  static async handleChargeRefunded(charge: any): Promise<void> {
    const paymentIntentId = charge.payment_intent;
    if (!paymentIntentId) return;

    const bounty = await storage.getBountyByPaymentIntent(paymentIntentId);
    if (!bounty) return;

    console.log(`Payment refunded for bounty ${bounty.id}`);
    
    await storage.updateBountyPaymentStatus(bounty.id, "refunded");
    await storage.updateBountyStatus(bounty.id, "cancelled");
    
    await storage.addTimelineEvent(
      bounty.id,
      "payment_refunded",
      "Bounty cancelled and payment refunded to poster."
    );
  }

  static async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const customerId = subscription.customer;
    if (!customerId) return;

    const profile = await storage.getUserProfileByStripeCustomerId(customerId);
    if (!profile) {
      console.log(`No user found for customer ${customerId}`);
      return;
    }

    const priceId = subscription.items?.data?.[0]?.price?.id;
    const productId = subscription.items?.data?.[0]?.price?.product;
    
    let tier: "free" | "pro" | "enterprise" = "free";
    if (subscription.status === 'active') {
      const stripe = await getUncachableStripeClient();
      const product = await stripe.products.retrieve(productId as string);
      tier = (product.metadata?.tier as "pro" | "enterprise") || "pro";
    }

    const expiresAt = new Date(subscription.current_period_end * 1000);
    await storage.updateUserSubscription(profile.id, tier, subscription.id, expiresAt);
    console.log(`Subscription updated for user ${profile.id}: ${tier}`);
  }

  static async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const customerId = subscription.customer;
    if (!customerId) return;

    const profile = await storage.getUserProfileByStripeCustomerId(customerId);
    if (!profile) return;

    await storage.updateUserSubscription(profile.id, "free", null, null);
    console.log(`Subscription cancelled for user ${profile.id}`);
  }
}
