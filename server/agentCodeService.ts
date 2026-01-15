/**
 * Agent Code Service - Handles agent code storage via R2
 *
 * Migrates agent code storage from DB blob to Cloudflare R2 for better
 * scalability and performance with large code files.
 */

import { r2Storage } from './r2Storage';
import { featureFlags } from './featureFlags';
import { db } from './db';
import { agentUploads } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface StoreCodeResult {
  success: boolean;
  r2CodeKey?: string;
  error?: string;
}

interface GetCodeResult {
  success: boolean;
  code?: string;
  source: 'r2' | 'db' | 'none';
  error?: string;
}

/**
 * Service for managing agent code storage in R2.
 * Provides migration path from DB blob storage to R2.
 */
class AgentCodeService {
  /**
   * Store agent code in R2 and update the database with the R2 key.
   * For full_code agents, this moves code from configJson to R2.
   */
  async storeCode(agentUploadId: number, code: string): Promise<StoreCodeResult> {
    if (!featureFlags.isEnabled('USE_R2_STORAGE') || !r2Storage.isAvailable()) {
      // R2 not enabled or not configured - code stays in DB
      return {
        success: true,
        error: 'R2 storage disabled or not configured, code stored in database',
      };
    }

    try {
      const r2CodeKey = `agent-uploads/${agentUploadId}/source.js`;
      const result = await r2Storage.uploadAgentCode(agentUploadId.toString(), code);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to upload code to R2',
        };
      }

      // Update the database with the R2 key
      await db.update(agentUploads)
        .set({
          r2CodeKey,
          updatedAt: new Date(),
        })
        .where(eq(agentUploads.id, agentUploadId));

      return {
        success: true,
        r2CodeKey,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to store agent code in R2: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Retrieve agent code, preferring R2 if available, falling back to DB.
   */
  async getCode(agentUploadId: number): Promise<GetCodeResult> {
    try {
      // First, check if we have an R2 key
      const [upload] = await db.select({
        r2CodeKey: agentUploads.r2CodeKey,
        configJson: agentUploads.configJson,
        prompt: agentUploads.prompt,
        uploadType: agentUploads.uploadType,
      })
        .from(agentUploads)
        .where(eq(agentUploads.id, agentUploadId));

      if (!upload) {
        return {
          success: false,
          source: 'none',
          error: 'Agent upload not found',
        };
      }

      // Try R2 first if we have a key and R2 storage is enabled
      if (upload.r2CodeKey && featureFlags.isEnabled('USE_R2_STORAGE') && r2Storage.isAvailable()) {
        const code = await r2Storage.downloadAgentCode(agentUploadId.toString());
        if (code) {
          return {
            success: true,
            code,
            source: 'r2',
          };
        }
        // R2 key exists but download failed - fall back to DB
        console.warn(`R2 download failed for agent ${agentUploadId}, falling back to DB`);
      }

      // Fall back to database
      const dbCode = upload.configJson || upload.prompt || null;
      if (dbCode) {
        return {
          success: true,
          code: dbCode,
          source: 'db',
        };
      }

      return {
        success: false,
        source: 'none',
        error: 'No code found for agent',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to get agent code: ${errorMessage}`);
      return {
        success: false,
        source: 'none',
        error: errorMessage,
      };
    }
  }

  /**
   * Delete agent code from R2.
   */
  async deleteCode(agentUploadId: number): Promise<boolean> {
    if (!featureFlags.isEnabled('USE_R2_STORAGE') || !r2Storage.isAvailable()) {
      return true;
    }

    try {
      // Check if we have an R2 key
      const [upload] = await db.select({
        r2CodeKey: agentUploads.r2CodeKey,
      })
        .from(agentUploads)
        .where(eq(agentUploads.id, agentUploadId));

      if (!upload?.r2CodeKey) {
        return true; // Nothing to delete
      }

      const deleted = await r2Storage.deleteAgentCode(agentUploadId.toString());

      if (deleted) {
        // Clear the R2 key from database
        await db.update(agentUploads)
          .set({
            r2CodeKey: null,
            updatedAt: new Date(),
          })
          .where(eq(agentUploads.id, agentUploadId));
      }

      return deleted;
    } catch (error) {
      console.error(`Failed to delete agent code from R2: ${error}`);
      return false;
    }
  }

  /**
   * Migrate an agent's code from DB to R2.
   * Returns true if migration was successful or not needed.
   */
  async migrateToR2(agentUploadId: number): Promise<boolean> {
    if (!featureFlags.isEnabled('USE_R2_STORAGE') || !r2Storage.isAvailable()) {
      return false;
    }

    try {
      const [upload] = await db.select({
        r2CodeKey: agentUploads.r2CodeKey,
        configJson: agentUploads.configJson,
        prompt: agentUploads.prompt,
        uploadType: agentUploads.uploadType,
      })
        .from(agentUploads)
        .where(eq(agentUploads.id, agentUploadId));

      if (!upload) {
        return false;
      }

      // Skip if already in R2
      if (upload.r2CodeKey) {
        return true;
      }

      // Only migrate full_code agents
      if (upload.uploadType !== 'full_code') {
        return true;
      }

      const code = upload.configJson || upload.prompt;
      if (!code) {
        return true; // Nothing to migrate
      }

      const result = await this.storeCode(agentUploadId, code);
      return result.success;
    } catch (error) {
      console.error(`Failed to migrate agent ${agentUploadId} to R2: ${error}`);
      return false;
    }
  }

  /**
   * Check if R2 storage is enabled and available for agent code.
   */
  isR2Available(): boolean {
    return featureFlags.isEnabled('USE_R2_STORAGE') && r2Storage.isAvailable();
  }
}

export const agentCodeService = new AgentCodeService();
