import { db } from "./db";
import { 
  verificationAudits, bounties, submissions,
  type VerificationAudit 
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import OpenAI from "openai";

interface CriteriaCheck {
  criterion: string;
  passed: boolean;
  score: number;
  reasoning: string;
}

class VerificationService {
  private openai: OpenAI | null = null;

  private getOpenAI(): OpenAI | null {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not configured - AI verification disabled");
      return null;
    }
    if (!this.openai) {
      this.openai = new OpenAI();
    }
    return this.openai;
  }
  
  isOpenAIConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async createAudit(
    submissionId: number,
    bountyId: number,
    auditorType: "ai" | "human" | "hybrid" = "ai"
  ): Promise<VerificationAudit> {
    const [audit] = await db.insert(verificationAudits).values({
      submissionId,
      bountyId,
      auditorType,
      status: "pending",
    }).returning();

    return audit;
  }

  async runAiVerification(auditId: number): Promise<VerificationAudit> {
    const [audit] = await db.select().from(verificationAudits)
      .where(eq(verificationAudits.id, auditId));
    
    if (!audit) throw new Error("Audit not found");

    await db.update(verificationAudits)
      .set({ status: "in_progress" })
      .where(eq(verificationAudits.id, auditId));

    const [bounty] = await db.select().from(bounties)
      .where(eq(bounties.id, audit.bountyId));
    
    const [submission] = await db.select().from(submissions)
      .where(eq(submissions.id, audit.submissionId));

    if (!bounty || !submission) {
      throw new Error("Bounty or submission not found");
    }

    const startTime = Date.now();

    try {
      const openai = this.getOpenAI();
      
      if (!openai) {
        const [updated] = await db.update(verificationAudits)
          .set({
            status: "needs_review",
            aiAnalysis: "AI verification unavailable - OpenAI API key not configured. Manual review required.",
            overallScore: "50",
            confidence: "0",
            executionTimeMs: Date.now() - startTime,
          })
          .where(eq(verificationAudits.id, auditId))
          .returning();
        return updated;
      }
      
      const verificationPrompt = `You are an AI verification auditor. Evaluate if the following submission meets the bounty requirements.

BOUNTY TITLE: ${bounty.title}
BOUNTY DESCRIPTION: ${bounty.description}
SUCCESS CRITERIA: ${bounty.successMetrics || "Not specified"}
VERIFICATION CRITERIA: ${bounty.verificationCriteria || "Not specified"}

SUBMISSION:
${submission.output || "No output data provided"}

Please evaluate each success criterion and provide:
1. Whether each criterion is met (pass/fail)
2. A score from 0-100 for each criterion
3. Brief reasoning for each decision
4. Overall assessment and confidence level

Respond in JSON format:
{
  "criteriaChecks": [
    { "criterion": "...", "passed": true/false, "score": 0-100, "reasoning": "..." }
  ],
  "overallScore": 0-100,
  "confidence": 0-100,
  "summary": "Overall assessment text",
  "recommendation": "pass" | "fail" | "needs_review"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: verificationPrompt }],
        response_format: { type: "json_object" },
      });

      const executionTimeMs = Date.now() - startTime;
      const analysisText = response.choices[0]?.message?.content || "{}";
      
      let analysis: any;
      try {
        analysis = JSON.parse(analysisText);
      } catch {
        analysis = { 
          criteriaChecks: [], 
          overallScore: 50, 
          confidence: 50, 
          summary: analysisText,
          recommendation: "needs_review" 
        };
      }

      const criteriaChecks: CriteriaCheck[] = analysis.criteriaChecks || [];
      const passedCriteria = criteriaChecks.filter(c => c.passed).length;
      const totalCriteria = criteriaChecks.length || 1;
      
      let status: "passed" | "failed" | "needs_review";
      if (analysis.recommendation === "pass" && analysis.overallScore >= 70) {
        status = "passed";
      } else if (analysis.recommendation === "fail" || analysis.overallScore < 40) {
        status = "failed";
      } else {
        status = "needs_review";
      }

      const [updated] = await db.update(verificationAudits)
        .set({
          status,
          criteriaChecks: JSON.stringify(criteriaChecks),
          overallScore: String(analysis.overallScore),
          confidence: String(analysis.confidence),
          aiAnalysis: analysis.summary,
          passedCriteria,
          totalCriteria,
          executionTimeMs,
          reviewedAt: new Date(),
        })
        .where(eq(verificationAudits.id, auditId))
        .returning();

      return updated;
    } catch (error: any) {
      await db.update(verificationAudits)
        .set({
          status: "needs_review",
          aiAnalysis: `AI verification failed: ${error.message}`,
          executionTimeMs: Date.now() - startTime,
        })
        .where(eq(verificationAudits.id, auditId));

      throw error;
    }
  }

  async verifySubmission(
    submissionId: number,
    bountyId: number
  ): Promise<VerificationAudit> {
    const audit = await this.createAudit(submissionId, bountyId, "ai");
    return this.runAiVerification(audit.id);
  }

  async addHumanReview(
    auditId: number,
    reviewerId: string,
    notes: string,
    decision: "passed" | "failed"
  ): Promise<VerificationAudit> {
    const [updated] = await db.update(verificationAudits)
      .set({
        status: decision,
        humanNotes: notes,
        assignedReviewerId: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(verificationAudits.id, auditId))
      .returning();

    return updated;
  }

  async getAudit(auditId: number): Promise<VerificationAudit | null> {
    const [audit] = await db.select().from(verificationAudits)
      .where(eq(verificationAudits.id, auditId));
    return audit || null;
  }

  async getSubmissionAudits(submissionId: number): Promise<VerificationAudit[]> {
    return db.select().from(verificationAudits)
      .where(eq(verificationAudits.submissionId, submissionId))
      .orderBy(desc(verificationAudits.createdAt));
  }

  async getBountyAudits(bountyId: number): Promise<VerificationAudit[]> {
    return db.select().from(verificationAudits)
      .where(eq(verificationAudits.bountyId, bountyId))
      .orderBy(desc(verificationAudits.createdAt));
  }

  async getPendingReviews(): Promise<VerificationAudit[]> {
    return db.select().from(verificationAudits)
      .where(eq(verificationAudits.status, "needs_review"))
      .orderBy(desc(verificationAudits.createdAt));
  }

  async getVerificationStats(): Promise<{
    total: number;
    passed: number;
    failed: number;
    needsReview: number;
    avgScore: number;
    avgConfidence: number;
  }> {
    const audits = await db.select().from(verificationAudits);
    
    const passed = audits.filter(a => a.status === "passed").length;
    const failed = audits.filter(a => a.status === "failed").length;
    const needsReview = audits.filter(a => a.status === "needs_review").length;
    
    const withScores = audits.filter(a => a.overallScore);
    const avgScore = withScores.length > 0 
      ? withScores.reduce((sum, a) => sum + Number(a.overallScore || 0), 0) / withScores.length 
      : 0;
    
    const withConfidence = audits.filter(a => a.confidence);
    const avgConfidence = withConfidence.length > 0 
      ? withConfidence.reduce((sum, a) => sum + Number(a.confidence || 0), 0) / withConfidence.length 
      : 0;

    return {
      total: audits.length,
      passed,
      failed,
      needsReview,
      avgScore,
      avgConfidence,
    };
  }
}

export const verificationService = new VerificationService();
