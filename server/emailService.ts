import { sanitizeHtml, stripHtml } from "./validationSchemas";

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface EmailConfig {
  apiKey?: string;
  from?: string;
}

class EmailService {
  private config: EmailConfig;
  private enabled: boolean = false;

  constructor() {
    this.config = {
      apiKey: process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY,
      from: process.env.EMAIL_FROM || "noreply@bountyai.com",
    };
    this.enabled = !!this.config.apiKey;
  }

  /**
   * Escapes user input for safe inclusion in HTML email templates
   */
  private escapeForHtml(input: string): string {
    return sanitizeHtml(input);
  }

  /**
   * Strips HTML for plain text email versions
   */
  private escapeForText(input: string): string {
    return stripHtml(input);
  }

  private async send(to: string, template: EmailTemplate): Promise<boolean> {
    if (!this.enabled) {
      console.log(`[Email Service] Would send to ${to}: ${template.subject}`);
      return true;
    }

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: this.config.from },
          subject: template.subject,
          content: [
            { type: "text/plain", value: template.text },
            { type: "text/html", value: template.html },
          ],
        }),
      });
      
      if (!response.ok) {
        console.error("[Email Service] SendGrid error:", response.status, await response.text());
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("[Email Service] Send failed:", error);
      return false;
    }
  }

  private getBaseUrl(): string {
    return process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : "https://bountyai.com";
  }

  async sendBountyFunded(email: string, bountyTitle: string, amount: string): Promise<boolean> {
    const baseUrl = this.getBaseUrl();
    const safeBountyTitle = this.escapeForHtml(bountyTitle);
    const safeAmount = this.escapeForHtml(amount);
    return this.send(email, {
      subject: `Bounty Funded: ${this.escapeForText(bountyTitle)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B5CF6;">Bounty Successfully Funded!</h2>
          <p>Your bounty "<strong>${safeBountyTitle}</strong>" has been funded with <strong>$${safeAmount}</strong>.</p>
          <p>AI agents can now start competing to complete your task. You'll be notified when submissions are received.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-top: 16px;">
            <p style="margin: 0; color: #6b7280;">The funds are held in secure escrow and will only be released when you approve a winning submission.</p>
          </div>
          <a href="${baseUrl}/dashboard" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">View Your Bounty</a>
        </div>
      `,
      text: `Bounty Funded: ${this.escapeForText(bountyTitle)}\n\nYour bounty has been funded with $${this.escapeForText(amount)}. AI agents can now start competing.`,
    });
  }

  async sendSubmissionReceived(email: string, bountyTitle: string, agentName: string): Promise<boolean> {
    const baseUrl = this.getBaseUrl();
    const safeBountyTitle = this.escapeForHtml(bountyTitle);
    const safeAgentName = this.escapeForHtml(agentName);
    return this.send(email, {
      subject: `New Submission: ${this.escapeForText(agentName)} entered ${this.escapeForText(bountyTitle)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B5CF6;">New Agent Submission!</h2>
          <p>Agent "<strong>${safeAgentName}</strong>" has submitted an entry for your bounty "<strong>${safeBountyTitle}</strong>".</p>
          <p>You can track progress and review submissions from your dashboard.</p>
          <a href="${baseUrl}/dashboard" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">Review Submissions</a>
        </div>
      `,
      text: `New Submission: ${this.escapeForText(agentName)} entered ${this.escapeForText(bountyTitle)}\n\nReview submissions from your dashboard.`,
    });
  }

  async sendSubmissionApproved(email: string, bountyTitle: string, agentName: string, reward: string): Promise<boolean> {
    const baseUrl = this.getBaseUrl();
    const safeBountyTitle = this.escapeForHtml(bountyTitle);
    const safeAgentName = this.escapeForHtml(agentName);
    const safeReward = this.escapeForHtml(reward);
    return this.send(email, {
      subject: `Congratulations! Your agent won ${this.escapeForText(bountyTitle)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10B981;">Your Agent Won!</h2>
          <p>Your agent "<strong>${safeAgentName}</strong>" has been selected as the winner for bounty "<strong>${safeBountyTitle}</strong>"!</p>
          <p style="font-size: 24px; font-weight: bold; color: #10B981;">Reward: $${safeReward}</p>
          <p>The payment will be processed and transferred to your account shortly.</p>
          <a href="${baseUrl}/dashboard" style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">View Details</a>
        </div>
      `,
      text: `Congratulations! Your agent "${this.escapeForText(agentName)}" won ${this.escapeForText(bountyTitle)}!\n\nReward: $${this.escapeForText(reward)}`,
    });
  }

  async sendPaymentReleased(email: string, bountyTitle: string, amount: string): Promise<boolean> {
    const safeBountyTitle = this.escapeForHtml(bountyTitle);
    const safeAmount = this.escapeForHtml(amount);
    return this.send(email, {
      subject: `Payment Released: ${this.escapeForText(bountyTitle)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10B981;">Payment Released!</h2>
          <p>You've released the payment for bounty "<strong>${safeBountyTitle}</strong>".</p>
          <p><strong>Amount: $${safeAmount}</strong></p>
          <p>Thank you for using BountyAI! The winning agent developer will receive their payment shortly.</p>
        </div>
      `,
      text: `Payment Released: ${this.escapeForText(bountyTitle)}\n\nAmount: $${this.escapeForText(amount)}`,
    });
  }

  async sendAgentPublished(email: string, agentName: string): Promise<boolean> {
    const baseUrl = this.getBaseUrl();
    const safeAgentName = this.escapeForHtml(agentName);
    return this.send(email, {
      subject: `Your Agent is Live: ${this.escapeForText(agentName)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B5CF6;">Your Agent is Published!</h2>
          <p>Congratulations! Your agent "<strong>${safeAgentName}</strong>" is now live on the BountyAI marketplace.</p>
          <p>Other users can now discover, use, and fork your agent.</p>
          <a href="${baseUrl}/agent-marketplace" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">View in Marketplace</a>
        </div>
      `,
      text: `Your Agent is Live: ${this.escapeForText(agentName)}\n\nYour agent is now available in the marketplace.`,
    });
  }

  async sendAgentForked(email: string, agentName: string, forkerName: string): Promise<boolean> {
    const baseUrl = this.getBaseUrl();
    const safeAgentName = this.escapeForHtml(agentName);
    const safeForkerName = this.escapeForHtml(forkerName);
    return this.send(email, {
      subject: `Your Agent Was Forked: ${this.escapeForText(agentName)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B5CF6;">Someone Forked Your Agent!</h2>
          <p>Your agent "<strong>${safeAgentName}</strong>" was forked by <strong>${safeForkerName}</strong>.</p>
          <p>This means your agent is being recognized and built upon by the community!</p>
          <a href="${baseUrl}/agent-upload" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">View Your Agents</a>
        </div>
      `,
      text: `Your Agent Was Forked: ${this.escapeForText(agentName)} by ${this.escapeForText(forkerName)}`,
    });
  }

  async send2FAEnabled(email: string): Promise<boolean> {
    return this.send(email, {
      subject: "Two-Factor Authentication Enabled",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10B981;">2FA Enabled Successfully</h2>
          <p>Two-factor authentication has been enabled on your BountyAI account.</p>
          <p>You'll now need to enter a verification code when performing sensitive operations.</p>
          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-top: 16px;">
            <p style="margin: 0; color: #92400e;"><strong>Important:</strong> Keep your backup codes in a safe place. They can be used to access your account if you lose your authenticator.</p>
          </div>
        </div>
      `,
      text: "Two-Factor Authentication has been enabled on your BountyAI account.",
    });
  }

  async sendSecurityAlert(email: string, eventType: string, ipAddress?: string): Promise<boolean> {
    const safeEventType = this.escapeForHtml(eventType);
    const safeIpAddress = ipAddress ? this.escapeForHtml(ipAddress) : null;
    return this.send(email, {
      subject: `Security Alert: ${this.escapeForText(eventType)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #EF4444;">Security Alert</h2>
          <p>We detected a security event on your BountyAI account:</p>
          <div style="background: #fee2e2; padding: 16px; border-radius: 8px; margin-top: 16px;">
            <p style="margin: 0;"><strong>Event:</strong> ${safeEventType}</p>
            ${safeIpAddress ? `<p style="margin: 8px 0 0;"><strong>IP Address:</strong> ${safeIpAddress}</p>` : ''}
            <p style="margin: 8px 0 0;"><strong>Time:</strong> ${new Date().toISOString()}</p>
          </div>
          <p style="margin-top: 16px;">If this wasn't you, please secure your account immediately.</p>
        </div>
      `,
      text: `Security Alert: ${this.escapeForText(eventType)}\n\nIf this wasn't you, please secure your account.`,
    });
  }
}

export const emailService = new EmailService();
