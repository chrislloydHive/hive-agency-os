#!/usr/bin/env npx tsx
/**
 * Migration: Auto-hydrate Programs for existing Strategy-linked Work
 *
 * This script finds Work items that have a strategyLink (linked to a Strategy tactic)
 * but no corresponding PlanningProgram, and creates Programs for them.
 *
 * This ensures the canonical model is maintained:
 *   Strategy → Program → Work
 *
 * Usage:
 *   npx tsx scripts/migrateWorkToPrograms.ts [--dry-run] [--company=<id>]
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getAllWorkItems, getWorkItemsForCompany } from '../lib/airtable/workItems';
import { listPlanningPrograms, createPlanningProgram } from '../lib/airtable/planningPrograms';
import type { PlanningProgramInput } from '../lib/types/program';
import type { WorkItemRecord } from '../lib/airtable/workItems';

interface MigrationStats {
  workItemsScanned: number;
  workItemsWithStrategyLink: number;
  programsAlreadyExist: number;
  programsCreated: number;
  errors: string[];
}

async function migrateWorkToPrograms(
  options: { dryRun?: boolean; companyId?: string } = {}
): Promise<MigrationStats> {
  const { dryRun = false, companyId } = options;
  const stats: MigrationStats = {
    workItemsScanned: 0,
    workItemsWithStrategyLink: 0,
    programsAlreadyExist: 0,
    programsCreated: 0,
    errors: [],
  };

  console.log('[Migration] Starting Work → Program migration...');
  console.log(`[Migration] Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  try {
    // Get all work items (optionally filtered by company)
    const workItems = companyId
      ? await getWorkItemsForCompany(companyId)
      : await getAllWorkItems();
    stats.workItemsScanned = workItems.length;
    console.log(`[Migration] Found ${workItems.length} work items`);

    // Group work items by strategy and tactic
    const workByStrategyTactic = new Map<string, WorkItemRecord[]>();

    for (const item of workItems) {
      if (!item.strategyLink?.strategyId || !item.strategyLink?.tacticId) {
        continue;
      }

      stats.workItemsWithStrategyLink++;
      const key = `${item.strategyLink.strategyId}::${item.strategyLink.tacticId}`;

      if (!workByStrategyTactic.has(key)) {
        workByStrategyTactic.set(key, []);
      }
      workByStrategyTactic.get(key)!.push(item);
    }

    console.log(`[Migration] Found ${stats.workItemsWithStrategyLink} work items with strategy links`);
    console.log(`[Migration] Grouped into ${workByStrategyTactic.size} unique strategy::tactic pairs`);

    // Process each strategy::tactic pair
    for (const [key, items] of workByStrategyTactic) {
      const [strategyId, tacticId] = key.split('::');
      const firstItem = items[0];

      // Check if program already exists
      const itemCompanyId = firstItem.companyId;
      if (!itemCompanyId) {
        stats.errors.push(`Work item has no companyId: ${firstItem.id}`);
        continue;
      }

      const existingPrograms = await listPlanningPrograms(itemCompanyId, strategyId);
      const existingProgram = existingPrograms.find(
        (p) => p.origin.tacticId === tacticId
      );

      if (existingProgram) {
        stats.programsAlreadyExist++;
        console.log(`[Migration] Program already exists for tactic "${tacticId}": ${existingProgram.title}`);
        continue;
      }

      // Build program from work items
      const tacticTitle = firstItem.strategyLink?.tacticTitle || firstItem.title;
      const programInput: PlanningProgramInput = {
        companyId: itemCompanyId,
        strategyId,
        title: tacticTitle,
        stableKey: `${strategyId}::${tacticId}`,
        status: 'committed', // Already committed since work exists
        origin: {
          strategyId,
          tacticId,
          tacticTitle,
        },
        scope: {
          summary: `Migrated from existing work items (${items.length} items)`,
          deliverables: items.map((item) => ({
            id: `del_${item.id}`,
            title: item.title,
            type: 'other' as const,
            status: 'completed' as const,
            description: item.notes || undefined,
          })),
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
        planDetails: {
          horizonDays: 90,
          milestones: [],
        },
        success: {
          kpis: [],
        },
        commitment: {
          committedAt: new Date().toISOString(),
          workItemIds: items.map((item) => item.id),
        },
        linkedArtifacts: [],
        workPlanVersion: 0,
      };

      if (dryRun) {
        console.log(`[Migration] [DRY RUN] Would create program: "${tacticTitle}" with ${items.length} work items`);
        stats.programsCreated++;
      } else {
        try {
          const program = await createPlanningProgram(programInput);
          if (program) {
            console.log(`[Migration] Created program: "${program.title}" (${program.id})`);
            stats.programsCreated++;
          } else {
            stats.errors.push(`Failed to create program for tactic ${tacticId}: createPlanningProgram returned null`);
            console.error(`[Migration] createPlanningProgram returned null for tactic:`, tacticId);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          stats.errors.push(`Failed to create program for tactic ${tacticId}: ${errMsg}`);
          console.error(`[Migration] Error creating program:`, err);
        }
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    stats.errors.push(`Fatal error: ${errMsg}`);
    console.error('[Migration] Fatal error:', err);
  }

  // Print summary
  console.log('\n[Migration] === Summary ===');
  console.log(`[Migration] Work items scanned: ${stats.workItemsScanned}`);
  console.log(`[Migration] Work items with strategy link: ${stats.workItemsWithStrategyLink}`);
  console.log(`[Migration] Programs already exist: ${stats.programsAlreadyExist}`);
  console.log(`[Migration] Programs created: ${stats.programsCreated}`);

  if (stats.errors.length > 0) {
    console.log(`[Migration] Errors: ${stats.errors.length}`);
    stats.errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log('[Migration] Done!');
  return stats;
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const companyArg = args.find((a) => a.startsWith('--company='));
const companyId = companyArg?.split('=')[1];

migrateWorkToPrograms({ dryRun, companyId }).catch(console.error);
