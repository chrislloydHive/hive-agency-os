// lib/airtable/reviewGroupApprovals.ts
// Creative Review Group Approvals: as-of group approval per tactic::variant.
// Group Key = ${tactic}::${variant}. Unique by Review Token + Group Key.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

const TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_GROUP_APPROVALS;

export function groupKey(tactic: string, variant: string): string {
  return `${tactic}::${variant}`;
}

export interface GroupApprovalRecord {
  approvedAt: string;
  approvedByName: string | null;
  approvedByEmail: string | null;
}

/**
 * Load all group approvals for a review token. Returns map keyed by Group Key (tactic::variant).
 */
export async function getGroupApprovals(token: string): Promise<Record<string, GroupApprovalRecord>> {
  const osBase = getBase();
  const escaped = String(token).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  if (!escaped) return {};

  const formula = `{Review Token} = "${escaped}"`;
  const records = await osBase(TABLE)
    .select({ filterByFormula: formula })
    .all();

  const out: Record<string, GroupApprovalRecord> = {};
  for (const r of records) {
    const fields = r.fields as Record<string, unknown>;
    const key = (fields['Group Key'] as string) ?? '';
    const approvedAt = (fields['Approved At'] as string) ?? '';
    if (!key || !approvedAt) continue;
    out[key] = {
      approvedAt,
      approvedByName: (fields['Approved By Name'] as string) ?? null,
      approvedByEmail: (fields['Approved By Email'] as string) ?? null,
    };
  }
  return out;
}

export interface UpsertGroupApprovalArgs {
  token: string;
  tactic: string;
  variant: string;
  approvedAt: string;
  approvedByName?: string;
  approvedByEmail?: string;
  notes?: string;
}

/**
 * Upsert group approval. Unique by Review Token + Group Key. Updates Approved At each time.
 */
export async function upsertGroupApproval(args: UpsertGroupApprovalArgs): Promise<void> {
  const osBase = getBase();
  const key = groupKey(args.tactic, args.variant);
  const tokenEsc = String(args.token).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  const keyEsc = String(key).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  const formula = `AND({Review Token} = "${tokenEsc}", {Group Key} = "${keyEsc}")`;

  const existing = await osBase(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();

  const fields: Record<string, unknown> = {
    'Review Token': args.token,
    'Group Key': key,
    Tactic: args.tactic,
    Variant: args.variant,
    'Approved At': args.approvedAt,
    'Approved By Name': (args.approvedByName ?? '').slice(0, 100),
    'Approved By Email': (args.approvedByEmail ?? '').slice(0, 200),
  };
  if (args.notes !== undefined) {
    fields['Notes'] = String(args.notes).slice(0, 5000);
  }

  if (existing.length > 0) {
    await osBase(TABLE).update(existing[0].id, fields as any);
  } else {
    await osBase(TABLE).create(fields as any);
  }
}
