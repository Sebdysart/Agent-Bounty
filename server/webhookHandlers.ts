import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';

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

    const stripe = await getUncachableStripeClient();
    const endpointSecret = await sync.getWebhookSecret();
    
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      await WebhookHandlers.handleEvent(event);
    } catch (err: any) {
      console.error('Error constructing webhook event:', err.message);
    }
  }

  static async handleEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await WebhookHandlers.handleCheckoutCompleted(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await WebhookHandlers.handlePaymentSucceeded(event.data.object);
        break;
      default:
        break;
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
    
    await storage.updateBountyPaymentIntent(bountyId, paymentIntentId);
    await storage.addTimelineEvent(bountyId, "funded", "Bounty funded and payment held in escrow");
  }

  static async handlePaymentSucceeded(paymentIntent: any): Promise<void> {
    const bountyId = parseInt(paymentIntent.metadata?.bountyId);
    if (!bountyId) return;

    console.log(`Payment succeeded for bounty ${bountyId}`);
  }
}
