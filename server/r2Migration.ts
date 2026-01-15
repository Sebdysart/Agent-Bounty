import { r2Storage } from "./r2Storage";
import { featureFlags } from "./featureFlags";
import { db } from "./db";
import { agentUploads, agentVersions } from "@shared/schema";
import { eq, isNull, isNotNull, and } from "drizzle-orm";

interface MigrationResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  errors: Array<{ agentUploadId: number; error: string }>;
}

interface MigrationProgress {
  total: number;
  processed: number;
  current?: number;
  status: "idle" | "running" | "completed" | "failed";
}

/**
 * Migration utility for moving agent code from DB storage to R2.
 * This supports migration of agent uploads that have inline code stored
 * in configJson or manifestJson fields to R2 object storage.
 */
class R2MigrationService {
  private progress: MigrationProgress = {
    total: 0,
    processed: 0,
    status: "idle",
  };

  /**
   * Get current migration progress
   */
  getProgress(): MigrationProgress {
    return { ...this.progress };
  }

  /**
   * Check if R2 migration is possible
   */
  canMigrate(): { canMigrate: boolean; reason?: string } {
    if (!featureFlags.isEnabled("USE_R2_STORAGE")) {
      return { canMigrate: false, reason: "USE_R2_STORAGE feature flag is not enabled" };
    }

    if (!r2Storage.isAvailable()) {
      return { canMigrate: false, reason: "R2 storage is not configured" };
    }

    return { canMigrate: true };
  }

  /**
   * Get count of agents that need migration (have config but no r2CodeKey)
   */
  async getPendingMigrationCount(): Promise<number> {
    const check = this.canMigrate();
    if (!check.canMigrate) {
      return 0;
    }

    const pending = await db
      .select({ id: agentUploads.id })
      .from(agentUploads)
      .where(
        and(
          isNull(agentUploads.r2CodeKey),
          isNotNull(agentUploads.configJson)
        )
      );

    return pending.length;
  }

