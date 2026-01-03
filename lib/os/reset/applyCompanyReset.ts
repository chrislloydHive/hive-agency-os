import { base } from '@/lib/airtable/client';
import { getTableName } from '@/lib/airtable/tables';
import { RESET_TABLES, RESET_DELETE_ORDER } from './resetConfig';
import type { ResetKind, ResetMode, ResetInventoryReport } from './buildResetInventory';
import { buildResetInventory } from './buildResetInventory';

interface ApplyInput {
  companyId: string;
  mode: ResetMode;
  resetKind: ResetKind;
  resetBatchId: string;
  confirmHardDelete?: boolean;
}

export interface ResetApplyResult {
  report: ResetInventoryReport;
  applied: Array<{ tableKey: string; updated: number; deleted: number }>;
}

async function batchUpdate(
  tableName: string,
  recordIds: string[],
  fields: Record<string, unknown>
): Promise<number> {
  let updated = 0;
  for (let i = 0; i < recordIds.length; i += 10) {
    const chunk = recordIds.slice(i, i + 10);
    // Use Airtable's update - cast to any to avoid FieldSet type issues with dynamic fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await base(tableName).update(chunk.map((id) => ({ id, fields })) as any);
    updated += chunk.length;
  }
  return updated;
}

async function batchDelete(tableName: string, recordIds: string[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < recordIds.length; i += 10) {
    const chunk = recordIds.slice(i, i + 10);
    await base(tableName).destroy(chunk);
    deleted += chunk.length;
  }
  return deleted;
}

async function fetchMatchingRecordIds(tableName: string, formula: string): Promise<string[]> {
  const ids: string[] = [];
  const table = base(tableName).select({ filterByFormula: formula, fields: [] });
  await table.eachPage((records, fetchNextPage) => {
    ids.push(...records.map((r) => r.id));
    fetchNextPage();
  });
  return ids;
}

export async function applyCompanyReset(input: ApplyInput): Promise<ResetApplyResult> {
  const { companyId, mode, resetKind, resetBatchId, confirmHardDelete } = input;

  const report = await buildResetInventory({ companyId, mode, resetKind, resetBatchId });
  if (mode === 'dryRun') {
    return { report, applied: [] };
  }

  const applied: ResetApplyResult['applied'] = [];

  for (const category of RESET_DELETE_ORDER) {
    const configs = RESET_TABLES.filter((t) => t.category === category);
    for (const cfg of configs) {
      const tableName = getTableName(cfg.tableKey);
      const row = report.tables.find((t) => t.tableKey === cfg.tableKey);
      if (!row || row.matchedCount === 0) continue;

      // soft reset preferred
      if (resetKind === 'soft' && row.softSupported) {
        const ids = await fetchMatchingRecordIds(tableName, row.matchFormula);
        const fields: Record<string, unknown> = {};
        if (cfg.softFields?.isArchivedField) fields[cfg.softFields.isArchivedField] = true;
        if (cfg.softFields?.resetBatchIdField) fields[cfg.softFields.resetBatchIdField] = resetBatchId;
        if (cfg.softFields?.resetAtField) fields[cfg.softFields.resetAtField] = new Date().toISOString();
        if (cfg.softFields?.resetKindField) fields[cfg.softFields.resetKindField] = 'soft';
        const updated = await batchUpdate(tableName, ids, fields);
        applied.push({ tableKey: cfg.tableKey, updated, deleted: 0 });
        continue;
      }

      if (resetKind === 'hard' && confirmHardDelete) {
        const ids = await fetchMatchingRecordIds(tableName, row.matchFormula);
        const deleted = await batchDelete(tableName, ids);
        applied.push({ tableKey: cfg.tableKey, updated: 0, deleted });
      }
    }
  }

  return { report, applied };
}

