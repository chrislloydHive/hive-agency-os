// app/api/review/comments/list/route.ts
// GET comments for project (optionally filtered by driveFileId).
// Same token -> project resolution as /api/review/assets.

import { NextRequest, NextResponse } from 'next/server';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { resolveReviewProject } from '@/lib/review/resolveProject';

export const dynamic = 'force-dynamic';

export interface ListCommentItem {
  id: string;
  comment: string;
  createdAt: string;
  authorName: string;
  authorEmail?: string;
  tactic?: string;
  variantGroup?: string;
  concept?: string;
  driveFileId?: string;
  filename?: string;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const driveFileId = req.nextUrl.searchParams.get('driveFileId');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const projectId = resolved.project.recordId;
  const osBase = getBase();

  try {
    const baseFormula = `FIND("${projectId}", ARRAYJOIN({Project})) > 0`;
    const formula =
      driveFileId && driveFileId.trim() !== ''
        ? `AND(${baseFormula}, {Drive File ID} = "${String(driveFileId).replace(/"/g, '\\"')}")`
        : baseFormula;

    const records = await osBase(AIRTABLE_TABLES.CREATIVE_REVIEW_COMMENTS)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    const comments: ListCommentItem[] = records.map((r) => {
      const fields = r.fields as Record<string, unknown>;
      return {
        id: r.id,
        comment: (fields['Comment'] as string) || '',
        createdAt: (fields['Created At'] as string) || new Date().toISOString(),
        authorName: (fields['Author Name'] as string) || 'Anonymous',
        authorEmail: (fields['Author Email'] as string) || undefined,
        tactic: (fields['Tactic'] as string) || undefined,
        variantGroup: undefined,
        concept: undefined,
        driveFileId: (fields['Drive File ID'] as string) || undefined,
        filename: (fields['Filename'] as string) || undefined,
      };
    });

    return NextResponse.json(
      { ok: true, comments },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[review/comments/list] GET error:', message);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}
