// Drive Project Folder Link from Client PM OS Projects table (same base/table as /api/os/pmos/context).

const PMOS_BASE_ID = process.env.AIRTABLE_PM_OS_BASE_ID?.trim() || 'appQLwoVH8JyGSTIo';
const PMOS_PROJECTS_TABLE_ID = 'tblkFxP82Jx3ApFsi';
const FIELD_DRIVE_FOLDER_LINK = 'Drive Project Folder Link';

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

/**
 * Best-effort: match Tasks "project" string to PM OS Projects row, return Drive folder web URL.
 */
export async function getPmosDriveProjectFolderUrlForProjectName(
  projectName: string | null | undefined,
): Promise<string | null> {
  const q = typeof projectName === 'string' ? projectName.trim() : '';
  if (!q) return null;

  const escaped = q.replace(/'/g, "\\'");
  const formula = `SEARCH(LOWER('${escaped}'), LOWER({Project}))`;
  const fieldsParam = `fields%5B%5D=${encodeURIComponent(FIELD_DRIVE_FOLDER_LINK)}`;
  const projUrl =
    `https://api.airtable.com/v0/${PMOS_BASE_ID}/${PMOS_PROJECTS_TABLE_ID}` +
    `?filterByFormula=${encodeURIComponent(formula)}` +
    `&${fieldsParam}` +
    `&maxRecords=1&sort%5B0%5D%5Bfield%5D=${encodeURIComponent('fld1zl52EgWLBUfRU')}&sort%5B0%5D%5Bdirection%5D=desc`;

  try {
    const projData = (await airtableFetch(projUrl)) as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
    };
    const raw = projData.records[0]?.fields?.[FIELD_DRIVE_FOLDER_LINK];
    if (typeof raw === 'string' && /^https?:\/\//i.test(raw.trim())) {
      return raw.trim();
    }
    return null;
  } catch (e) {
    console.warn('[pmosDriveProjectFolder] lookup failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
