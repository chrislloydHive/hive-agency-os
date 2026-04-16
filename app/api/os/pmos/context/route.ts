// app/api/os/pmos/context/route.ts
// Returns PM OS project context for a given project name.
//
// GET /api/os/pmos/context?project=Tint+Evergreen+Production
//
// Searches the Client PM OS base (appQLwoVH8JyGSTIo) for projects whose name
// contains the query string, then returns the project's metadata + linked tasks
// so the TaskEditPanel can render inline context.
//
// This is a read-only bridge into the PM OS base — writes go through the
// existing Airtable Inbox form (deep-linked from the UI).

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// ── PM OS Airtable config ────────────────────────────────────────────────────
// These are the Client PM OS base/table IDs discovered via the Airtable MCP.
const PMOS_BASE_ID = 'appQLwoVH8JyGSTIo';
const PMOS_PROJECTS_TABLE_ID = 'tblkFxP82Jx3ApFsi';
const PMOS_TASKS_TABLE_ID = 'tblK43BwLU7wliWYE';

// Field IDs for Projects table
const PF = {
  PROJECT_NAME: 'fldyNhIKtwCY3VVrq',
  STATUS: 'fld4ZH2oxv85FUzN7',
  PRIORITY: 'fldM4nJPjPUONESJR',
  CLIENT: 'fldrrO5JSe22ODTta',
  START_DATE: 'fldj3DNDBcD59r9cB',
  DUE_DATE: 'fld6DvGOtPxyJ8NyG',
  DESCRIPTION: 'fld2uVsVvLvg224aK',
  TASKS: 'fld1ie4BPkfJt0agA',
  DATE_CREATED: 'fld1zl52EgWLBUfRU',
} as const;

// Field IDs for Tasks table (PM OS tasks, not personal tasks)
const TF = {
  TASK: 'fldYcNu8cHcrOOcXM',
  STATUS: 'flduodOMgGIyqNQjt',
  PRIORITY: 'fldctTvd20uhyx9fd',
  DUE_DATE: 'fldw21scc071u1442',
  OWNER: 'fldcWtrVnLn0wBRKe',
  PROJECT: 'fldVyuzp1F2fjvsWm',
} as const;

// ── Airtable fetch helper ────────────────────────────────────────────────────

function airtableHeaders(): Record<string, string> {
  const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT || '';
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function airtableFetch(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: airtableHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Airtable ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PmOsProject {
  id: string;
  name: string;
  status: string | null;
  priority: string | null;
  client: string | null;
  startDate: string | null;
  dueDate: string | null;
  description: string | null;
  taskCount: number;
}

interface PmOsTask {
  id: string;
  name: string;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  owner: string | null;
}

interface PmOsContext {
  project: PmOsProject | null;
  tasks: PmOsTask[];
  /** Direct link into the PM OS interface for this project */
  interfaceUrl: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function multiSelectNames(field: unknown): string[] {
  if (!Array.isArray(field)) return [];
  return field
    .filter((r): r is { name: string } => r && typeof r === 'object' && 'name' in r)
    .map(r => r.name);
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectQuery = searchParams.get('project')?.trim();

  if (!projectQuery) {
    return NextResponse.json({ error: 'project query param required' }, { status: 400 });
  }

  try {
    // Search PM OS Projects table for matching name.
    // Airtable's filterByFormula with SEARCH() is case-insensitive and does substring matching.
    const escaped = projectQuery.replace(/'/g, "\\'");
    const formula = `SEARCH(LOWER('${escaped}'), LOWER({Project}))`;
    const projectFields = [
      PF.PROJECT_NAME, PF.STATUS, PF.PRIORITY, PF.CLIENT,
      PF.START_DATE, PF.DUE_DATE, PF.DESCRIPTION, PF.TASKS,
    ].join(',');

    const projUrl =
      `https://api.airtable.com/v0/${PMOS_BASE_ID}/${PMOS_PROJECTS_TABLE_ID}` +
      `?filterByFormula=${encodeURIComponent(formula)}` +
      `&fields%5B%5D=${projectFields.split(',').map(f => encodeURIComponent(f)).join('&fields%5B%5D=')}` +
      `&maxRecords=5&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(PF.DATE_CREATED)}&sort%5B0%5D%5Bdirection%5D=desc`;

    const projData = (await airtableFetch(projUrl)) as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
    };

    if (!projData.records.length) {
      return NextResponse.json({
        project: null,
        tasks: [],
        interfaceUrl: `https://airtable.com/${PMOS_BASE_ID}/pagD8gby09ctslXG2`,
      } satisfies PmOsContext);
    }

    // Take the best match (first result, most recently created).
    const rec = projData.records[0];
    const f = rec.fields;
    const linkedTasks = Array.isArray(f[PF.TASKS]) ? (f[PF.TASKS] as Array<{ id: string; name: string }>) : [];

    const project: PmOsProject = {
      id: rec.id,
      name: (f[PF.PROJECT_NAME] as string) || projectQuery,
      status: selectName(f[PF.STATUS]),
      priority: selectName(f[PF.PRIORITY]),
      client: linkedRecordNames(f[PF.CLIENT])[0] || null,
      startDate: (f[PF.START_DATE] as string) || null,
      dueDate: (f[PF.DUE_DATE] as string) || null,
      description: (f[PF.DESCRIPTION] as string) || null,
      taskCount: linkedTasks.length,
    };

    // Fetch task details if there are linked tasks (cap at 20).
    let tasks: PmOsTask[] = [];
    if (linkedTasks.length > 0) {
      const taskIds = linkedTasks.slice(0, 20).map(t => t.id);
      const taskFields = [TF.TASK, TF.STATUS, TF.PRIORITY, TF.DUE_DATE, TF.OWNER].join(',');

      // Airtable's filterByFormula with OR(RECORD_ID()=...) for specific records.
      const idClauses = taskIds.map(id => `RECORD_ID()='${id}'`).join(',');
      const taskFormula = `OR(${idClauses})`;
      const taskUrl =
        `https://api.airtable.com/v0/${PMOS_BASE_ID}/${PMOS_TASKS_TABLE_ID}` +
        `?filterByFormula=${encodeURIComponent(taskFormula)}` +
        `&fields%5B%5D=${taskFields.split(',').map(fld => encodeURIComponent(fld)).join('&fields%5B%5D=')}`;

      const taskData = (await airtableFetch(taskUrl)) as {
        records: Array<{ id: string; fields: Record<string, unknown> }>;
      };

      tasks = taskData.records.map(tr => ({
        id: tr.id,
        name: (tr.fields[TF.TASK] as string) || '(untitled)',
        status: selectName(tr.fields[TF.STATUS]),
        priority: selectName(tr.fields[TF.PRIORITY]),
        dueDate: (tr.fields[TF.DUE_DATE] as string) || null,
        owner: multiSelectNames(tr.fields[TF.OWNER])[0] || null,
      }));
    }

    const context: PmOsContext = {
      project,
      tasks,
      interfaceUrl: `https://airtable.com/${PMOS_BASE_ID}/pagD8gby09ctslXG2`,
    };

    return NextResponse.json(context);
  } catch (err) {
    console.error('[api/os/pmos/context] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch PM OS context' },
      { status: 500 },
    );
  }
}
