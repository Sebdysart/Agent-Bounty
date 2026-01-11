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

export const badgeTypes = ["verified_secure", "top_performer", "trending", "featured", "enterprise_ready", "community_favorite", "new_release"] as const;
export const integrationCategories = ["ai_ml", "communication", "productivity", "data", "marketing", "payment", "developer"] as const;
export const discussionTypes = ["question", "feedback", "feature_request", "bug_report", "general"] as const;
export const voteTypes = ["upvote", "downvote"] as const;
export const securityEventTypes = ["login", "upload", "publish", "api_key_created", "settings_changed", "2fa_enabled", "2fa_disabled"] as const;

export const executionStatuses = ["queued", "initializing", "running", "completed", "failed", "cancelled", "timeout"] as const;
export const verificationStatuses = ["pending", "approved", "rejected", "needs_revision"] as const;
export const disputeStatuses = ["open", "under_review", "awaiting_response", "resolved", "escalated", "closed"] as const;
export const disputeResolutions = ["in_favor_business", "in_favor_developer", "partial_refund", "full_refund", "no_action", "mediated"] as const;
export const disputeCategories = ["quality", "incomplete", "criteria_mismatch", "deadline_missed", "payment_issue", "other"] as const;
export const ticketStatuses = ["open", "in_progress", "awaiting_response", "resolved", "closed"] as const;
export const ticketPriorities = ["low", "medium", "high", "urgent"] as const;
export const ticketCategories = ["billing", "technical", "account", "bounty", "agent", "dispute", "other"] as const;
export const moderationActions = ["approve", "reject", "flag", "suspend", "ban", "warn", "restore"] as const;

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
  isAdmin: boolean("is_admin").default(false),
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

export const agentBadges = pgTable("agent_badges", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  badgeType: text("badge_type").notNull().$type<typeof badgeTypes[number]>(),
  awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  awardedBy: varchar("awarded_by"),
  reason: text("reason"),
  metadata: text("metadata"),
});

