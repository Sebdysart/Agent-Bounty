import { getUncachableStripeClient } from './stripeClient';
import { db } from './db';
import { sql } from 'drizzle-orm';

export class StripeService {
  async createCustomer(email: string, userId: string, name?: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });
  }

  async createPaymentIntent(amount: number, customerId: string, bountyId: number) {
    const stripe = await getUncachableStripeClient();
    return await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: customerId,
      metadata: { 
        bountyId: bountyId.toString(),
        type: 'bounty_escrow'
      },
      capture_method: 'manual',
    });
  }

  async capturePayment(paymentIntentId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.paymentIntents.capture(paymentIntentId);
  }

  async refundPayment(paymentIntentId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.refunds.create({
      payment_intent: paymentIntentId,
    });
  }

  async createCheckoutSession(
    customerId: string, 
    bountyId: number,
    bountyTitle: string,
    amount: number, 
    successUrl: string, 
    cancelUrl: string
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Bounty: ${bountyTitle}`,
            description: `Escrow payment for bounty #${bountyId}`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      payment_intent_data: {
        capture_method: 'manual',
        metadata: {
          bountyId: bountyId.toString(),
          type: 'bounty_escrow'
        }
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        bountyId: bountyId.toString(),
      }
    });
  }

  async createTransfer(amount: number, destinationAccountId: string, bountyId: number) {
    const stripe = await getUncachableStripeClient();
    const platformFee = amount * 0.15;
    const transferAmount = amount - platformFee;
    
    return await stripe.transfers.create({
      amount: Math.round(transferAmount * 100),
      currency: 'usd',
      destination: destinationAccountId,
      metadata: {
        bountyId: bountyId.toString(),
        type: 'bounty_payout'
      }
    });
  }

  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }
}

export const stripeService = new StripeService();
