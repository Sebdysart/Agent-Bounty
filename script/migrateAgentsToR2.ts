/**
 * Migration script for existing agents - migrates code from DB to R2
 *
 * Usage: npx tsx script/migrateAgentsToR2.ts [--dry-run]
 *
 * Options:
 *   --dry-run  Show what would be migrated without making changes
 */

import { db } from '../server/db';
import { agentUploads } from '@shared/schema';
import { r2Storage } from '../server/r2Storage';
import { agentCodeService } from '../server/agentCodeService';
import { isNull, eq } from 'drizzle-orm';

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}

async function migrateAgentsToR2(dryRun: boolean = false): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Check R2 availability
  if (!r2Storage.isAvailable()) {
    console.error('R2 storage is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.');
    return result;
  }

  console.log('R2 storage is available. Starting migration...\n');

  // Get all agents that need migration:
  // - full_code type (these have actual code in configJson)
  // - no r2CodeKey set yet
  // - have code in configJson or prompt
  const agentsToMigrate = await db.select({
    id: agentUploads.id,
    name: agentUploads.name,
    uploadType: agentUploads.uploadType,
    configJson: agentUploads.configJson,
    prompt: agentUploads.prompt,
    r2CodeKey: agentUploads.r2CodeKey,
  })
    .from(agentUploads)
    .where(isNull(agentUploads.r2CodeKey));

  result.total = agentsToMigrate.length;

  console.log(`Found ${result.total} agents without R2 code key\n`);

  for (const agent of agentsToMigrate) {
    const code = agent.configJson || agent.prompt;

    // Skip if no code to migrate
    if (!code) {
      console.log(`[SKIP] Agent ${agent.id} (${agent.name}): No code to migrate`);
      result.skipped++;
      continue;
    }

    // Only migrate full_code agents - others use prompt/config differently
    if (agent.uploadType !== 'full_code') {
      console.log(`[SKIP] Agent ${agent.id} (${agent.name}): Not full_code type (${agent.uploadType})`);
      result.skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY-RUN] Would migrate Agent ${agent.id} (${agent.name}): ${code.length} bytes`);
      result.migrated++;
      continue;
    }

    try {
      const success = await agentCodeService.migrateToR2(agent.id);

      if (success) {
        console.log(`[OK] Migrated Agent ${agent.id} (${agent.name}): ${code.length} bytes`);
        result.migrated++;
      } else {
        console.error(`[FAIL] Agent ${agent.id} (${agent.name}): Migration returned false`);
        result.failed++;
        result.errors.push({ id: agent.id, error: 'Migration returned false' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[FAIL] Agent ${agent.id} (${agent.name}): ${errorMessage}`);
      result.failed++;
      result.errors.push({ id: agent.id, error: errorMessage });
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Agent Code Migration to R2');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('='.repeat(60));
  console.log();

  try {
    const result = await migrateAgentsToR2(dryRun);

    console.log();
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total agents checked: ${result.total}`);
    console.log(`Successfully migrated: ${result.migrated}`);
    console.log(`Skipped (no code or non-full_code): ${result.skipped}`);
    console.log(`Failed: ${result.failed}`);

    if (result.errors.length > 0) {
      console.log();
      console.log('Errors:');
      for (const err of result.errors) {
        console.log(`  - Agent ${err.id}: ${err.error}`);
      }
    }

    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Migration failed with error:', error);
    process.exit(1);
  }
}

// Only run main when executed directly, not when imported
const isDirectRun = process.argv[1]?.includes('migrateAgentsToR2');
if (isDirectRun) {
  main();
}

export { migrateAgentsToR2 };
