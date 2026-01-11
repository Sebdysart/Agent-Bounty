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

export const agentUploadTypes = ["no_code", "low_code", "full_code"] as const;
export const agentUploadStatuses = ["draft", "testing", "pending_review", "approved", "rejected", "published"] as const;
export const agentTestStatuses = ["pending", "running", "passed", "failed"] as const;
export const agentToolCategories = ["web_scraping", "data_analysis", "api_integration", "file_processing", "communication", "ai_ml", "other"] as const;

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

export const agentUploads = pgTable("agent_uploads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  uploadType: text("upload_type").notNull().$type<typeof agentUploadTypes[number]>(),
  status: text("status").notNull().$type<typeof agentUploadStatuses[number]>().default("draft"),
  developerId: varchar("developer_id").notNull(),
  prompt: text("prompt"),
  configJson: text("config_json"),
  manifestJson: text("manifest_json"),
  repoUrl: text("repo_url"),
  entryPoint: text("entry_point"),
  runtime: text("runtime").default("nodejs"),
  capabilities: text("capabilities").array().default([]),
  targetCategories: text("target_categories").array().default([]),
  avatarUrl: text("avatar_url"),
  avatarColor: text("avatar_color").default("#3B82F6"),
  version: text("version").default("1.0.0"),
  isPublic: boolean("is_public").default(false),
  price: decimal("price", { precision: 12, scale: 2 }).default("0"),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).default("0"),
  totalTests: integer("total_tests").default(0),
  passedTests: integer("passed_tests").default(0),
  totalBountiesCompleted: integer("total_bounties_completed").default(0),
  avgResponseTime: decimal("avg_response_time", { precision: 10, scale: 2 }).default("0"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("review_count").default(0),
  downloadCount: integer("download_count").default(0),
  linkedAgentId: integer("linked_agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
});

export const agentVersions = pgTable("agent_versions", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  changelog: text("changelog"),
  configJson: text("config_json"),
  manifestJson: text("manifest_json"),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentTools = pgTable("agent_tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().$type<typeof agentToolCategories[number]>(),
  configSchema: text("config_schema"),
  isBuiltIn: boolean("is_built_in").default(false),
  iconName: text("icon_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentUploadTools = pgTable("agent_upload_tools", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  toolId: integer("tool_id").notNull().references(() => agentTools.id, { onDelete: "cascade" }),
  config: text("config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentTests = pgTable("agent_tests", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  testName: text("test_name").notNull(),
  testType: text("test_type").notNull(),
  status: text("status").notNull().$type<typeof agentTestStatuses[number]>().default("pending"),
  input: text("input"),
  expectedOutput: text("expected_output"),
  actualOutput: text("actual_output"),
  score: decimal("score", { precision: 5, scale: 2 }),
  executionTimeMs: integer("execution_time_ms"),
  errorMessage: text("error_message"),
  logs: text("logs"),
  metadata: text("metadata"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentListings = pgTable("agent_listings", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  shortDescription: text("short_description").notNull(),
  longDescription: text("long_description"),
  tags: text("tags").array().default([]),
  screenshots: text("screenshots").array().default([]),
  demoUrl: text("demo_url"),
  documentationUrl: text("documentation_url"),
  isFeatured: boolean("is_featured").default(false),
  featuredOrder: integer("featured_order"),
  verificationBadges: text("verification_badges").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentReviews = pgTable("agent_reviews", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  reviewerId: varchar("reviewer_id").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  comment: text("comment"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false),
  helpfulCount: integer("helpful_count").default(0),
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

export const agentUploadsRelations = relations(agentUploads, ({ one, many }) => ({
  developer: one(userProfiles, { fields: [agentUploads.developerId], references: [userProfiles.id] }),
  linkedAgent: one(agents, { fields: [agentUploads.linkedAgentId], references: [agents.id] }),
  versions: many(agentVersions),
  tools: many(agentUploadTools),
  tests: many(agentTests),
  listing: one(agentListings),
  reviews: many(agentReviews),
}));

export const agentVersionsRelations = relations(agentVersions, ({ one }) => ({
  agentUpload: one(agentUploads, { fields: [agentVersions.agentUploadId], references: [agentUploads.id] }),
}));

export const agentToolsRelations = relations(agentTools, ({ many }) => ({
  agentUploadTools: many(agentUploadTools),
}));

export const agentUploadToolsRelations = relations(agentUploadTools, ({ one }) => ({
  agentUpload: one(agentUploads, { fields: [agentUploadTools.agentUploadId], references: [agentUploads.id] }),
  tool: one(agentTools, { fields: [agentUploadTools.toolId], references: [agentTools.id] }),
}));

export const agentTestsRelations = relations(agentTests, ({ one }) => ({
  agentUpload: one(agentUploads, { fields: [agentTests.agentUploadId], references: [agentUploads.id] }),
}));

export const agentListingsRelations = relations(agentListings, ({ one }) => ({
  agentUpload: one(agentUploads, { fields: [agentListings.agentUploadId], references: [agentUploads.id] }),
}));

export const agentReviewsRelations = relations(agentReviews, ({ one }) => ({
  agentUpload: one(agentUploads, { fields: [agentReviews.agentUploadId], references: [agentUploads.id] }),
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

export const insertAgentUploadSchema = createInsertSchema(agentUploads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  status: true,
  successRate: true,
  totalTests: true,
  passedTests: true,
  totalBountiesCompleted: true,
  avgResponseTime: true,
  rating: true,
  reviewCount: true,
  downloadCount: true,
  linkedAgentId: true,
});

export const insertAgentVersionSchema = createInsertSchema(agentVersions).omit({
  id: true,
  createdAt: true,
  isActive: true,
});

export const insertAgentToolSchema = createInsertSchema(agentTools).omit({
  id: true,
  createdAt: true,
});

export const insertAgentTestSchema = createInsertSchema(agentTests).omit({
  id: true,
  createdAt: true,
  status: true,
  actualOutput: true,
  score: true,
  executionTimeMs: true,
  errorMessage: true,
  logs: true,
  startedAt: true,
  completedAt: true,
});

export const insertAgentListingSchema = createInsertSchema(agentListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isFeatured: true,
  featuredOrder: true,
});

export const insertAgentReviewSchema = createInsertSchema(agentReviews).omit({
  id: true,
  createdAt: true,
  helpfulCount: true,
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

export type AgentUpload = typeof agentUploads.$inferSelect;
export type InsertAgentUpload = z.infer<typeof insertAgentUploadSchema>;
export type AgentVersion = typeof agentVersions.$inferSelect;
export type InsertAgentVersion = z.infer<typeof insertAgentVersionSchema>;
export type AgentTool = typeof agentTools.$inferSelect;
export type InsertAgentTool = z.infer<typeof insertAgentToolSchema>;
export type AgentTest = typeof agentTests.$inferSelect;
export type InsertAgentTest = z.infer<typeof insertAgentTestSchema>;
export type AgentListing = typeof agentListings.$inferSelect;
export type InsertAgentListing = z.infer<typeof insertAgentListingSchema>;
export type AgentReview = typeof agentReviews.$inferSelect;
export type InsertAgentReview = z.infer<typeof insertAgentReviewSchema>;
