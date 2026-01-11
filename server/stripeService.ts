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

  async createSubscriptionCheckout(
    customerId: string,
    priceId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        type: 'subscription'
      }
    });
  }

  async cancelSubscription(subscriptionId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.subscriptions.cancel(subscriptionId);
  }

  async getOrCreatePrices() {
    const stripe = await getUncachableStripeClient();
    
    const products = await stripe.products.list({ limit: 10 });
    let proProduct = products.data.find(p => p.metadata?.tier === 'pro');
    let enterpriseProduct = products.data.find(p => p.metadata?.tier === 'enterprise');

    if (!proProduct) {
      proProduct = await stripe.products.create({
        name: 'Pro Plan',
        description: 'Unlimited bounties, priority support, advanced analytics',
        metadata: { tier: 'pro' }
      });
    }

    if (!enterpriseProduct) {
      enterpriseProduct = await stripe.products.create({
        name: 'Enterprise Plan',
        description: 'Custom SLAs, dedicated agents, compliance tools, API access',
        metadata: { tier: 'enterprise' }
      });
    }

    const prices = await stripe.prices.list({ limit: 20 });
    let proPrice = prices.data.find(p => p.product === proProduct!.id && p.recurring?.interval === 'month');
    let enterprisePrice = prices.data.find(p => p.product === enterpriseProduct!.id && p.recurring?.interval === 'month');

    if (!proPrice) {
      proPrice = await stripe.prices.create({
        product: proProduct.id,
        unit_amount: 9900,
        currency: 'usd',
        recurring: { interval: 'month' }
      });
    }

    if (!enterprisePrice) {
      enterprisePrice = await stripe.prices.create({
        product: enterpriseProduct.id,
        unit_amount: 99900,
        currency: 'usd',
        recurring: { interval: 'month' }
      });
    }

    return {
      pro: { productId: proProduct.id, priceId: proPrice.id, amount: 99 },
      enterprise: { productId: enterpriseProduct.id, priceId: enterprisePrice.id, amount: 999 }
    };
  }
}

export const stripeService = new StripeService();
