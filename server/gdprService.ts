import { db } from './db';
import { 
  userConsents, dataExportRequests, dataDeletionRequests,
  userProfiles, agents, bounties, submissions, reviews,
  agentUploads, supportTickets, disputes, securityAuditLog
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

interface ConsentUpdate {
  category: string;
  granted: boolean;
  version: string;
}

interface UserDataExport {
  profile: any;
  bounties: any[];
  agents: any[];
  submissions: any[];
  reviews: any[];
  agentUploads: any[];
  supportTickets: any[];
  disputes: any[];
  consents: any[];
  auditLog: any[];
  exportedAt: string;
}

class GDPRService {
  async updateConsent(userId: string, consent: ConsentUpdate, ipAddress?: string, userAgent?: string) {
    const existing = await db
      .select()
      .from(userConsents)
      .where(and(
        eq(userConsents.userId, userId),
        eq(userConsents.category, consent.category as any)
      ));

    if (existing.length > 0) {
      await db
        .update(userConsents)
        .set({
          granted: consent.granted,
          version: consent.version,
          ipAddress,
          userAgent,
          grantedAt: consent.granted ? new Date() : null,
          revokedAt: !consent.granted ? new Date() : null,
        })
        .where(eq(userConsents.id, existing[0].id));
    } else {
      await db.insert(userConsents).values({
        userId,
        category: consent.category as any,
        granted: consent.granted,
        version: consent.version,
        ipAddress,
        userAgent,
        grantedAt: consent.granted ? new Date() : null,
      });
    }
  }

  async getConsents(userId: string) {
    return db.select().from(userConsents).where(eq(userConsents.userId, userId));
  }

  async requestDataExport(userId: string, format: string = 'json'): Promise<number> {
    const [request] = await db.insert(dataExportRequests).values({
      userId,
      format,
    }).returning();
    
    this.processDataExport(request.id, userId, format).catch(console.error);
    
    return request.id;
  }

  private async processDataExport(requestId: number, userId: string, format: string) {
    try {
      await db.update(dataExportRequests)
        .set({ status: 'processing' })
        .where(eq(dataExportRequests.id, requestId));

      const data = await this.collectUserData(userId);
      
      const exportData = format === 'json' 
        ? JSON.stringify(data, null, 2)
        : this.convertToCSV(data);

      const downloadUrl = `data:application/${format};base64,${Buffer.from(exportData).toString('base64')}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.update(dataExportRequests)
        .set({
          status: 'completed',
          downloadUrl,
          expiresAt,
          completedAt: new Date(),
        })
        .where(eq(dataExportRequests.id, requestId));
    } catch (error) {
      await db.update(dataExportRequests)
        .set({ status: 'failed' })
        .where(eq(dataExportRequests.id, requestId));
      throw error;
    }
  }

  private async collectUserData(userId: string): Promise<UserDataExport> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, userId));
    const userBounties = await db.select().from(bounties).where(eq(bounties.posterId, userId));
    const userAgents = await db.select().from(agents).where(eq(agents.developerId, userId));
    const userUploads = await db.select().from(agentUploads).where(eq(agentUploads.developerId, userId));
    const userTickets = await db.select().from(supportTickets).where(eq(supportTickets.userId, userId));
    const userDisputes = await db.select().from(disputes).where(eq(disputes.initiatorId, userId));
    const consents = await db.select().from(userConsents).where(eq(userConsents.userId, userId));
    const auditLog = await db.select().from(securityAuditLog).where(eq(securityAuditLog.userId, userId));

    const agentIds = userAgents.map(a => a.id);
    let userSubmissions: any[] = [];
    let userReviews: any[] = [];
    
    if (agentIds.length > 0) {
      userSubmissions = await db.select().from(submissions);
      userSubmissions = userSubmissions.filter(s => agentIds.includes(s.agentId));
      
      const submissionIds = userSubmissions.map(s => s.id);
      if (submissionIds.length > 0) {
        userReviews = await db.select().from(reviews);
        userReviews = userReviews.filter(r => submissionIds.includes(r.submissionId));
      }
    }

    return {
      profile: profile ? { ...profile, stripeCustomerId: '[REDACTED]', stripeConnectAccountId: '[REDACTED]' } : null,
      bounties: userBounties.map(b => ({ ...b, stripePaymentIntentId: '[REDACTED]', stripeCheckoutSessionId: '[REDACTED]' })),
      agents: userAgents,
      submissions: userSubmissions,
      reviews: userReviews,
      agentUploads: userUploads,
      supportTickets: userTickets,
      disputes: userDisputes,
      consents,
      auditLog: auditLog.map(log => ({ ...log, ipAddress: '[REDACTED]' })),
      exportedAt: new Date().toISOString(),
    };
  }

  private convertToCSV(data: UserDataExport): string {
    const lines: string[] = [];
    
    lines.push('=== USER DATA EXPORT ===');
    lines.push(`Exported At: ${data.exportedAt}`);
    lines.push('');
    
    if (data.profile) {
      lines.push('=== PROFILE ===');
      lines.push(Object.entries(data.profile).map(([k, v]) => `${k}: ${v}`).join('\n'));
      lines.push('');
    }

    if (data.bounties.length > 0) {
      lines.push('=== BOUNTIES ===');
      lines.push(data.bounties.map(b => JSON.stringify(b)).join('\n'));
      lines.push('');
    }

    if (data.agents.length > 0) {
      lines.push('=== AGENTS ===');
      lines.push(data.agents.map(a => JSON.stringify(a)).join('\n'));
      lines.push('');
    }

    return lines.join('\n');
  }

  async getDataExportStatus(requestId: number) {
    const [request] = await db.select().from(dataExportRequests).where(eq(dataExportRequests.id, requestId));
    return request;
  }

  async getDataExportRequests(userId: string) {
    return db.select().from(dataExportRequests).where(eq(dataExportRequests.userId, userId));
  }

  async requestDataDeletion(userId: string, reason?: string): Promise<{ requestId: number; confirmationCode: string }> {
    const confirmationCode = crypto.randomBytes(16).toString('hex').toUpperCase();
    
    const [request] = await db.insert(dataDeletionRequests).values({
      userId,
      reason,
      confirmationCode,
    }).returning();

    return { requestId: request.id, confirmationCode };
  }

  async confirmDataDeletion(requestId: number, confirmationCode: string): Promise<boolean> {
    const [request] = await db.select().from(dataDeletionRequests)
      .where(and(
        eq(dataDeletionRequests.id, requestId),
        eq(dataDeletionRequests.confirmationCode, confirmationCode)
      ));

    if (!request || request.status !== 'pending') {
      return false;
    }

    await db.update(dataDeletionRequests)
      .set({ status: 'processing', confirmedAt: new Date() })
      .where(eq(dataDeletionRequests.id, requestId));

    this.processDataDeletion(requestId, request.userId).catch(console.error);

    return true;
  }

  private async processDataDeletion(requestId: number, userId: string) {
    try {
      await db.delete(securityAuditLog).where(eq(securityAuditLog.userId, userId));
      await db.delete(userConsents).where(eq(userConsents.userId, userId));
      
      await db.update(dataDeletionRequests)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(dataDeletionRequests.id, requestId));
    } catch (error) {
      console.error('Data deletion failed:', error);
      throw error;
    }
  }

  async cancelDataDeletion(requestId: number, userId: string): Promise<boolean> {
    const result = await db.update(dataDeletionRequests)
      .set({ status: 'cancelled' })
      .where(and(
        eq(dataDeletionRequests.id, requestId),
        eq(dataDeletionRequests.userId, userId),
        eq(dataDeletionRequests.status, 'pending' as any)
      ));

    return true;
  }

  async getDeletionRequests(userId: string) {
    return db.select().from(dataDeletionRequests).where(eq(dataDeletionRequests.userId, userId));
  }
}

export const gdprService = new GDPRService();
