import { db } from "./db";
import { 
  onboardingProgress,
  type OnboardingProgress 
} from "@shared/schema";
import { eq } from "drizzle-orm";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action: string;
  forRoles: ("business" | "developer")[];
  order: number;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to BountyAI",
    description: "Learn about how our AI bounty marketplace works",
    action: "view_tour",
    forRoles: ["business", "developer"],
    order: 1,
  },
  {
    id: "profile",
    title: "Complete Your Profile",
    description: "Set up your profile with your skills and preferences",
    action: "complete_profile",
    forRoles: ["business", "developer"],
    order: 2,
  },
  {
    id: "create_bounty",
    title: "Post Your First Bounty",
    description: "Create a bounty to get AI agents working on your task",
    action: "create_bounty",
    forRoles: ["business"],
    order: 3,
  },
  {
    id: "register_agent",
    title: "Register Your First Agent",
    description: "Add your AI agent to compete for bounties",
    action: "register_agent",
    forRoles: ["developer"],
    order: 3,
  },
  {
    id: "browse_bounties",
    title: "Explore Available Bounties",
    description: "Browse bounties that match your agent's capabilities",
    action: "browse_bounties",
    forRoles: ["developer"],
    order: 4,
  },
  {
    id: "review_agents",
    title: "Review Available Agents",
    description: "Explore AI agents that can complete your bounties",
    action: "browse_agents",
    forRoles: ["business"],
    order: 4,
  },
  {
    id: "submit_bounty",
    title: "Make Your First Submission",
    description: "Submit your agent to complete a bounty",
    action: "submit_bounty",
    forRoles: ["developer"],
    order: 5,
  },
  {
    id: "analytics",
    title: "Track Your Performance",
    description: "Learn how to use analytics to improve your results",
    action: "view_analytics",
    forRoles: ["business", "developer"],
    order: 6,
  },
];

class OnboardingService {
  async initializeOnboarding(userId: string): Promise<OnboardingProgress> {
    const existing = await db.select().from(onboardingProgress)
      .where(eq(onboardingProgress.userId, userId));
    
    if (existing.length > 0) return existing[0];

    const [progress] = await db.insert(onboardingProgress).values({
      userId,
      currentStep: 1,
      completedSteps: [],
      skippedSteps: [],
    }).returning();

    return progress;
  }

  async setRole(userId: string, role: "business" | "developer"): Promise<OnboardingProgress> {
    const [progress] = await db.update(onboardingProgress)
      .set({ role, updatedAt: new Date() })
      .where(eq(onboardingProgress.userId, userId))
      .returning();
    return progress;
  }

  async setGoals(userId: string, goals: string[]): Promise<OnboardingProgress> {
    const [progress] = await db.update(onboardingProgress)
      .set({ goals, updatedAt: new Date() })
      .where(eq(onboardingProgress.userId, userId))
      .returning();
    return progress;
  }

  async completeStep(userId: string, stepId: string): Promise<OnboardingProgress> {
    const [current] = await db.select().from(onboardingProgress)
      .where(eq(onboardingProgress.userId, userId));
    
    if (!current) {
      return this.initializeOnboarding(userId);
    }

    const completedSteps = [...(current.completedSteps || [])];
    if (!completedSteps.includes(stepId)) {
      completedSteps.push(stepId);
    }

    const updates: Partial<OnboardingProgress> = {
      completedSteps,
      updatedAt: new Date(),
    };

    if (stepId === "welcome") updates.tourCompleted = true;
    if (stepId === "profile") updates.profileCompleted = true;
    if (stepId === "create_bounty") updates.firstBountyCreated = true;
    if (stepId === "register_agent") updates.firstAgentRegistered = true;
    if (stepId === "submit_bounty") updates.firstSubmission = true;

    const userSteps = this.getStepsForRole(current.role);
    const currentStepIndex = userSteps.findIndex(s => s.id === stepId);
    if (currentStepIndex >= 0 && currentStepIndex + 1 < userSteps.length) {
      updates.currentStep = currentStepIndex + 2;
    }

    const allCompleted = userSteps.every(s => 
      completedSteps.includes(s.id) || (current.skippedSteps || []).includes(s.id)
    );
    if (allCompleted) {
      updates.completedAt = new Date();
    }

    const [progress] = await db.update(onboardingProgress)
      .set(updates)
      .where(eq(onboardingProgress.userId, userId))
      .returning();

    return progress;
  }

  async skipStep(userId: string, stepId: string): Promise<OnboardingProgress> {
    const [current] = await db.select().from(onboardingProgress)
      .where(eq(onboardingProgress.userId, userId));
    
    if (!current) {
      return this.initializeOnboarding(userId);
    }

    const skippedSteps = [...(current.skippedSteps || [])];
    if (!skippedSteps.includes(stepId)) {
      skippedSteps.push(stepId);
    }

    const userSteps = this.getStepsForRole(current.role);
    const currentStepIndex = userSteps.findIndex(s => s.id === stepId);
    const nextStep = currentStepIndex >= 0 ? currentStepIndex + 2 : current.currentStep;

    const [progress] = await db.update(onboardingProgress)
      .set({ 
        skippedSteps, 
        currentStep: nextStep,
        updatedAt: new Date() 
      })
      .where(eq(onboardingProgress.userId, userId))
      .returning();

    return progress;
  }

  getStepsForRole(role?: "business" | "developer" | null): OnboardingStep[] {
    if (!role) return ONBOARDING_STEPS.filter(s => s.order <= 2);
    return ONBOARDING_STEPS
      .filter(s => s.forRoles.includes(role))
      .sort((a, b) => a.order - b.order);
  }

  async getProgress(userId: string): Promise<{
    progress: OnboardingProgress | null;
    steps: OnboardingStep[];
    currentStep: OnboardingStep | null;
    percentComplete: number;
  }> {
    const [progress] = await db.select().from(onboardingProgress)
      .where(eq(onboardingProgress.userId, userId));

    if (!progress) {
      return {
        progress: null,
        steps: ONBOARDING_STEPS.filter(s => s.order <= 2),
        currentStep: ONBOARDING_STEPS[0],
        percentComplete: 0,
      };
    }

    const steps = this.getStepsForRole(progress.role);
    const completed = (progress.completedSteps || []).length;
    const skipped = (progress.skippedSteps || []).length;
    const percentComplete = steps.length > 0 
      ? Math.round(((completed + skipped) / steps.length) * 100)
      : 0;

    const currentStepIndex = (progress.currentStep || 1) - 1;
    const currentStep = steps[currentStepIndex] || null;

    return {
      progress,
      steps,
      currentStep,
      percentComplete,
    };
  }

  async isOnboardingComplete(userId: string): Promise<boolean> {
    const [progress] = await db.select().from(onboardingProgress)
      .where(eq(onboardingProgress.userId, userId));
    return progress?.completedAt !== null;
  }

  async resetOnboarding(userId: string): Promise<OnboardingProgress> {
    await db.delete(onboardingProgress).where(eq(onboardingProgress.userId, userId));
    return this.initializeOnboarding(userId);
  }
}

export const onboardingService = new OnboardingService();
