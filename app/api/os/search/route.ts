// app/api/os/search/route.ts
// Unified cross-system search for the Cmd+K command bar.
//
// GET /api/os/search?q=tint&limit=10
//
// Searches in parallel across:
//   1. Personal tasks (Hive DB)
//   2. PM OS projects
//   3. PM OS tasks
//
// Returns a merged, ranked result set with source labels.

import { NextRequest, NextResponse } from 'next/server';
import { getTasks } from '@/lib/airtable/tasks';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// ── PM OS Airtable config ────────────────────────────────────────────────────
const PMOS_BASE_ID = 'appQLwoVH8JyGSTIo';
const PMOS_PROJECTS_TABLE_ID = 'tblkFxP82Jx3ApFsi';
const PMOS_TASKS_TABLE_ID = 'tblK43BwLU7wliWYE';

const PF_PROJECT_NAME = 'fldyNhIKtwCY3VVrq';
const PF_STATUS = 'fld4ZH2oxv85FUzN7';
const PF_CLIENT = 'fldrrO5JSe22ODTta';
const PF_DUE_DATE = 'fld6DvGOtPxyJ8NyG';

const TF_TASK = 'fldYcNu8cHcrOOcXM';
const TF_STATUS = 'flduodOMgGIyqNQjt';
const TF_PRIORITY = 'fldctTvd20uhyx9fd';
const TF_DUE_DATE = 'fldw21scc071u1442';
const TF_OWNER = 'fldcWtrVnLn0wBRKe';
const TF_PROJECT = 'fldVyuzp1F2fjvsWm';

// ── Airtable helpers ────────────────────────────────────────────────────────

function airtableHeaders(): Record<string, string> {
  const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT || '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function airtableFetch(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: airtableHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Airtable ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function selectName(field: unknown): string | null {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field !== null && 'name' in field) {
    return (field as { name: string }).name;
  }
  return null;
}

function linkedRecordNames(field: unknown): string[] {
  if (!Array.isArray(field)) return [];
  return field
    .filter((r): r is { name: string } => r && typeof r === 'object' && 'name' in r)
    .map(r => r.name);
}

// ── Result types ────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  type: 'task' | 'pmos-project' | 'pmos-task';
  title: string;
  subtitle: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  /** Extra context for rendering (project name, owner, etc.) */
  meta: Record<string, string | null>;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10), 30);

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [], query: query || '' });
  }

  const lower = query.toLowerCase();
  const escaped = query.replace(/'/g, "\\'");

  // Run all three searches in parallel
  const [taskResults, pmosProjectResults, pmosTaskResults] = await Promise.allSettled([
    // 1. Personal tasks — client-side filter (getTasks fetches all non-done)
    (async (): Promise<SearchResult[]> => {
      const tasks = await getTasks({ excludeDone: false });
      return tasks
        .filter(t => {
          const searchable = [t.task, t.project, t.nextAction, t.from, t.notes]
            .filter(Boolean).join(' ').toLowerCase();
          return searchable.includes(lower);
        })
        .slice(0, limit)
        .map(t => ({
          id: t.id,
          type: 'task' as const,
          title: t.task,
          subtitle: t.nextAction || null,
          status: t.status,
          priority: t.priority,
          dueDate: t.due,
          meta: { project: t.project || null, from: t.from || null },
        }));
    })(),

    // 2. PM OS projects — Airtable SEARCH()
    (async (): Promise<SearchResult[]> => {
      const formula = `SEARCH(LOWER('${escaped}'), LOWER({Project}))`;
      const fields = [PF_PROJECT_NAME, PF_STATUS, PF_CLIENT, PF_DUE_DATE].join(',');
      const url =
        `https://api.airtable.com/v0/${PMOS_BASE_ID}/${PMOS_PROJECTS_TABLE_ID}` +
        `?filterByFormula=${encodeURIComponent(formula)}` +
        `&fields%5B%5D=${fields.split(',').map(f => encodeURIComponent(f)).join('&fields%5B%5D=')}` +
        `&maxRecords=${limit}`;
      const data = (await airtableFetch(url)) as {
        records: Array<{ id: string; fields: Record<string, unknown> }>;
      };
      return data.records.map(r => ({
        id: r.id,
        type: 'pmos-project' as const,
        title: (r.fields[PF_PROJECT_NAME] as string) || '(untitled)',
        subtitle: linkedRecordNames(r.fields[PF_CLIENT])[0] || null,
        status: selectName(r.fields[PF_STATUS]),
        priority: null,
        dueDate: (r.fields[PF_DUE_DATE] as string) || null,
        meta: { client: linkedRecordNames(r.fields[PF_CLIENT])[0] || null },
      }));
    })(),

    // 3. PM OS tasks — Airtable SEARCH()
    (async (): Promise<SearchResult[]> => {
      const formula = `SEARCH(LOWER('${escaped}'), LOWER({Task}))`;
      const fields = [TF_TASK, TF_STATUS, TF_PRIORITY, TF_DUE_DATE, TF_OWNER, TF_PROJECT].join(',');
      const url =
        `https://api.airtable.com/v0/${PMOS_BASE_ID}/${PMOS_TASKS_TABLE_ID}` +
        `?filterByFormula=${encodeURIComponent(formula)}` +
        `&fields%5B%5D=${fields.split(',').map(f => encodeURIComponent(f)).join('&fields%5B%5D=')}` +
        `&maxRecords=${limit}`;
      const data = (await airtableFetch(url)) as {
        records: Array<{ id: string; fields: Record<string, unknown> }>;
      };
      return data.records.map(r => ({
        id: r.id,
        type: 'pmos-task' as const,
        title: (r.fields[TF_TASK] as string) || '(untitled)',
        subtitle: linkedRecordNames(r.fields[TF_PROJECT])[0] || null,
        status: selectName(r.fields[TF_STATUS]),
        priority: selectName(r.fields[TF_PRIORITY]),
        dueDate: (r.fields[TF_DUE_DATE] as string) || null,
        meta: {
          owner: linkedRecordNames(r.fields[TF_OWNER])[0] || null,
          project: linkedRecordNames(r.fields[TF_PROJECT])[0] || null,
        },
      }));
    })(),
  ]);

  // Merge results — fulfilled only, skip errors silently
  const results: SearchResult[] = [];
  for (const r of [taskResults, pmosProjectResults, pmosTaskResults]) {
    if (r.status === 'fulfilled') results.push(...r.value);
  }

  // Simple relevance: exact-start matches first, then alphabetical
  results.sort((a, b) => {
    const aStarts = a.title.toLowerCase().startsWith(lower) ? 0 : 1;
    const bStarts = b.title.toLowerCase().startsWith(lower) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.title.localeCompare(b.title);
  });

  return NextResponse.json({
    results: results.slice(0, limit),
    query,
  });
}
