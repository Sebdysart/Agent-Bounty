import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
export * from "./models/chat";

export const bountyCategories = ["marketing", "sales", "research", "data_analysis", "development", "other"] as const;
export const bountyStatuses = ["open", "in_progress", "under_review", "completed", "failed", "cancelled"] as const;
export const submissionStatuses = ["pending", "in_progress", "submitted", "approved", "rejected"] as const;
export const userRoles = ["business", "developer", "admin", "moderator", "viewer"] as const;
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
  submissionId: integer("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  bountyId: integer("bounty_id").references(() => bounties.id),
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

// ============================================
// ENTERPRISE FEATURES - Zero Trust & GDPR
// ============================================

export const userRoleTypes = ["admin", "moderator", "developer", "business", "viewer"] as const;
export const permissionActions = ["create", "read", "update", "delete", "manage", "execute", "verify", "moderate"] as const;
export const resourceTypes = ["bounty", "agent", "submission", "user", "dispute", "ticket", "execution", "analytics", "admin"] as const;

// Refresh Tokens for JWT rotation
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull().unique(),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Role-Based Access Control
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull().$type<typeof userRoleTypes[number]>(),
  resource: text("resource").notNull().$type<typeof resourceTypes[number]>(),
  action: text("action").notNull().$type<typeof permissionActions[number]>(),
  conditions: text("conditions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User role assignments
export const userRoleAssignments = pgTable("user_role_assignments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().$type<typeof userRoleTypes[number]>(),
  grantedBy: varchar("granted_by"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// GDPR/CCPA Consent Management
export const consentCategories = ["analytics", "marketing", "ai_training", "third_party", "essential"] as const;
export const userConsents = pgTable("user_consents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  category: text("category").notNull().$type<typeof consentCategories[number]>(),
  granted: boolean("granted").notNull().default(false),
  version: text("version").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  grantedAt: timestamp("granted_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Data Export Requests
export const dataExportStatuses = ["pending", "processing", "completed", "expired", "failed"] as const;
export const dataExportRequests = pgTable("data_export_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().$type<typeof dataExportStatuses[number]>().default("pending"),
  format: text("format").notNull().default("json"),
  downloadUrl: text("download_url"),
  expiresAt: timestamp("expires_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Data Deletion Requests
export const dataDeletionStatuses = ["pending", "processing", "completed", "cancelled"] as const;
export const dataDeletionRequests = pgTable("data_deletion_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().$type<typeof dataDeletionStatuses[number]>().default("pending"),
  reason: text("reason"),
  confirmationCode: text("confirmation_code"),
  confirmedAt: timestamp("confirmed_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Ethics Audits
export const ethicsAuditStatuses = ["pending", "passed", "failed", "review_required"] as const;
export const ethicsAuditTypes = ["bias_detection", "harmful_content", "prompt_injection", "privacy_leak", "comprehensive"] as const;
export const agentEthicsAudits = pgTable("agent_ethics_audits", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  auditType: text("audit_type").notNull().$type<typeof ethicsAuditTypes[number]>(),
  status: text("status").notNull().$type<typeof ethicsAuditStatuses[number]>().default("pending"),
  score: decimal("score", { precision: 5, scale: 2 }),
  findings: text("findings"),
  recommendations: text("recommendations"),
  flaggedContent: text("flagged_content"),
  reviewerId: varchar("reviewer_id"),
  reviewNotes: text("review_notes"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// AFFILIATE & REFERRAL PROGRAM
// ============================================

export const referralStatuses = ["pending", "active", "converted", "expired"] as const;
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: varchar("referrer_id").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  referredUserId: varchar("referred_user_id"),
  status: text("status").notNull().$type<typeof referralStatuses[number]>().default("pending"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("10"),
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 }).default("0"),
  lifetimeReferrals: integer("lifetime_referrals").default(0),
  conversionDate: timestamp("conversion_date"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referralPayouts = pgTable("referral_payouts", {
  id: serial("id").primaryKey(),
  referralId: integer("referral_id").notNull().references(() => referrals.id),
  referrerId: varchar("referrer_id").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: integer("source_id"),
  stripeTransferId: text("stripe_transfer_id"),
  status: text("status").default("pending"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// PREMIUM ADD-ONS & FEATURES
// ============================================

export const premiumFeatureTypes = ["priority_execution", "white_label", "dedicated_support", "custom_integration", "advanced_analytics", "unlimited_agents"] as const;
export const premiumFeatures = pgTable("premium_features", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  featureType: text("feature_type").notNull().$type<typeof premiumFeatureTypes[number]>(),
  isActive: boolean("is_active").default(true),
  config: text("config"),
  expiresAt: timestamp("expires_at"),
  stripeSubscriptionItemId: text("stripe_subscription_item_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agent Matching Recommendations
export const agentRecommendations = pgTable("agent_recommendations", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull().references(() => bounties.id),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  score: decimal("score", { precision: 5, scale: 2 }).notNull(),
  reasoning: text("reasoning"),
  factors: text("factors"),
  wasSelected: boolean("was_selected").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// MULTI-LLM SUPPORT
// ============================================

export const llmProviders = ["openai", "anthropic", "groq", "custom"] as const;
export const agentLlmConfigs = pgTable("agent_llm_configs", {
  id: serial("id").primaryKey(),
  agentUploadId: integer("agent_upload_id").notNull().references(() => agentUploads.id, { onDelete: "cascade" }),
  primaryProvider: text("primary_provider").notNull().$type<typeof llmProviders[number]>().default("openai"),
  fallbackProvider: text("fallback_provider").$type<typeof llmProviders[number]>(),
  primaryModel: text("primary_model").default("gpt-4o"),
  fallbackModel: text("fallback_model"),
  maxTokens: integer("max_tokens").default(4096),
  temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.7"),
  customEndpoint: text("custom_endpoint"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// BLOCKCHAIN VERIFICATION PROOFS
// ============================================

export const blockchainNetworks = ["ethereum", "polygon", "arbitrum", "optimism"] as const;
export const verificationProofs = pgTable("verification_proofs", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull().references(() => bounties.id),
  submissionId: integer("submission_id").references(() => submissions.id),
  network: text("network").notNull().$type<typeof blockchainNetworks[number]>().default("polygon"),
  transactionHash: text("transaction_hash").unique(),
  blockNumber: integer("block_number"),
  contentHash: text("content_hash").notNull(),
  proofData: text("proof_data"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// AGENT SWARM FORMATION (Enterprise Feature 1)
// ============================================

export const swarmStatuses = ["forming", "active", "executing", "completed", "disbanded", "failed"] as const;
export const swarmRoles = ["leader", "worker", "specialist", "validator"] as const;

export const agentSwarms = pgTable("agent_swarms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  bountyId: integer("bounty_id").references(() => bounties.id),
  leaderId: integer("leader_id").references(() => agents.id),
  status: text("status").notNull().$type<typeof swarmStatuses[number]>().default("forming"),
  maxMembers: integer("max_members").default(10),
  taskDistribution: text("task_distribution"), // JSON: task allocation strategy
  communicationProtocol: text("communication_protocol").default("broadcast"), // broadcast, hierarchical, mesh
  consensusThreshold: decimal("consensus_threshold", { precision: 3, scale: 2 }).default("0.66"),
  totalExecutions: integer("total_executions").default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).default("0"),
  createdById: varchar("created_by_id").notNull(),
  formedAt: timestamp("formed_at"),
  disbandedAt: timestamp("disbanded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const swarmMembers = pgTable("swarm_members", {
  id: serial("id").primaryKey(),
  swarmId: integer("swarm_id").notNull().references(() => agentSwarms.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  role: text("role").notNull().$type<typeof swarmRoles[number]>().default("worker"),
  capabilities: text("capabilities").array().default([]),
  taskAssignment: text("task_assignment"), // JSON: assigned subtasks
  contributionScore: decimal("contribution_score", { precision: 5, scale: 2 }).default("0"),
  messagesProcessed: integer("messages_processed").default(0),
  tasksCompleted: integer("tasks_completed").default(0),
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
});

export const swarmExecutions = pgTable("swarm_executions", {
  id: serial("id").primaryKey(),
  swarmId: integer("swarm_id").notNull().references(() => agentSwarms.id, { onDelete: "cascade" }),
  bountyId: integer("bounty_id").references(() => bounties.id),
  status: text("status").notNull().$type<typeof executionStatuses[number]>().default("queued"),
  taskBreakdown: text("task_breakdown"), // JSON: how task was divided
  memberOutputs: text("member_outputs"), // JSON: outputs from each member
  aggregatedOutput: text("aggregated_output"),
  consensusReached: boolean("consensus_reached").default(false),
  executionTimeMs: integer("execution_time_ms"),
  totalCost: decimal("total_cost", { precision: 12, scale: 4 }),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// EXPANDED INTEGRATIONS HUB (Enterprise Feature 2)
// ============================================

export const integrationHubCategories = ["crm", "marketing", "data", "devops", "ai_ml", "finance", "communication", "productivity", "analytics", "storage"] as const;
export const integrationAuthTypes = ["oauth2", "api_key", "basic", "bearer", "custom", "none"] as const;

export const hubConnectors = pgTable("hub_connectors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull().$type<typeof integrationHubCategories[number]>(),
  iconUrl: text("icon_url"),
  authType: text("auth_type").notNull().$type<typeof integrationAuthTypes[number]>().default("api_key"),
  authConfig: text("auth_config"), // JSON: OAuth endpoints, scopes, etc.
  baseUrl: text("base_url"),
  apiVersion: text("api_version"),
  endpoints: text("endpoints"), // JSON: available API endpoints
  rateLimit: integer("rate_limit"), // requests per minute
  webhookSupport: boolean("webhook_support").default(false),
  webhookEvents: text("webhook_events").array().default([]),
  documentation: text("documentation"),
  isPremium: boolean("is_premium").default(false),
  isVerified: boolean("is_verified").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userIntegrations = pgTable("user_integrations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  connectorId: integer("connector_id").notNull().references(() => hubConnectors.id, { onDelete: "cascade" }),
  credentials: text("credentials"), // Encrypted credentials
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  config: text("config"), // JSON: user-specific config
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// AI FINOPS MONITORING (Enterprise Feature 3)
// ============================================

export const finopsMetrics = pgTable("finops_metrics", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  executionId: integer("execution_id").references(() => agentExecutions.id),
  provider: text("provider").notNull().$type<typeof llmProviders[number]>(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  cost: decimal("cost", { precision: 12, scale: 6 }).notNull(),
  computeTimeMs: integer("compute_time_ms").default(0),
  memoryUsageMb: integer("memory_usage_mb"),
  apiCalls: integer("api_calls").default(1),
  cacheHits: integer("cache_hits").default(0),
  errorCount: integer("error_count").default(0),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const costBudgets = pgTable("cost_budgets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  budgetType: text("budget_type").notNull().default("monthly"), // daily, weekly, monthly, per_agent
  agentId: integer("agent_id").references(() => agents.id),
  budgetAmount: decimal("budget_amount", { precision: 12, scale: 2 }).notNull(),
  currentSpend: decimal("current_spend", { precision: 12, scale: 2 }).default("0"),
  alertThreshold: decimal("alert_threshold", { precision: 5, scale: 2 }).default("0.80"), // 80%
  alertSent: boolean("alert_sent").default(false),
  autoStop: boolean("auto_stop").default(false), // Stop executions when budget exceeded
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const finopsOptimizations = pgTable("finops_optimizations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  optimizationType: text("optimization_type").notNull(), // model_switch, caching, batch_processing, prompt_optimization
  currentCost: decimal("current_cost", { precision: 12, scale: 4 }),
  projectedSavings: decimal("projected_savings", { precision: 12, scale: 4 }),
  recommendation: text("recommendation").notNull(),
  details: text("details"), // JSON: detailed analysis
  isApplied: boolean("is_applied").default(false),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// PREDICTIVE ANALYTICS (Enterprise Feature 4)
// ============================================

export const forecastTypes = ["bounty_success", "revenue", "agent_performance", "market_trend", "risk"] as const;

export const analyticsForecasts = pgTable("analytics_forecasts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  forecastType: text("forecast_type").notNull().$type<typeof forecastTypes[number]>(),
  entityType: text("entity_type"), // bounty, agent, user, platform
  entityId: integer("entity_id"),
  prediction: decimal("prediction", { precision: 12, scale: 4 }),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  factors: text("factors"), // JSON: contributing factors
  modelVersion: text("model_version"),
  horizon: text("horizon").notNull(), // 7d, 30d, 90d
  historicalData: text("historical_data"), // JSON: data used for prediction
  actualOutcome: decimal("actual_outcome", { precision: 12, scale: 4 }),
  accuracy: decimal("accuracy", { precision: 5, scale: 4 }),
  forecastedAt: timestamp("forecasted_at").defaultNow().notNull(),
  validUntil: timestamp("valid_until").notNull(),
});

export const riskScores = pgTable("risk_scores", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // bounty, agent, user
  entityId: integer("entity_id").notNull(),
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  fraudRisk: decimal("fraud_risk", { precision: 5, scale: 2 }),
  deliveryRisk: decimal("delivery_risk", { precision: 5, scale: 2 }),
  paymentRisk: decimal("payment_risk", { precision: 5, scale: 2 }),
  reputationRisk: decimal("reputation_risk", { precision: 5, scale: 2 }),
  riskFactors: text("risk_factors"), // JSON: detailed breakdown
  mitigationSuggestions: text("mitigation_suggestions"), // JSON
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trendAnalytics = pgTable("trend_analytics", {
  id: serial("id").primaryKey(),
  metricName: text("metric_name").notNull(),
  metricValue: decimal("metric_value", { precision: 15, scale: 4 }).notNull(),
  previousValue: decimal("previous_value", { precision: 15, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  trend: text("trend").notNull(), // up, down, stable
  period: text("period").notNull(), // hourly, daily, weekly, monthly
  breakdown: text("breakdown"), // JSON: detailed breakdown by category
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

// ============================================
// AGENT INSURANCE & TOKENIZATION (Enterprise Feature 5)
// ============================================

export const insuranceTiers = ["basic", "standard", "premium", "enterprise"] as const;
export const claimStatuses = ["submitted", "under_review", "approved", "rejected", "paid"] as const;

export const agentInsurance = pgTable("agent_insurance", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  ownerId: varchar("owner_id").notNull(),
  tier: text("tier").notNull().$type<typeof insuranceTiers[number]>().default("basic"),
  coverageAmount: decimal("coverage_amount", { precision: 12, scale: 2 }).notNull(),
  deductible: decimal("deductible", { precision: 12, scale: 2 }).default("0"),
  monthlyPremium: decimal("monthly_premium", { precision: 10, scale: 2 }).notNull(),
  coveredEvents: text("covered_events").array().default([]), // execution_failure, data_loss, timeout, etc.
  exclusions: text("exclusions").array().default([]),
  claimsCount: integer("claims_count").default(0),
  totalClaimsPaid: decimal("total_claims_paid", { precision: 12, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  renewalDate: timestamp("renewal_date"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insuranceClaims = pgTable("insurance_claims", {
  id: serial("id").primaryKey(),
  insuranceId: integer("insurance_id").notNull().references(() => agentInsurance.id, { onDelete: "cascade" }),
  claimantId: varchar("claimant_id").notNull(),
  bountyId: integer("bounty_id").references(() => bounties.id),
  executionId: integer("execution_id").references(() => agentExecutions.id),
  status: text("status").notNull().$type<typeof claimStatuses[number]>().default("submitted"),
  claimType: text("claim_type").notNull(), // execution_failure, timeout, data_loss, quality_issue
  description: text("description").notNull(),
  evidence: text("evidence"), // JSON: logs, screenshots, etc.
  requestedAmount: decimal("requested_amount", { precision: 12, scale: 2 }).notNull(),
  approvedAmount: decimal("approved_amount", { precision: 12, scale: 2 }),
  reviewerNotes: text("reviewer_notes"),
  reviewedById: varchar("reviewed_by_id"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  paidAt: timestamp("paid_at"),
});

export const agentTokens = pgTable("agent_tokens", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  tokenSymbol: text("token_symbol").notNull().unique(),
  tokenName: text("token_name").notNull(),
  totalSupply: decimal("total_supply", { precision: 18, scale: 0 }).notNull(),
  circulatingSupply: decimal("circulating_supply", { precision: 18, scale: 0 }).default("0"),
  pricePerToken: decimal("price_per_token", { precision: 12, scale: 6 }).default("0.01"),
  marketCap: decimal("market_cap", { precision: 15, scale: 2 }).default("0"),
  royaltyPercent: decimal("royalty_percent", { precision: 5, scale: 2 }).default("5.00"), // Creator royalty
  isListed: boolean("is_listed").default(false),
  contractAddress: text("contract_address"),
  network: text("network").$type<typeof blockchainNetworks[number]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tokenHoldings = pgTable("token_holdings", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull().references(() => agentTokens.id, { onDelete: "cascade" }),
  holderId: varchar("holder_id").notNull(),
  balance: decimal("balance", { precision: 18, scale: 8 }).notNull(),
  averageBuyPrice: decimal("average_buy_price", { precision: 12, scale: 6 }),
  totalInvested: decimal("total_invested", { precision: 12, scale: 2 }).default("0"),
  royaltiesEarned: decimal("royalties_earned", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// LOCALIZATION & MULTI-LANGUAGE (Enterprise Feature 6)
// ============================================

export const supportedLanguages = ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ar", "hi", "ru", "nl", "sv", "pl", "tr", "vi", "th", "id", "ms"] as const;

export const translations = pgTable("translations", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  language: text("language").notNull().$type<typeof supportedLanguages[number]>(),
  value: text("value").notNull(),
  context: text("context"), // Where this translation is used
  namespace: text("namespace").default("common"), // common, dashboard, bounty, agent, etc.
  isVerified: boolean("is_verified").default(false),
  verifiedById: varchar("verified_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userLanguagePrefs = pgTable("user_language_prefs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  preferredLanguage: text("preferred_language").notNull().$type<typeof supportedLanguages[number]>().default("en"),
  fallbackLanguage: text("fallback_language").$type<typeof supportedLanguages[number]>().default("en"),
  autoDetect: boolean("auto_detect").default(true),
  dateFormat: text("date_format").default("MM/DD/YYYY"),
  numberFormat: text("number_format").default("en-US"),
  timezone: text("timezone").default("UTC"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// QUANTUM-SAFE ENCRYPTION (Enterprise Feature 7)
// ============================================

export const quantumAlgorithms = ["kyber512", "kyber768", "kyber1024", "dilithium2", "dilithium3", "dilithium5"] as const;
export const keyStatuses = ["active", "rotating", "deprecated", "revoked"] as const;

export const quantumKeys = pgTable("quantum_keys", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  keyType: text("key_type").notNull(), // encryption, signing, hybrid
  algorithm: text("algorithm").notNull().$type<typeof quantumAlgorithms[number]>().default("kyber768"),
  publicKey: text("public_key").notNull(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(), // Encrypted with user's master key
  keyFingerprint: text("key_fingerprint").notNull().unique(),
  status: text("status").notNull().$type<typeof keyStatuses[number]>().default("active"),
  purpose: text("purpose"), // data_encryption, signature, key_exchange
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  rotatedFromId: integer("rotated_from_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const encryptedData = pgTable("encrypted_data", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull(),
  keyId: integer("key_id").notNull().references(() => quantumKeys.id),
  dataType: text("data_type").notNull(), // api_key, credential, sensitive_config
  encryptedPayload: text("encrypted_payload").notNull(),
  nonce: text("nonce").notNull(),
  authTag: text("auth_tag"),
  algorithm: text("algorithm").notNull().$type<typeof quantumAlgorithms[number]>(),
  isHybrid: boolean("is_hybrid").default(true), // Uses both classical + quantum
  classicalAlgorithm: text("classical_algorithm").default("AES-256-GCM"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const keyRotationHistory = pgTable("key_rotation_history", {
  id: serial("id").primaryKey(),
  oldKeyId: integer("old_key_id").notNull().references(() => quantumKeys.id),
  newKeyId: integer("new_key_id").notNull().references(() => quantumKeys.id),
  rotationReason: text("rotation_reason"), // scheduled, compromised, upgrade
  dataReEncrypted: integer("data_re_encrypted").default(0),
  initiatedById: varchar("initiated_by_id"),
  completedAt: timestamp("completed_at"),
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

// ============================================
// ENTERPRISE FEATURES - Insert Schemas & Types
// ============================================

// Agent Swarm Formation
export const insertAgentSwarmSchema = createInsertSchema(agentSwarms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  totalExecutions: true,
  successRate: true,
  formedAt: true,
  disbandedAt: true,
});

export const insertSwarmMemberSchema = createInsertSchema(swarmMembers).omit({
  id: true,
  joinedAt: true,
  leftAt: true,
  contributionScore: true,
  messagesProcessed: true,
  tasksCompleted: true,
});

export const insertSwarmExecutionSchema = createInsertSchema(swarmExecutions).omit({
  id: true,
  createdAt: true,
  status: true,
  memberOutputs: true,
  aggregatedOutput: true,
  consensusReached: true,
  executionTimeMs: true,
  totalCost: true,
  startedAt: true,
  completedAt: true,
});

// Integrations Hub
export const insertHubConnectorSchema = createInsertSchema(hubConnectors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  isVerified: true,
});

export const insertUserIntegrationSchema = createInsertSchema(userIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
});

// FinOps Monitoring
export const insertFinopsMetricSchema = createInsertSchema(finopsMetrics).omit({
  id: true,
  recordedAt: true,
});

export const insertCostBudgetSchema = createInsertSchema(costBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentSpend: true,
  alertSent: true,
});

export const insertFinopsOptimizationSchema = createInsertSchema(finopsOptimizations).omit({
  id: true,
  createdAt: true,
  isApplied: true,
  appliedAt: true,
});

// Predictive Analytics
export const insertAnalyticsForecastSchema = createInsertSchema(analyticsForecasts).omit({
  id: true,
  forecastedAt: true,
  actualOutcome: true,
  accuracy: true,
});

export const insertRiskScoreSchema = createInsertSchema(riskScores).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertTrendAnalyticSchema = createInsertSchema(trendAnalytics).omit({
  id: true,
  recordedAt: true,
});

// Agent Insurance & Tokenization
export const insertAgentInsuranceSchema = createInsertSchema(agentInsurance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  claimsCount: true,
  totalClaimsPaid: true,
});

export const insertInsuranceClaimSchema = createInsertSchema(insuranceClaims).omit({
  id: true,
  submittedAt: true,
  reviewedAt: true,
  paidAt: true,
  status: true,
  approvedAmount: true,
  reviewerNotes: true,
  reviewedById: true,
});

export const insertAgentTokenSchema = createInsertSchema(agentTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  circulatingSupply: true,
  marketCap: true,
  isListed: true,
});

export const insertTokenHoldingSchema = createInsertSchema(tokenHoldings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  royaltiesEarned: true,
});

// Localization
export const insertTranslationSchema = createInsertSchema(translations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isVerified: true,
  verifiedById: true,
});

export const insertUserLanguagePrefSchema = createInsertSchema(userLanguagePrefs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Quantum-safe Encryption
export const insertQuantumKeySchema = createInsertSchema(quantumKeys).omit({
  id: true,
  createdAt: true,
  status: true,
  lastUsedAt: true,
});

export const insertEncryptedDataSchema = createInsertSchema(encryptedData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKeyRotationHistorySchema = createInsertSchema(keyRotationHistory).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// ============================================
// MULTI-AGENT COLLABORATION (Enterprise Feature - Phase 1)
// ============================================

export const collaborationSessions = pgTable("collaboration_sessions", {
  id: serial("id").primaryKey(),
  swarmId: integer("swarm_id").references(() => agentSwarms.id, { onDelete: "cascade" }),
  bountyId: integer("bounty_id").references(() => bounties.id),
  name: text("name").notNull(),
  status: text("status").$type<"active" | "paused" | "completed" | "failed">().default("active"),
  sharedContext: text("shared_context"), // JSON: shared memory/context store
  taskGraph: text("task_graph"), // JSON: DAG of tasks with dependencies
  consensusLog: text("consensus_log"), // JSON: voting/consensus history
  totalMessages: integer("total_messages").default(0),
  totalTasks: integer("total_tasks").default(0),
  completedTasks: integer("completed_tasks").default(0),
  createdById: varchar("created_by_id").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collaborationMessages = pgTable("collaboration_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => collaborationSessions.id, { onDelete: "cascade" }),
  fromAgentId: integer("from_agent_id").references(() => agents.id),
  toAgentId: integer("to_agent_id").references(() => agents.id), // null = broadcast
  messageType: text("message_type").$type<"task" | "result" | "query" | "vote" | "status" | "error">().default("task"),
  content: text("content").notNull(),
  metadata: text("metadata"), // JSON: additional context
  isProcessed: boolean("is_processed").default(false),
  priority: integer("priority").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collaborationTasks = pgTable("collaboration_tasks", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => collaborationSessions.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull(), // UUID for DAG reference
  parentTaskId: text("parent_task_id"),
  assignedAgentId: integer("assigned_agent_id").references(() => agents.id),
  title: text("title").notNull(),
  description: text("description"),
  inputData: text("input_data"), // JSON
  outputData: text("output_data"), // JSON
  status: text("status").$type<"pending" | "assigned" | "running" | "completed" | "failed" | "blocked">().default("pending"),
  dependencies: text("dependencies").array().default([]), // task_ids that must complete first
  priority: integer("priority").default(5),
  estimatedDuration: integer("estimated_duration"), // seconds
  actualDuration: integer("actual_duration"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// AI AGENT EXECUTION (Enterprise Feature - Phase 1)
// ============================================

export const aiExecutionRuns = pgTable("ai_execution_runs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  bountyId: integer("bounty_id").references(() => bounties.id),
  submissionId: integer("submission_id").references(() => submissions.id),
  sessionId: integer("session_id").references(() => collaborationSessions.id),
  status: text("status").$type<"queued" | "running" | "completed" | "failed" | "cancelled">().default("queued"),
  input: text("input").notNull(),
  systemPrompt: text("system_prompt"),
  output: text("output"),
  model: text("model").default("gpt-4o"),
  provider: text("provider").default("openai"),
  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  costUsd: decimal("cost_usd", { precision: 12, scale: 6 }),
  executionTimeMs: integer("execution_time_ms"),
  toolCalls: text("tool_calls"), // JSON: function calls made
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  sandboxId: text("sandbox_id"), // QuickJS isolation ID
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// AUTOMATED VERIFICATION (Enterprise Feature - Phase 1)
// ============================================

export const verificationAudits = pgTable("verification_audits", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id),
  bountyId: integer("bounty_id").notNull().references(() => bounties.id),
  auditorType: text("auditor_type").$type<"ai" | "human" | "hybrid">().default("ai"),
  status: text("status").$type<"pending" | "in_progress" | "passed" | "failed" | "needs_review">().default("pending"),
  criteriaChecks: text("criteria_checks"), // JSON: individual criteria results
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  aiAnalysis: text("ai_analysis"),
  humanNotes: text("human_notes"),
  assignedReviewerId: varchar("assigned_reviewer_id"),
  passedCriteria: integer("passed_criteria").default(0),
  totalCriteria: integer("total_criteria").default(0),
  executionTimeMs: integer("execution_time_ms"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// ENTERPRISE TIER & SLAs (Enterprise Feature - Phase 2)
// ============================================

export const enterpriseTiers = ["starter", "professional", "business", "enterprise"] as const;
export const slaLevels = ["standard", "priority", "premium", "dedicated"] as const;

export const enterpriseSubscriptions = pgTable("enterprise_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  tier: text("tier").notNull().$type<typeof enterpriseTiers[number]>().default("starter"),
  slaLevel: text("sla_level").$type<typeof slaLevels[number]>().default("standard"),
  responseTimeSla: integer("response_time_sla"), // minutes
  uptimeGuarantee: decimal("uptime_guarantee", { precision: 5, scale: 2 }),
  dedicatedSupport: boolean("dedicated_support").default(false),
  customVerification: boolean("custom_verification").default(false),
  priorityExecution: boolean("priority_execution").default(false),
  apiRateLimit: integer("api_rate_limit"),
  maxAgents: integer("max_agents"),
  maxBounties: integer("max_bounties"),
  monthlyCredits: integer("monthly_credits"),
  usedCredits: integer("used_credits").default(0),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").$type<"active" | "cancelled" | "paused" | "trial">().default("active"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// AGENT REPUTATION SYSTEM (Enterprise Feature - Phase 3)
// ============================================

export const agentReputations = pgTable("agent_reputations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().unique().references(() => agents.id, { onDelete: "cascade" }),
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }).default("50"),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }).default("50"),
  reliabilityScore: decimal("reliability_score", { precision: 5, scale: 2 }).default("50"),
  speedScore: decimal("speed_score", { precision: 5, scale: 2 }).default("50"),
  communicationScore: decimal("communication_score", { precision: 5, scale: 2 }).default("50"),
  totalReviews: integer("total_reviews").default(0),
  positiveReviews: integer("positive_reviews").default(0),
  neutralReviews: integer("neutral_reviews").default(0),
  negativeReviews: integer("negative_reviews").default(0),
  completedBounties: integer("completed_bounties").default(0),
  failedBounties: integer("failed_bounties").default(0),
  disputesWon: integer("disputes_won").default(0),
  disputesLost: integer("disputes_lost").default(0),
  avgResponseTime: integer("avg_response_time"), // seconds
  avgCompletionTime: integer("avg_completion_time"), // seconds
  badges: text("badges").array().default([]),
  tier: text("tier").$type<"bronze" | "silver" | "gold" | "platinum" | "diamond">().default("bronze"),
  lastCalculatedAt: timestamp("last_calculated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reputationEvents = pgTable("reputation_events", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  eventType: text("event_type").$type<"review" | "completion" | "failure" | "dispute" | "badge" | "penalty">().notNull(),
  scoreChange: decimal("score_change", { precision: 5, scale: 2 }).notNull(),
  previousScore: decimal("previous_score", { precision: 5, scale: 2 }),
  newScore: decimal("new_score", { precision: 5, scale: 2 }),
  reason: text("reason"),
  relatedId: integer("related_id"), // bounty/review/dispute id
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// LIVE CHAT SUPPORT (Enterprise Feature - Phase 4)
// ============================================

export const liveChatSessions = pgTable("live_chat_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  assignedAgentId: varchar("assigned_agent_id"),
  status: text("status").$type<"waiting" | "active" | "resolved" | "abandoned">().default("waiting"),
  category: text("category").$type<"billing" | "technical" | "account" | "bounty" | "agent" | "general">().default("general"),
  priority: text("priority").$type<"low" | "medium" | "high" | "urgent">().default("medium"),
  subject: text("subject"),
  userSatisfaction: integer("user_satisfaction"), // 1-5
  totalMessages: integer("total_messages").default(0),
  firstResponseAt: timestamp("first_response_at"),
  resolvedAt: timestamp("resolved_at"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const liveChatMessages = pgTable("live_chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => liveChatSessions.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull(),
  senderType: text("sender_type").$type<"user" | "support" | "bot">().notNull(),
  content: text("content").notNull(),
  attachments: text("attachments").array().default([]),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// QUICK START / ONBOARDING (Enterprise Feature - Phase 4)
// ============================================

export const onboardingProgress = pgTable("onboarding_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  currentStep: integer("current_step").default(1),
  completedSteps: text("completed_steps").array().default([]),
  skippedSteps: text("skipped_steps").array().default([]),
  role: text("role").$type<"business" | "developer">(),
  goals: text("goals").array().default([]),
  preferences: text("preferences"), // JSON
  tourCompleted: boolean("tour_completed").default(false),
  profileCompleted: boolean("profile_completed").default(false),
  firstBountyCreated: boolean("first_bounty_created").default(false),
  firstAgentRegistered: boolean("first_agent_registered").default(false),
  firstSubmission: boolean("first_submission").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// CUSTOMIZABLE DASHBOARD (Enterprise Feature - Phase 3)
// ============================================

export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  widgetType: text("widget_type").notNull(), // performance, earnings, bounties, reputation, etc.
  title: text("title").notNull(),
  position: integer("position").default(0),
  size: text("size").$type<"small" | "medium" | "large" | "full">().default("medium"),
  config: text("config"), // JSON: widget-specific settings
  isVisible: boolean("is_visible").default(true),
  refreshInterval: integer("refresh_interval"), // seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dashboardLayouts = pgTable("dashboard_layouts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  layoutName: text("layout_name").default("default"),
  gridConfig: text("grid_config"), // JSON: grid layout configuration
  theme: text("theme").$type<"default" | "compact" | "expanded">().default("default"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Enterprise Types
export type AgentSwarm = typeof agentSwarms.$inferSelect;
export type InsertAgentSwarm = z.infer<typeof insertAgentSwarmSchema>;
export type SwarmMember = typeof swarmMembers.$inferSelect;
export type InsertSwarmMember = z.infer<typeof insertSwarmMemberSchema>;
export type SwarmExecution = typeof swarmExecutions.$inferSelect;
export type InsertSwarmExecution = z.infer<typeof insertSwarmExecutionSchema>;

export type HubConnector = typeof hubConnectors.$inferSelect;
export type InsertHubConnector = z.infer<typeof insertHubConnectorSchema>;
export type UserIntegration = typeof userIntegrations.$inferSelect;
export type InsertUserIntegration = z.infer<typeof insertUserIntegrationSchema>;

export type FinopsMetric = typeof finopsMetrics.$inferSelect;
export type InsertFinopsMetric = z.infer<typeof insertFinopsMetricSchema>;
export type CostBudget = typeof costBudgets.$inferSelect;
export type InsertCostBudget = z.infer<typeof insertCostBudgetSchema>;
export type FinopsOptimization = typeof finopsOptimizations.$inferSelect;
export type InsertFinopsOptimization = z.infer<typeof insertFinopsOptimizationSchema>;

export type AnalyticsForecast = typeof analyticsForecasts.$inferSelect;
export type InsertAnalyticsForecast = z.infer<typeof insertAnalyticsForecastSchema>;
export type RiskScore = typeof riskScores.$inferSelect;
export type InsertRiskScore = z.infer<typeof insertRiskScoreSchema>;
export type TrendAnalytic = typeof trendAnalytics.$inferSelect;
export type InsertTrendAnalytic = z.infer<typeof insertTrendAnalyticSchema>;

export type AgentInsurance = typeof agentInsurance.$inferSelect;
export type InsertAgentInsurance = z.infer<typeof insertAgentInsuranceSchema>;
export type InsuranceClaim = typeof insuranceClaims.$inferSelect;
export type InsertInsuranceClaim = z.infer<typeof insertInsuranceClaimSchema>;
export type AgentToken = typeof agentTokens.$inferSelect;
export type InsertAgentToken = z.infer<typeof insertAgentTokenSchema>;
export type TokenHolding = typeof tokenHoldings.$inferSelect;
export type InsertTokenHolding = z.infer<typeof insertTokenHoldingSchema>;

export type Translation = typeof translations.$inferSelect;
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
export type UserLanguagePref = typeof userLanguagePrefs.$inferSelect;
export type InsertUserLanguagePref = z.infer<typeof insertUserLanguagePrefSchema>;

export type QuantumKey = typeof quantumKeys.$inferSelect;
export type InsertQuantumKey = z.infer<typeof insertQuantumKeySchema>;
export type EncryptedData = typeof encryptedData.$inferSelect;
export type InsertEncryptedData = z.infer<typeof insertEncryptedDataSchema>;
export type KeyRotationHistory = typeof keyRotationHistory.$inferSelect;
export type InsertKeyRotationHistory = z.infer<typeof insertKeyRotationHistorySchema>;

// Phase 1-4 Enterprise Types
export type CollaborationSession = typeof collaborationSessions.$inferSelect;
export type CollaborationMessage = typeof collaborationMessages.$inferSelect;
export type CollaborationTask = typeof collaborationTasks.$inferSelect;
export type AiExecutionRun = typeof aiExecutionRuns.$inferSelect;
export type VerificationAudit = typeof verificationAudits.$inferSelect;
export type EnterpriseSubscription = typeof enterpriseSubscriptions.$inferSelect;
export type AgentReputation = typeof agentReputations.$inferSelect;
export type ReputationEvent = typeof reputationEvents.$inferSelect;
export type LiveChatSession = typeof liveChatSessions.$inferSelect;
export type LiveChatMessage = typeof liveChatMessages.$inferSelect;
export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type DashboardWidget = typeof dashboardWidgets.$inferSelect;
export type DashboardLayout = typeof dashboardLayouts.$inferSelect;

// ==================== MAX TIER SANDBOX SYSTEM ====================

export const sandboxTiers = ["basic", "standard", "professional", "enterprise", "max"] as const;
export const sandboxRuntimes = ["quickjs", "wasmtime", "docker", "kubernetes", "firecracker"] as const;
export const securityLevels = ["minimal", "standard", "strict", "paranoid"] as const;
export const proxyRuleTypes = ["allow", "deny", "rate_limit", "transform"] as const;
export const violationSeverities = ["low", "medium", "high", "critical"] as const;

export const sandboxConfigurations = pgTable("sandbox_configurations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull().$type<typeof sandboxTiers[number]>().default("standard"),
  runtime: text("runtime").notNull().$type<typeof sandboxRuntimes[number]>().default("quickjs"),
  securityLevel: text("security_level").notNull().$type<typeof securityLevels[number]>().default("standard"),
  cpuCores: integer("cpu_cores").default(1),
  memoryMb: integer("memory_mb").default(512),
  timeoutMs: integer("timeout_ms").default(30000),
  maxCodeSizeKb: integer("max_code_size_kb").default(512),
  maxInputSizeKb: integer("max_input_size_kb").default(1024),
  allowFetch: boolean("allow_fetch").default(false),
  allowFs: boolean("allow_fs").default(false),
  allowNetworking: boolean("allow_networking").default(false),
  allowedDomains: text("allowed_domains").array(),
  blockedPatterns: text("blocked_patterns").array(),
  environmentVars: text("environment_vars"), // JSON encrypted
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sandboxSessions = pgTable("sandbox_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  configId: integer("config_id").references(() => sandboxConfigurations.id),
  agentId: integer("agent_id").references(() => agents.id),
  executionId: integer("execution_id").references(() => agentExecutions.id),
  status: text("status").notNull().$type<typeof executionStatuses[number]>().default("queued"),
  runtime: text("runtime").notNull().$type<typeof sandboxRuntimes[number]>(),
  cpuUsagePercent: decimal("cpu_usage_percent", { precision: 5, scale: 2 }),
  memoryUsedMb: integer("memory_used_mb"),
  peakMemoryMb: integer("peak_memory_mb"),
  networkBytesIn: integer("network_bytes_in").default(0),
  networkBytesOut: integer("network_bytes_out").default(0),
  filesystemOps: integer("filesystem_ops").default(0),
  apiCalls: integer("api_calls").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  exitCode: integer("exit_code"),
  outputHash: text("output_hash"),
  logs: text("logs"),
  errors: text("errors"),
  metadata: text("metadata"), // JSON
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const toolProxyRules = pgTable("tool_proxy_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  toolId: integer("tool_id").references(() => agentTools.id),
  ruleType: text("rule_type").notNull().$type<typeof proxyRuleTypes[number]>(),
  pattern: text("pattern").notNull(),
  action: text("action").notNull(), // JSON: action config
  rateLimit: integer("rate_limit"), // requests per minute
  priority: integer("priority").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const securityViolations = pgTable("security_violations", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  violationType: text("violation_type").notNull(),
  severity: text("severity").notNull().$type<typeof violationSeverities[number]>(),
  description: text("description").notNull(),
  stackTrace: text("stack_trace"),
  blockedAction: text("blocked_action"),
  metadata: text("metadata"), // JSON
  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blockchainProofs = pgTable("blockchain_proofs", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").references(() => agentExecutions.id),
  network: text("network").notNull().$type<typeof blockchainNetworks[number]>(),
  transactionHash: text("transaction_hash"),
  blockNumber: integer("block_number"),
  contractAddress: text("contract_address"),
  proofData: text("proof_data").notNull(), // JSON: Merkle proof
  inputHash: text("input_hash").notNull(),
  outputHash: text("output_hash").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  gasUsed: integer("gas_used"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const resourceQuotas = pgTable("resource_quotas", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  quotaType: text("quota_type").notNull(), // cpu_hours, memory_gb_hours, api_calls, storage_gb
  dailyLimit: integer("daily_limit"),
  monthlyLimit: integer("monthly_limit"),
  currentDaily: integer("current_daily").default(0),
  currentMonthly: integer("current_monthly").default(0),
  lastResetDaily: timestamp("last_reset_daily").defaultNow(),
  lastResetMonthly: timestamp("last_reset_monthly").defaultNow(),
  overage_allowed: boolean("overage_allowed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const anomalyDetections = pgTable("anomaly_detections", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id"),
  agentId: integer("agent_id").references(() => agents.id),
  anomalyType: text("anomaly_type").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(),
  baselineValue: decimal("baseline_value", { precision: 15, scale: 4 }),
  observedValue: decimal("observed_value", { precision: 15, scale: 4 }),
  deviation: decimal("deviation", { precision: 10, scale: 4 }),
  description: text("description").notNull(),
  autoResolved: boolean("auto_resolved").default(false),
  actionTaken: text("action_taken"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertSandboxConfigurationSchema = createInsertSchema(sandboxConfigurations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSandboxSessionSchema = createInsertSchema(sandboxSessions).omit({ id: true, createdAt: true });
export const insertToolProxyRuleSchema = createInsertSchema(toolProxyRules).omit({ id: true, createdAt: true });
export const insertSecurityViolationSchema = createInsertSchema(securityViolations).omit({ id: true, createdAt: true });
export const insertBlockchainProofSchema = createInsertSchema(blockchainProofs).omit({ id: true, createdAt: true });
export const insertResourceQuotaSchema = createInsertSchema(resourceQuotas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnomalyDetectionSchema = createInsertSchema(anomalyDetections).omit({ id: true, createdAt: true });

// Types
export type SandboxConfiguration = typeof sandboxConfigurations.$inferSelect;
export type InsertSandboxConfiguration = z.infer<typeof insertSandboxConfigurationSchema>;
export type SandboxSession = typeof sandboxSessions.$inferSelect;
export type InsertSandboxSession = z.infer<typeof insertSandboxSessionSchema>;
export type ToolProxyRule = typeof toolProxyRules.$inferSelect;
export type InsertToolProxyRule = z.infer<typeof insertToolProxyRuleSchema>;
export type SecurityViolation = typeof securityViolations.$inferSelect;
export type InsertSecurityViolation = z.infer<typeof insertSecurityViolationSchema>;
export type BlockchainProof = typeof blockchainProofs.$inferSelect;
export type InsertBlockchainProof = z.infer<typeof insertBlockchainProofSchema>;
export type ResourceQuota = typeof resourceQuotas.$inferSelect;
export type InsertResourceQuota = z.infer<typeof insertResourceQuotaSchema>;
export type AnomalyDetection = typeof anomalyDetections.$inferSelect;
export type InsertAnomalyDetection = z.infer<typeof insertAnomalyDetectionSchema>;
