import { base } from '@/lib/airtable/client';
import { getTableName } from '@/lib/airtable/tables';
import type { ResetTableConfig, CompanyRef } from './resetConfig';
import { RESET_TABLES, RESET_DELETE_ORDER } from './resetConfig';

const DEFAULT_REF_CANDIDATES: CompanyRef[] = [
  { type: 'text', fieldName: 'companyId' },
  { type: 'linked', fieldName: 'Company' },
  { type: 'text', fieldName: 'Company ID' },
  { type: 'linked', fieldName: 'Company ID' },
  { type: 'text', fieldName: 'Company Id' },
  { type: 'linked', fieldName: 'Company Id' },
  { type: 'text', fieldName: 'company_id' },
];

export type ResetMode = 'dryRun' | 'apply';
export type ResetKind = 'soft' | 'hard';

export interface ResetTableInventory {
  tableKey: string;
  tableName: string;
  category: ResetTableConfig['category'];
  matchFormula: string;
  refUsed?: CompanyRef;
  matchedCount: number;
  softSupported: boolean;
  actionPlanned: 'softArchive' | 'hardDelete' | 'skip';
}

export interface ResetInventoryReport {
  companyId: string;
  mode: ResetMode;
  resetKind: ResetKind;
  resetBatchId: string;
  totals: {
    tablesConsidered: number;
    tablesMatched: number;
    recordsMatched: number;
  };
  tables: ResetTableInventory[];
  warnings: string[];
}

/**
 * Build Airtable formula for matching company records.
 * - Text fields: exact match
 * - Linked fields: FIND in ARRAYJOIN (handles linked record arrays)
 */
export function buildMatchFormula(ref: CompanyRef, companyId: string): string {
  if (ref.type === 'text') {
    return `{${ref.fieldName}}="${companyId}"`;
  }
  // Linked record fields return arrays - use FIND in ARRAYJOIN
  return `FIND("${companyId}", ARRAYJOIN({${ref.fieldName}}))>0`;
}

/**
 * Count records matching a formula. Uses pagination for efficiency.
 */
async function countRecords(tableName: string, formula: string): Promise<number> {
  let count = 0;
  const table = base(tableName).select({ filterByFormula: formula, pageSize: 100 });
  await table.eachPage((records, fetchNextPage) => {
    count += records.length;
    fetchNextPage();
  });
  return count;
}

/**
 * Try candidate refs in order until one succeeds.
 * Returns the successful ref, formula, count, and any error from the last failed attempt.
 */
async function tryCountWithCandidates(
  tableName: string,
  companyId: string,
  candidates: CompanyRef[]
): Promise<{
  refUsed?: CompanyRef;
  matchFormula: string;
  matchedCount: number;
  lastError?: string;
}> {
  let lastError: string | undefined;

  for (const ref of candidates) {
    const formula = buildMatchFormula(ref, companyId);
    try {
      const count = await countRecords(tableName, formula);
      // Success - return immediately
      return {
        refUsed: ref,
        matchFormula: formula,
        matchedCount: count,
      };
    } catch (err) {
      const msg = (err as Error).message || String(err);
      lastError = msg;

      // Unknown field error - try next candidate
      if (msg.toLowerCase().includes('unknown field')) {
        continue;
      }

      // Auth or rate limit errors - check if we should continue
      if (msg.toLowerCase().includes('not_authorized') || msg.toLowerCase().includes('forbidden')) {
        // Auth error - try next candidate (table might have different permissions)
        continue;
      }

      // Other errors (network, etc.) - stop trying this table
      break;
    }
  }

  // All candidates failed
  return {
    matchFormula: '',
    matchedCount: 0,
    lastError,
  };
}

/**
 * Build a complete inventory of records to reset for a company.
 * Iterates through all reset tables, trying candidate refs in order.
 */
export async function buildResetInventory(input: {
  companyId: string;
  mode: ResetMode;
  resetKind: ResetKind;
  resetBatchId: string;
}): Promise<ResetInventoryReport> {
  const { companyId, resetKind, resetBatchId, mode } = input;
  const warnings: string[] = [];
  const tables: ResetTableInventory[] = [];
  let recordsMatched = 0;
  let tablesMatched = 0;

  for (const category of RESET_DELETE_ORDER) {
    const tablesInCategory = RESET_TABLES.filter(t => t.category === category);

    for (const cfg of tablesInCategory) {
      const tableName = getTableName(cfg.tableKey);

      // Build candidate list: primary + specific overrides + defaults
      const candidates = [
        cfg.companyRef,
        ...(cfg.candidateRefs || []),
        ...DEFAULT_REF_CANDIDATES,
      ];

      // Try candidates in order
      const result = await tryCountWithCandidates(tableName, companyId, candidates);

      // Track warnings for failed lookups
      if (result.lastError && !result.refUsed) {
        warnings.push(
          `[${cfg.tableKey}] All candidate refs failed. Last error: ${result.lastError}`
        );
      } else if (result.lastError && result.refUsed) {
        // Partial success - some candidates failed before finding a working one
        // This is informational, not a warning
      }

      const softSupported = Boolean(
        cfg.softFields &&
        cfg.softFields.isArchivedField &&
        cfg.softFields.resetBatchIdField
      );

      const actionPlanned: ResetTableInventory['actionPlanned'] =
        result.matchedCount === 0
          ? 'skip'
          : resetKind === 'hard'
          ? 'hardDelete'
          : softSupported
          ? 'softArchive'
          : 'skip';

      if (result.matchedCount > 0) {
        tablesMatched += 1;
        recordsMatched += result.matchedCount;
      }

      tables.push({
        tableKey: cfg.tableKey,
        tableName,
        category: cfg.category,
        matchFormula: result.matchFormula,
        refUsed: result.refUsed,
        matchedCount: result.matchedCount,
        softSupported,
        actionPlanned,
      });
    }
  }

  return {
    companyId,
    mode,
    resetKind,
    resetBatchId,
    totals: {
      tablesConsidered: RESET_TABLES.length,
      tablesMatched,
      recordsMatched,
    },
    tables,
    warnings,
  };
}
