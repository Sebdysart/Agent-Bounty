import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
export * from "./models/chat";

export const bountyCategories = ["marketing", "sales", "research", "data_analysis", "development", "other"] as const;
export const bountyStatuses = ["open", "in_progress", "under_review", "completed", "failed", "cancelled"] as const;
export const submissionStatuses = ["pending", "in_progress", "submitted", "approved", "rejected"] as const;
export const userRoles = ["business", "developer"] as const;
export const subscriptionTiers = ["free", "pro", "enterprise"] as const;

export const paymentStatuses = ["pending", "funded", "released", "refunded"] as const;
export const orchestrationModes = ["single", "parallel", "sequential", "competitive"] as const;

export const bounties = pgTable("bounties", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().$type<typeof bountyCategories[number]>(),
  reward: decimal("reward", { precision: 12, scale: 2 }).notNull(),
  successMetrics: text("success_metrics").notNull(),
  verificationCriteria: text("verification_criteria").notNull(),
  deadline: timestamp("deadline").notNull(),
  status: text("status").notNull().$type<typeof bountyStatuses[number]>().default("open"),
  posterId: varchar("poster_id").notNull(),
  winnerId: integer("winner_id"),
  paymentStatus: text("payment_status").$type<typeof paymentStatuses[number]>().default("pending"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  orchestrationMode: text("orchestration_mode").$type<typeof orchestrationModes[number]>().default("single"),
  maxAgents: integer("max_agents").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  capabilities: text("capabilities").array().notNull(),
  developerId: varchar("developer_id").notNull(),
  avatarColor: text("avatar_color").notNull().default("#3B82F6"),
  completionRate: decimal("completion_rate", { precision: 5, scale: 2 }).default("0"),
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 }).default("0"),
  totalBounties: integer("total_bounties").default(0),
  avgRating: decimal("avg_rating", { precision: 3, scale: 2 }).default("0"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull().references(() => bounties.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  status: text("status").notNull().$type<typeof submissionStatuses[number]>().default("pending"),
  progress: integer("progress").default(0),
  output: text("output"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  reviewerId: varchar("reviewer_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey(),
  role: text("role").notNull().$type<typeof userRoles[number]>().default("business"),
  companyName: text("company_name"),
  bio: text("bio"),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default("0"),
  totalEarned: decimal("total_earned", { precision: 12, scale: 2 }).default("0"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeConnectAccountId: text("stripe_connect_account_id"),
  subscriptionTier: text("subscription_tier").$type<typeof subscriptionTiers[number]>().default("free"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  monthlyBountyLimit: integer("monthly_bounty_limit").default(3),
  bountiesPostedThisMonth: integer("bounties_posted_this_month").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bountyTimeline = pgTable("bounty_timeline", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull().references(() => bounties.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bountiesRelations = relations(bounties, ({ one, many }) => ({
  poster: one(userProfiles, { fields: [bounties.posterId], references: [userProfiles.id] }),
  winner: one(agents, { fields: [bounties.winnerId], references: [agents.id] }),
  submissions: many(submissions),
  timeline: many(bountyTimeline),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  developer: one(userProfiles, { fields: [agents.developerId], references: [userProfiles.id] }),
  submissions: many(submissions),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  bounty: one(bounties, { fields: [submissions.bountyId], references: [bounties.id] }),
  agent: one(agents, { fields: [submissions.agentId], references: [agents.id] }),
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  submission: one(submissions, { fields: [reviews.submissionId], references: [submissions.id] }),
}));

export const bountyTimelineRelations = relations(bountyTimeline, ({ one }) => ({
  bounty: one(bounties, { fields: [bountyTimeline.bountyId], references: [bounties.id] }),
}));

export const insertBountySchema = createInsertSchema(bounties, {
  deadline: z.coerce.date(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  winnerId: true,
  status: true,
  paymentStatus: true,
  stripePaymentIntentId: true,
  stripeCheckoutSessionId: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completionRate: true,
  totalEarnings: true,
  totalBounties: true,
  avgRating: true,
  isVerified: true,
});

export const insertSubmissionSchema = createInsertSchema(submissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  progress: true,
  output: true,
  submittedAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  createdAt: true,
  updatedAt: true,
  totalSpent: true,
  totalEarned: true,
});

export type Bounty = typeof bounties.$inferSelect;
export type InsertBounty = z.infer<typeof insertBountySchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type BountyTimeline = typeof bountyTimeline.$inferSelect;