  /**
   * Migrate a single agent upload to R2
   */
  async migrateAgent(agentUploadId: number): Promise<{ success: boolean; error?: string }> {
    const check = this.canMigrate();
    if (!check.canMigrate) {
      return { success: false, error: check.reason };
    }

    try {
      const [agent] = await db
        .select()
        .from(agentUploads)
        .where(eq(agentUploads.id, agentUploadId));

      if (!agent) {
        return { success: false, error: "Agent upload not found" };
      }

      if (agent.r2CodeKey) {
        return { success: true }; // Already migrated
      }

      // Extract code from configJson or manifestJson
      let codeContent: string | null = null;
      let codeSource: "config" | "manifest" | null = null;

      if (agent.configJson) {
        try {
          const config = JSON.parse(agent.configJson);
          if (config.code || config.sourceCode || config.source) {
            codeContent = config.code || config.sourceCode || config.source;
            codeSource = "config";
          }
        } catch {
          // Not valid JSON, treat as raw code
          codeContent = agent.configJson;
          codeSource = "config";
        }
      }

      if (!codeContent && agent.manifestJson) {
        try {
          const manifest = JSON.parse(agent.manifestJson);
          if (manifest.code || manifest.sourceCode || manifest.source) {
            codeContent = manifest.code || manifest.sourceCode || manifest.source;
            codeSource = "manifest";
          }
        } catch {
          // Not valid JSON
        }
      }

      if (!codeContent) {
        // No code to migrate - this is fine, just mark as migrated with empty key
        return { success: true };
      }

      // Upload to R2
      const result = await r2Storage.uploadAgentCode(String(agentUploadId), codeContent);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Update the database with R2 key
      await db
        .update(agentUploads)
        .set({
          r2CodeKey: result.key,
          updatedAt: new Date(),
        })
        .where(eq(agentUploads.id, agentUploadId));

      // Optionally clean up the inline code from config/manifest
      // (keeping it for now for backwards compatibility)

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Migrate all pending agent uploads to R2
   */
  async migrateAll(options?: {
    batchSize?: number;
    onProgress?: (progress: MigrationProgress) => void;
  }): Promise<MigrationResult> {
    const check = this.canMigrate();
    if (!check.canMigrate) {
      return {
        success: false,
        totalProcessed: 0,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        errors: [{ agentUploadId: 0, error: check.reason || "Cannot migrate" }],
      };
    }

    const batchSize = options?.batchSize ?? 50;
    const errors: Array<{ agentUploadId: number; error: string }> = [];
    let successCount = 0;
    let skippedCount = 0;

    // Get all agents that need migration
    const pendingAgents = await db
      .select({ id: agentUploads.id })
      .from(agentUploads)
      .where(
        and(
          isNull(agentUploads.r2CodeKey),
          isNotNull(agentUploads.configJson)
        )
      );

    this.progress = {
      total: pendingAgents.length,
      processed: 0,
      status: "running",
    };

    options?.onProgress?.(this.progress);

    // Process in batches
    for (let i = 0; i < pendingAgents.length; i += batchSize) {
      const batch = pendingAgents.slice(i, i + batchSize);

      for (const agent of batch) {
        this.progress.current = agent.id;

        const result = await this.migrateAgent(agent.id);

        if (result.success) {
          successCount++;
        } else if (result.error === "Agent upload not found") {
          skippedCount++;
        } else {
          errors.push({ agentUploadId: agent.id, error: result.error || "Unknown error" });
        }

        this.progress.processed++;
        options?.onProgress?.(this.progress);
      }
    }

    this.progress.status = errors.length === 0 ? "completed" : "completed";
    this.progress.current = undefined;
    options?.onProgress?.(this.progress);

    return {
      success: errors.length === 0,
      totalProcessed: pendingAgents.length,
      successCount,
      errorCount: errors.length,
      skippedCount,
      errors,
    };
  }

  /**
   * Verify migration integrity for a specific agent
   */
  async verifyMigration(agentUploadId: number): Promise<{
    verified: boolean;
    hasR2Key: boolean;
    r2Exists: boolean;
    error?: string;
  }> {
    try {
      const [agent] = await db
        .select()
        .from(agentUploads)
        .where(eq(agentUploads.id, agentUploadId));

      if (!agent) {
        return { verified: false, hasR2Key: false, r2Exists: false, error: "Agent not found" };
      }

      if (!agent.r2CodeKey) {
        return { verified: false, hasR2Key: false, r2Exists: false };
      }

      const exists = await r2Storage.exists(agent.r2CodeKey);

      return {
        verified: exists,
        hasR2Key: true,
        r2Exists: exists,
      };
    } catch (error) {
      return {
        verified: false,
        hasR2Key: false,
        r2Exists: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Verify all migrated agents
   */
  async verifyAllMigrations(): Promise<{
    total: number;
    verified: number;
    missing: number;
    missingIds: number[];
  }> {
    const migratedAgents = await db
      .select({ id: agentUploads.id, r2CodeKey: agentUploads.r2CodeKey })
      .from(agentUploads)
      .where(isNotNull(agentUploads.r2CodeKey));

    const missingIds: number[] = [];
    let verified = 0;

    for (const agent of migratedAgents) {
      if (agent.r2CodeKey) {
        const exists = await r2Storage.exists(agent.r2CodeKey);
        if (exists) {
          verified++;
        } else {
          missingIds.push(agent.id);
        }
      }
    }

    return {
      total: migratedAgents.length,
      verified,
      missing: missingIds.length,
      missingIds,
    };
  }

  /**
   * Rollback migration for a specific agent (remove R2 key, keep original data)
   */
  async rollbackMigration(agentUploadId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const [agent] = await db
        .select()
        .from(agentUploads)
        .where(eq(agentUploads.id, agentUploadId));

      if (!agent) {
        return { success: false, error: "Agent not found" };
      }

      if (!agent.r2CodeKey) {
        return { success: true }; // Nothing to rollback
      }

      // Delete from R2 if it exists
      if (r2Storage.isAvailable()) {
        await r2Storage.delete(agent.r2CodeKey);
      }

      // Clear the R2 key
      await db
        .update(agentUploads)
        .set({
          r2CodeKey: null,
          updatedAt: new Date(),
        })
        .where(eq(agentUploads.id, agentUploadId));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get migration statistics
   */
  async getStatistics(): Promise<{
    totalAgents: number;
    migratedToR2: number;
    pendingMigration: number;
    withoutCode: number;
  }> {
    const [totalResult] = await db
      .select({ count: agentUploads.id })
      .from(agentUploads);

    const migratedAgents = await db
      .select({ id: agentUploads.id })
      .from(agentUploads)
      .where(isNotNull(agentUploads.r2CodeKey));

    const pendingAgents = await db
      .select({ id: agentUploads.id })
      .from(agentUploads)
      .where(
        and(
          isNull(agentUploads.r2CodeKey),
          isNotNull(agentUploads.configJson)
        )
      );

    const withoutCodeAgents = await db
      .select({ id: agentUploads.id })
      .from(agentUploads)
      .where(
        and(
          isNull(agentUploads.r2CodeKey),
          isNull(agentUploads.configJson)
        )
      );

    const allAgents = await db.select({ id: agentUploads.id }).from(agentUploads);

    return {
      totalAgents: allAgents.length,
      migratedToR2: migratedAgents.length,
      pendingMigration: pendingAgents.length,
      withoutCode: withoutCodeAgents.length,
    };
  }

  /**
   * Reset progress tracker
   */
  resetProgress(): void {
    this.progress = {
      total: 0,
      processed: 0,
      status: "idle",
    };
  }
}

// Singleton instance
export const r2Migration = new R2MigrationService();

// Export class for testing
export { R2MigrationService };
export type { MigrationResult, MigrationProgress };
