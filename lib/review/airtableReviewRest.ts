/**
 * Review flow Airtable access via airtableFetch only (no SDK), shared by page + API routes.
 */

import { airtableFetch } from '@/lib/airtable/airtableFetch';
import { resolveProjectsBaseId } from '@/lib/airtable/bases';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

/** Single Project row fields from the Projects base (same base as token lookup). */
export async function restGetProjectRecordFields(recordId: string): Promise<Record<string, unknown> | null> {
  const baseId = resolveProjectsBaseId();
  if (!baseId) return null;
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(AIRTABLE_TABLES.PROJECTS)}/${encodeURIComponent(recordId)}`;
  try {
    const res = await airtableFetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const json = (await res.json()) as { fields?: Record<string, unknown> };
    return json.fields ?? null;
  } catch {
    return null;
  }
}

/** Paginated list; supports optional sort (Airtable REST). */
export async function restListTableRecords(options: {
  baseId: string;
  tableName: string;
  filterByFormula: string;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
}): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const { baseId, tableName, filterByFormula, sort } = options;
  const rows: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set('filterByFormula', filterByFormula);
    params.set('pageSize', '100');
    if (sort) {
      sort.forEach((s, i) => {
        params.set(`sort[${i}][field]`, s.field);
        params.set(`sort[${i}][direction]`, s.direction);
      });
    }
    if (offset) params.set('offset', offset);
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${params.toString()}`;
    const res = await airtableFetch(url, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable list failed (${res.status}): ${text.slice(0, 400)}`);
    }
    const json = (await res.json()) as {
      records?: Array<{ id: string; fields: Record<string, unknown> }>;
      offset?: string;
    };
    for (const r of json.records ?? []) {
      rows.push({ id: r.id, fields: r.fields });
    }
    offset = json.offset;
  } while (offset);
  return rows;
}

export async function restListFirstMatching(options: {
  baseId: string;
  tableName: string;
  filterByFormula: string;
}): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const params = new URLSearchParams();
  params.set('filterByFormula', options.filterByFormula);
  params.set('maxRecords', '1');
  const url = `https://api.airtable.com/v0/${options.baseId}/${encodeURIComponent(options.tableName)}?${params.toString()}`;
  const res = await airtableFetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable query failed (${res.status}): ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { records?: Array<{ id: string; fields: Record<string, unknown> }> };
  const row = json.records?.[0];
  return row ? { id: row.id, fields: row.fields } : null;
}

export async function restPatchRecord(
  baseId: string,
  tableName: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}`;
  const res = await airtableFetch(url, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable PATCH failed (${res.status}): ${text.slice(0, 400)}`);
  }
}
