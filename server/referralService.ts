import { db } from './db';
import { referrals, referralPayouts, userProfiles } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: string;
  pendingEarnings: string;
  conversionRate: string;
}

const COMMISSION_TIERS = {
  standard: 10,
  silver: 12,
  gold: 15,
  platinum: 20,
};

class ReferralService {
  async generateReferralCode(userId: string): Promise<string> {
    const existing = await db.select()
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), eq(referrals.status, 'active' as any)));

    if (existing.length > 0) {
      return existing[0].referralCode;
    }

    const code = this.createUniqueCode(userId);
    
    await db.insert(referrals).values({
      referrerId: userId,
      referralCode: code,
      status: 'active',
      commissionRate: COMMISSION_TIERS.standard.toString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    return code;
  }

  private createUniqueCode(userId: string): string {
    const hash = crypto.createHash('sha256').update(userId + Date.now()).digest('hex');
    return `REF${hash.substring(0, 8).toUpperCase()}`;
  }

  async validateReferralCode(code: string): Promise<{ valid: boolean; referrerId?: string }> {
    const [referral] = await db.select()
      .from(referrals)
      .where(and(
        eq(referrals.referralCode, code),
        eq(referrals.status, 'active' as any)
      ));

    if (!referral || (referral.expiresAt && referral.expiresAt < new Date())) {
      return { valid: false };
    }

    return { valid: true, referrerId: referral.referrerId };
  }

  async applyReferral(referralCode: string, newUserId: string): Promise<boolean> {
    const validation = await this.validateReferralCode(referralCode);
    if (!validation.valid) return false;

    if (validation.referrerId === newUserId) {
      return false;
    }

    const [existingReferral] = await db.select()
      .from(referrals)
      .where(eq(referrals.referredUserId, newUserId));
    
    if (existingReferral) {
      return false;
    }

    const [referral] = await db.select()
      .from(referrals)
      .where(eq(referrals.referralCode, referralCode));

    if (!referral) return false;

    await db.insert(referrals).values({
      referrerId: referral.referrerId,
      referralCode: `USED_${referralCode}_${Date.now()}`,
      referredUserId: newUserId,
      status: 'converted',
      commissionRate: referral.commissionRate,
      conversionDate: new Date(),
    });

    await db.update(referrals)
      .set({ 
        lifetimeReferrals: sql`${referrals.lifetimeReferrals} + 1`,
      })
      .where(eq(referrals.id, referral.id));

    return true;
  }

  async recordCommission(
    referrerId: string,
    amount: number,
    sourceType: string,
    sourceId: number
  ): Promise<void> {
    const [referral] = await db.select()
      .from(referrals)
      .where(and(eq(referrals.referrerId, referrerId), eq(referrals.status, 'active' as any)));

    if (!referral) return;

    const commissionRate = parseFloat(referral.commissionRate || '10') / 100;
    const commissionAmount = amount * commissionRate;

    await db.insert(referralPayouts).values({
      referralId: referral.id,
      referrerId,
      amount: commissionAmount.toFixed(2),
      sourceType,
      sourceId,
      status: 'pending',
    });

    await db.update(referrals)
      .set({ 
        totalEarnings: sql`COALESCE(${referrals.totalEarnings}, 0) + ${commissionAmount}`,
      })
      .where(eq(referrals.id, referral.id));
  }

  async getReferralStats(userId: string): Promise<ReferralStats> {
    const userReferrals = await db.select()
      .from(referrals)
      .where(eq(referrals.referrerId, userId));

    const activeCode = userReferrals.find(r => r.status === 'active');
    const converted = userReferrals.filter(r => r.status === 'converted');
    
    const totalEarnings = userReferrals.reduce(
      (sum, r) => sum + parseFloat(r.totalEarnings || '0'), 0
    );

    const pendingPayouts = await db.select()
      .from(referralPayouts)
      .where(and(eq(referralPayouts.referrerId, userId), eq(referralPayouts.status, 'pending')));

    const pendingAmount = pendingPayouts.reduce(
      (sum, p) => sum + parseFloat(p.amount || '0'), 0
    );

    const conversionRate = activeCode?.lifetimeReferrals 
      ? (converted.length / (activeCode.lifetimeReferrals || 1) * 100).toFixed(1)
      : '0';

    return {
      totalReferrals: activeCode?.lifetimeReferrals || 0,
      activeReferrals: converted.length,
      totalEarnings: totalEarnings.toFixed(2),
      pendingEarnings: pendingAmount.toFixed(2),
      conversionRate,
    };
  }

  async getReferralCode(userId: string): Promise<string | null> {
    const [referral] = await db.select()
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), eq(referrals.status, 'active' as any)));

    return referral?.referralCode || null;
  }

  async getPayoutHistory(userId: string) {
    return db.select()
      .from(referralPayouts)
      .where(eq(referralPayouts.referrerId, userId))
      .orderBy(desc(referralPayouts.createdAt));
  }

  async upgradeCommissionTier(userId: string, tier: keyof typeof COMMISSION_TIERS): Promise<void> {
    const rate = COMMISSION_TIERS[tier];
    
    await db.update(referrals)
      .set({ commissionRate: rate.toString() })
      .where(and(eq(referrals.referrerId, userId), eq(referrals.status, 'active' as any)));
  }

  async processPayouts(): Promise<number> {
    const pendingPayouts = await db.select()
      .from(referralPayouts)
      .where(eq(referralPayouts.status, 'pending'));

    let processed = 0;
    for (const payout of pendingPayouts) {
      try {
        await db.update(referralPayouts)
          .set({ status: 'completed', paidAt: new Date() })
          .where(eq(referralPayouts.id, payout.id));
        processed++;
      } catch (error) {
        console.error(`Failed to process payout ${payout.id}:`, error);
      }
    }

    return processed;
  }
}

export const referralService = new ReferralService();
