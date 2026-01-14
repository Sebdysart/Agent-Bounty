/**
 * R2 Cleanup Job - Removes orphaned files from Cloudflare R2 storage
 *
 * Orphaned files are R2 objects that no longer have corresponding database records:
 * - Agent code files without matching agentUploads record
 * - Submission artifacts without matching submissions record
 */

import { r2Storage } from "./r2Storage";
import { db } from "./db";
import { agentUploads, submissions } from "@shared/schema";
import { inArray } from "drizzle-orm";

export interface CleanupResult {
  success: boolean;
  orphanedAgentFiles: number;
  orphanedSubmissionFiles: number;
  deletedAgentFiles: number;
  deletedSubmissionFiles: number;
  errors: string[];
  durationMs: number;
}

export interface CleanupOptions {
  dryRun?: boolean;
  maxFilesToDelete?: number;
}

/**
 * Extract agent ID from R2 key (e.g., "agents/123/source.js" -> "123")
 */
function extractAgentIdFromKey(key: string): string | null {
  const match = key.match(/^agents\/(\d+)\//);
  return match ? match[1] : null;
}

/**
 * Extract submission ID from R2 key (e.g., "submissions/456/artifacts/file.json" -> "456")
 */
function extractSubmissionIdFromKey(key: string): string | null {
  const match = key.match(/^submissions\/(\d+)\//);
  return match ? match[1] : null;
}

/**
 * Find orphaned agent files in R2 that don't have matching DB records
 */
async function findOrphanedAgentFiles(): Promise<string[]> {
  if (!r2Storage.isAvailable()) {
    return [];
  }

  // List all agent files in R2
  const agentKeys = await r2Storage.list("agents/", 10000);
  if (agentKeys.length === 0) {
    return [];
  }

  // Extract unique agent IDs from R2 keys
  const r2AgentIds = new Set<string>();
  for (const key of agentKeys) {
    const agentId = extractAgentIdFromKey(key);
    if (agentId) {
      r2AgentIds.add(agentId);
    }
  }

  if (r2AgentIds.size === 0) {
    return [];
  }

  // Query DB for existing agent uploads
  const existingAgents = await db
    .select({ id: agentUploads.id })
    .from(agentUploads)
    .where(inArray(agentUploads.id, Array.from(r2AgentIds).map(Number)));

  const existingAgentIds = new Set(existingAgents.map((a) => String(a.id)));

  // Find orphaned keys (in R2 but not in DB)
  const orphanedKeys: string[] = [];
  for (const key of agentKeys) {
    const agentId = extractAgentIdFromKey(key);
    if (agentId && !existingAgentIds.has(agentId)) {
      orphanedKeys.push(key);
    }
  }

  return orphanedKeys;
}

/**
 * Find orphaned submission files in R2 that don't have matching DB records
 */
async function findOrphanedSubmissionFiles(): Promise<string[]> {
  if (!r2Storage.isAvailable()) {
    return [];
  }

  // List all submission files in R2
  const submissionKeys = await r2Storage.list("submissions/", 10000);
  if (submissionKeys.length === 0) {
    return [];
  }

  // Extract unique submission IDs from R2 keys
  const r2SubmissionIds = new Set<string>();
  for (const key of submissionKeys) {
    const submissionId = extractSubmissionIdFromKey(key);
    if (submissionId) {
      r2SubmissionIds.add(submissionId);
    }
  }

  if (r2SubmissionIds.size === 0) {
    return [];
  }

  // Query DB for existing submissions
  const existingSubmissions = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(inArray(submissions.id, Array.from(r2SubmissionIds).map(Number)));

  const existingSubmissionIds = new Set(existingSubmissions.map((s) => String(s.id)));

  // Find orphaned keys (in R2 but not in DB)
  const orphanedKeys: string[] = [];
  for (const key of submissionKeys) {
    const submissionId = extractSubmissionIdFromKey(key);
    if (submissionId && !existingSubmissionIds.has(submissionId)) {
      orphanedKeys.push(key);
    }
  }

  return orphanedKeys;
}

/**
 * Delete orphaned files from R2
 */
async function deleteOrphanedFiles(
  keys: string[],
  maxToDelete: number
): Promise<{ deleted: number; errors: string[] }> {
  let deleted = 0;
  const errors: string[] = [];
  const keysToDelete = keys.slice(0, maxToDelete);

  for (const key of keysToDelete) {
    try {
      const success = await r2Storage.delete(key);
      if (success) {
        deleted++;
      } else {
        errors.push(`Failed to delete: ${key}`);
      }
    } catch (error) {
      errors.push(`Error deleting ${key}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return { deleted, errors };
}

/**
 * Run the R2 cleanup job to remove orphaned files
 */
export async function runR2CleanupJob(options: CleanupOptions = {}): Promise<CleanupResult> {
  const { dryRun = false, maxFilesToDelete = 1000 } = options;
  const startTime = Date.now();
  const errors: string[] = [];

  let orphanedAgentKeys: string[] = [];
  let orphanedSubmissionKeys: string[] = [];
  let deletedAgentFiles = 0;
  let deletedSubmissionFiles = 0;

  try {
    // Check if R2 is available
    if (!r2Storage.isAvailable()) {
      return {
        success: false,
        orphanedAgentFiles: 0,
        orphanedSubmissionFiles: 0,
        deletedAgentFiles: 0,
        deletedSubmissionFiles: 0,
        errors: ["R2 storage is not configured"],
        durationMs: Date.now() - startTime,
      };
    }

    // Find orphaned files
    orphanedAgentKeys = await findOrphanedAgentFiles();
    orphanedSubmissionKeys = await findOrphanedSubmissionFiles();

    if (!dryRun) {
      // Delete orphaned agent files
      if (orphanedAgentKeys.length > 0) {
        const agentResult = await deleteOrphanedFiles(
          orphanedAgentKeys,
          Math.floor(maxFilesToDelete / 2)
        );
        deletedAgentFiles = agentResult.deleted;
        errors.push(...agentResult.errors);
      }

      // Delete orphaned submission files
      if (orphanedSubmissionKeys.length > 0) {
        const submissionResult = await deleteOrphanedFiles(
          orphanedSubmissionKeys,
          Math.floor(maxFilesToDelete / 2)
        );
        deletedSubmissionFiles = submissionResult.deleted;
        errors.push(...submissionResult.errors);
      }
    }

    console.log(
      `R2 Cleanup ${dryRun ? "(dry run)" : ""}: ` +
      `Found ${orphanedAgentKeys.length} orphaned agent files, ` +
      `${orphanedSubmissionKeys.length} orphaned submission files. ` +
      `Deleted ${deletedAgentFiles} agent files, ${deletedSubmissionFiles} submission files.`
    );

    return {
      success: errors.length === 0,
      orphanedAgentFiles: orphanedAgentKeys.length,
      orphanedSubmissionFiles: orphanedSubmissionKeys.length,
      deletedAgentFiles,
      deletedSubmissionFiles,
      errors,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Cleanup job failed: ${errorMessage}`);
    console.error("R2 Cleanup job error:", error);

    return {
      success: false,
      orphanedAgentFiles: orphanedAgentKeys.length,
      orphanedSubmissionFiles: orphanedSubmissionKeys.length,
      deletedAgentFiles,
      deletedSubmissionFiles,
      errors,
      durationMs: Date.now() - startTime,
    };
  }
}

// Export individual functions for testing
export {
  findOrphanedAgentFiles,
  findOrphanedSubmissionFiles,
  extractAgentIdFromKey,
  extractSubmissionIdFromKey,
};