export const integrationConnectors = pgTable("integration_connectors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull().$type<typeof integrationCategories[number]>(),
  iconUrl: text("icon_url"),
  authType: text("auth_type").default("api_key"),
  configSchema: text("config_schema"),
  docsUrl: text("docs_url"),
  isActive: boolean("is_active").default(true),
  isPremium: boolean("is_premium").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentIntegrations = pgTable("agent_integrations", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  connectorId: integer("connector_id").notNull().references(() => integrationConnectors.id, { onDelete: "cascade" }),
  config: text("config"),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentForks = pgTable("agent_forks", {
  id: serial("id").primaryKey(),
  originalAgentId: integer("original_agent_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  forkedAgentId: integer("forked_agent_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  forkerId: varchar("forker_id").notNull(),
  forkReason: text("fork_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentAnalytics = pgTable("agent_analytics", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  totalRuns: integer("total_runs").default(0),
  successfulRuns: integer("successful_runs").default(0),
  failedRuns: integer("failed_runs").default(0),
  avgLatencyMs: decimal("avg_latency_ms", { precision: 10, scale: 2 }).default("0"),
  totalCost: decimal("total_cost", { precision: 12, scale: 4 }).default("0"),
  totalTokensUsed: integer("total_tokens_used").default(0),
  uniqueUsers: integer("unique_users").default(0),
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
});

export const agentRunLogs = pgTable("agent_run_logs", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  userId: varchar("user_id"),
  bountyId: integer("bounty_id"),
  status: text("status").notNull(),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  latencyMs: integer("latency_ms"),
  cost: decimal("cost", { precision: 12, scale: 4 }).default("0"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const discussions = pgTable("discussions", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").references(() => agentUploads.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  discussionType: text("discussion_type").notNull().$type<typeof discussionTypes[number]>().default("general"),
  isPinned: boolean("is_pinned").default(false),
  isResolved: boolean("is_resolved").default(false),
  viewCount: integer("view_count").default(0),
  replyCount: integer("reply_count").default(0),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const discussionReplies = pgTable("discussion_replies", {
  id: serial("id").primaryKey(),
  discussionId: integer("discussion_id").notNull().references(() => discussions.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull(),
  content: text("content").notNull(),
  parentReplyId: integer("parent_reply_id"),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  isAcceptedAnswer: boolean("is_accepted_answer").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  voteType: text("vote_type").notNull().$type<typeof voteTypes[number]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const securitySettings = pgTable("security_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  backupCodes: text("backup_codes").array().default([]),
  trustedDevices: text("trusted_devices").array().default([]),
  lastPasswordChange: timestamp("last_password_change"),
  loginNotifications: boolean("login_notifications").default(true),
  uploadRequires2fa: boolean("upload_requires_2fa").default(false),
  publishRequires2fa: boolean("publish_requires_2fa").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const securityAuditLog = pgTable("security_audit_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  eventType: text("event_type").notNull().$type<typeof securityEventTypes[number]>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: text("details"),
  success: boolean("success").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentSecurityScans = pgTable("agent_security_scans", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  scanType: text("scan_type").notNull(),
  status: text("status").notNull(),
  score: integer("score"),
  vulnerabilities: text("vulnerabilities").array().default([]),
  recommendations: text("recommendations").array().default([]),
  scanDetails: text("scan_details"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Agent Execution Environment - Sandbox job system
export const agentExecutions = pgTable("agent_executions", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  bountyId: integer("bounty_id").notNull().references(() => bounties.id),
  status: text("status").notNull().$type<typeof executionStatuses[number]>().default("queued"),
  priority: integer("priority").default(5),
  input: text("input"),
  output: text("output"),
  logs: text("logs"),
  errorMessage: text("error_message"),
  metrics: text("metrics"),
  resourceUsage: text("resource_usage"),
  executionTimeMs: integer("execution_time_ms"),
  tokensUsed: integer("tokens_used").default(0),
  cost: decimal("cost", { precision: 12, scale: 4 }).default("0"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  timeoutMs: integer("timeout_ms").default(300000),
  sandboxId: text("sandbox_id"),
  queuedAt: timestamp("queued_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// Output Verification System
export const outputVerifications = pgTable("output_verifications", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
  submissionId: integer("submission_id").notNull().references(() => submissions.id),
  bountyId: integer("bounty_id").notNull().references(() => bounties.id),
  reviewerId: varchar("reviewer_id"),
  status: text("status").notNull().$type<typeof verificationStatuses[number]>().default("pending"),
  automatedScore: decimal("automated_score", { precision: 5, scale: 2 }),
  automatedChecks: text("automated_checks"),
  manualScore: decimal("manual_score", { precision: 5, scale: 2 }),
  criteriaResults: text("criteria_results"),
  feedback: text("feedback"),
  revisionNotes: text("revision_notes"),
  isAutomatedPass: boolean("is_automated_pass"),
  requiresManualReview: boolean("requires_manual_review").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

// Dispute Resolution System
export const disputes = pgTable("disputes", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull().references(() => bounties.id),
  submissionId: integer("submission_id").references(() => submissions.id),
  initiatorId: varchar("initiator_id").notNull(),
  respondentId: varchar("respondent_id").notNull(),
  status: text("status").notNull().$type<typeof disputeStatuses[number]>().default("open"),
  resolution: text("resolution").$type<typeof disputeResolutions[number]>(),
  category: text("category").notNull().$type<typeof disputeCategories[number]>(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence"),
  businessClaim: text("business_claim"),
  developerResponse: text("developer_response"),
  mediatorNotes: text("mediator_notes"),
  resolutionNotes: text("resolution_notes"),
  refundAmount: decimal("refund_amount", { precision: 12, scale: 2 }),
  assignedMediatorId: varchar("assigned_mediator_id"),
  priority: text("priority").$type<typeof ticketPriorities[number]>().default("medium"),
  escalatedAt: timestamp("escalated_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const disputeMessages = pgTable("dispute_messages", {
  id: serial("id").primaryKey(),
  disputeId: integer("dispute_id").notNull().references(() => disputes.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull(),
  senderRole: text("sender_role").notNull(),
  content: text("content").notNull(),
  attachments: text("attachments").array().default([]),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Support Ticket System
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  category: text("category").notNull().$type<typeof ticketCategories[number]>(),
  priority: text("priority").notNull().$type<typeof ticketPriorities[number]>().default("medium"),
  status: text("status").notNull().$type<typeof ticketStatuses[number]>().default("open"),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  relatedBountyId: integer("related_bounty_id").references(() => bounties.id),
  relatedAgentId: integer("related_agent_id").references(() => agents.id),
  relatedDisputeId: integer("related_dispute_id").references(() => disputes.id),
  assignedToId: varchar("assigned_to_id"),
  tags: text("tags").array().default([]),
  resolvedAt: timestamp("resolved_at"),
  firstResponseAt: timestamp("first_response_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ticketMessages = pgTable("ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull(),
  senderType: text("sender_type").notNull(),
  content: text("content").notNull(),
  attachments: text("attachments").array().default([]),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin/Moderation System
export const moderationLog = pgTable("moderation_log", {
  id: serial("id").primaryKey(),
  moderatorId: varchar("moderator_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  action: text("action").notNull().$type<typeof moderationActions[number]>(),
  reason: text("reason"),
  details: text("details"),
  previousState: text("previous_state"),
  newState: text("new_state"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contentFlags = pgTable("content_flags", {
  id: serial("id").primaryKey(),
  reporterId: varchar("reporter_id").notNull(),
  contentType: text("content_type").notNull(),
  contentId: integer("content_id").notNull(),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status").default("pending"),
  reviewedById: varchar("reviewed_by_id"),
  reviewedAt: timestamp("reviewed_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quality Control Metrics
export const qualityMetrics = pgTable("quality_metrics", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id),
  bountyId: integer("bounty_id").references(() => bounties.id),
  metricType: text("metric_type").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }),
  details: text("details"),
  period: text("period"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
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

export const agentBadgesRelations = relations(agentBadges, ({ one }) => ({
  agentUpload: one(agentUploads, { fields: [agentBadges.agentUploadId], references: [agentUploads.id] }),
}));

export const integrationConnectorsRelations = relations(integrationConnectors, ({ many }) => ({
  agentIntegrations: many(agentIntegrations),
}));

export const agentIntegrationsRelations = relations(agentIntegrations, ({ one }) => ({
  agentUpload: one(agentUploads, { fields: [agentIntegrations.agentUploadId], references: [agentUploads.id] }),
  connector: one(integrationConnectors, { fields: [agentIntegrations.connectorId], references: [integrationConnectors.id] }),
}));

export const agentForksRelations = relations(agentForks, ({ one }) => ({
  originalAgent: one(agentUploads, { fields: [agentForks.originalAgentId], references: [agentUploads.id] }),
  forkedAgent: one(agentUploads, { fields: [agentForks.forkedAgentId], references: [agentUploads.id] }),
}));

export const agentAnalyticsRelations = relations(agentAnalytics, ({ one }) => ({
  agentUpload: one(agentUploads, { fields: [agentAnalytics.agentUploadId], references: [agentUploads.id] }),
}));

export const agentRunLogsRelations = relations(agentRunLogs, ({ one }) => ({
  agentUpload: one(agentUploads, { fields: [agentRunLogs.agentUploadId], references: [agentUploads.id] }),
}));

export const discussionsRelations = relations(discussions, ({ one, many }) => ({
  agentUpload: one(agentUploads, { fields: [discussions.agentUploadId], references: [agentUploads.id] }),
  replies: many(discussionReplies),
}));

export const discussionRepliesRelations = relations(discussionReplies, ({ one }) => ({
  discussion: one(discussions, { fields: [discussionReplies.discussionId], references: [discussions.id] }),
}));

export const securitySettingsRelations = relations(securitySettings, ({ one }) => ({
  user: one(userProfiles, { fields: [securitySettings.userId], references: [userProfiles.id] }),
}));

export const agentSecurityScansRelations = relations(agentSecurityScans, ({ one }) => ({
  agentUpload: one(agentUploads, { fields: [agentSecurityScans.agentUploadId], references: [agentUploads.id] }),
}));

export const agentExecutionsRelations = relations(agentExecutions, ({ one, many }) => ({
  submission: one(submissions, { fields: [agentExecutions.submissionId], references: [submissions.id] }),
  agent: one(agents, { fields: [agentExecutions.agentId], references: [agents.id] }),
  bounty: one(bounties, { fields: [agentExecutions.bountyId], references: [bounties.id] }),
  verifications: many(outputVerifications),
}));

export const outputVerificationsRelations = relations(outputVerifications, ({ one }) => ({
  execution: one(agentExecutions, { fields: [outputVerifications.executionId], references: [agentExecutions.id] }),
  submission: one(submissions, { fields: [outputVerifications.submissionId], references: [submissions.id] }),
  bounty: one(bounties, { fields: [outputVerifications.bountyId], references: [bounties.id] }),
}));

export const disputesRelations = relations(disputes, ({ one, many }) => ({
  bounty: one(bounties, { fields: [disputes.bountyId], references: [bounties.id] }),
  submission: one(submissions, { fields: [disputes.submissionId], references: [submissions.id] }),
  messages: many(disputeMessages),
}));

export const disputeMessagesRelations = relations(disputeMessages, ({ one }) => ({
  dispute: one(disputes, { fields: [disputeMessages.disputeId], references: [disputes.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  relatedBounty: one(bounties, { fields: [supportTickets.relatedBountyId], references: [bounties.id] }),
  relatedAgent: one(agents, { fields: [supportTickets.relatedAgentId], references: [agents.id] }),
  relatedDispute: one(disputes, { fields: [supportTickets.relatedDisputeId], references: [disputes.id] }),
  messages: many(ticketMessages),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(supportTickets, { fields: [ticketMessages.ticketId], references: [supportTickets.id] }),
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

export const insertAgentBadgeSchema = createInsertSchema(agentBadges).omit({
  id: true,
  awardedAt: true,
});

export const insertIntegrationConnectorSchema = createInsertSchema(integrationConnectors).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});

export const insertAgentIntegrationSchema = createInsertSchema(agentIntegrations).omit({
  id: true,
  createdAt: true,
});

export const insertAgentForkSchema = createInsertSchema(agentForks).omit({
  id: true,
  createdAt: true,
});

export const insertDiscussionSchema = createInsertSchema(discussions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  replyCount: true,
  upvotes: true,
  downvotes: true,
});

export const insertDiscussionReplySchema = createInsertSchema(discussionReplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  upvotes: true,
  downvotes: true,
  isAcceptedAnswer: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

export const insertSecuritySettingsSchema = createInsertSchema(securitySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSecurityAuditLogSchema = createInsertSchema(securityAuditLog).omit({
  id: true,
  createdAt: true,
});

export const insertAgentSecurityScanSchema = createInsertSchema(agentSecurityScans).omit({
  id: true,
  startedAt: true,
  completedAt: true,
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

export type AgentBadge = typeof agentBadges.$inferSelect;
export type InsertAgentBadge = z.infer<typeof insertAgentBadgeSchema>;
export type IntegrationConnector = typeof integrationConnectors.$inferSelect;
export type InsertIntegrationConnector = z.infer<typeof insertIntegrationConnectorSchema>;
export type AgentIntegration = typeof agentIntegrations.$inferSelect;
export type InsertAgentIntegration = z.infer<typeof insertAgentIntegrationSchema>;
export type AgentFork = typeof agentForks.$inferSelect;
export type InsertAgentFork = z.infer<typeof insertAgentForkSchema>;
export type AgentAnalytics = typeof agentAnalytics.$inferSelect;
export type AgentRunLog = typeof agentRunLogs.$inferSelect;
export type Discussion = typeof discussions.$inferSelect;
export type InsertDiscussion = z.infer<typeof insertDiscussionSchema>;
export type DiscussionReply = typeof discussionReplies.$inferSelect;
export type InsertDiscussionReply = z.infer<typeof insertDiscussionReplySchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type SecuritySettings = typeof securitySettings.$inferSelect;
export type InsertSecuritySettings = z.infer<typeof insertSecuritySettingsSchema>;
export type SecurityAuditLog = typeof securityAuditLog.$inferSelect;
export type InsertSecurityAuditLog = z.infer<typeof insertSecurityAuditLogSchema>;
export type AgentSecurityScan = typeof agentSecurityScans.$inferSelect;
export type InsertAgentSecurityScan = z.infer<typeof insertAgentSecurityScanSchema>;

// Agent Execution schemas and types
export const insertAgentExecutionSchema = createInsertSchema(agentExecutions).omit({
  id: true,
  queuedAt: true,
  startedAt: true,
  completedAt: true,
  status: true,
  output: true,
  logs: true,
  errorMessage: true,
  executionTimeMs: true,
  tokensUsed: true,
  cost: true,
  retryCount: true,
  sandboxId: true,
});

export const insertOutputVerificationSchema = createInsertSchema(outputVerifications).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  status: true,
  automatedScore: true,
  automatedChecks: true,
  isAutomatedPass: true,
});

export const insertDisputeSchema = createInsertSchema(disputes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  resolution: true,
  mediatorNotes: true,
  resolutionNotes: true,
  refundAmount: true,
  assignedMediatorId: true,
  escalatedAt: true,
  resolvedAt: true,
});

export const insertDisputeMessageSchema = createInsertSchema(disputeMessages).omit({
  id: true,
  createdAt: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  assignedToId: true,
  resolvedAt: true,
  firstResponseAt: true,
});

export const insertTicketMessageSchema = createInsertSchema(ticketMessages).omit({
  id: true,
  createdAt: true,
});

export const insertModerationLogSchema = createInsertSchema(moderationLog).omit({
  id: true,
  createdAt: true,
});

export const insertContentFlagSchema = createInsertSchema(contentFlags).omit({
  id: true,
  createdAt: true,
  status: true,
  reviewedById: true,
  reviewedAt: true,
  resolution: true,
});

export type AgentExecution = typeof agentExecutions.$inferSelect;
export type InsertAgentExecution = z.infer<typeof insertAgentExecutionSchema>;
export type OutputVerification = typeof outputVerifications.$inferSelect;
export type InsertOutputVerification = z.infer<typeof insertOutputVerificationSchema>;
export type Dispute = typeof disputes.$inferSelect;
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type DisputeMessage = typeof disputeMessages.$inferSelect;
export type InsertDisputeMessage = z.infer<typeof insertDisputeMessageSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
export type ModerationLog = typeof moderationLog.$inferSelect;
export type InsertModerationLog = z.infer<typeof insertModerationLogSchema>;
export type ContentFlag = typeof contentFlags.$inferSelect;
export type InsertContentFlag = z.infer<typeof insertContentFlagSchema>;
export type QualityMetric = typeof qualityMetrics.$inferSelect;
