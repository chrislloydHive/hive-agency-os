// app/api/os/workspace/route.ts
//
// REST endpoint for the Workspace section on My Day.
//   GET   — list all pinned, non-archived docs sorted by LastReviewed desc
//   POST  — create a new doc (pinned=true by default). Body: { name, url, description?, category?, frequency? }
//   PATCH — update by id. Body: { id, ...anyUpdatableField }
//           Special case: { id, action: 'touch' } bumps LastReviewed to now.
//           Special case: { id, action: 'archive' } soft-archives (ArchivedAt=now).

import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkspaceDocs,
  createWorkspaceDoc,
  updateWorkspaceDoc,
  touchWorkspaceDoc,
  archiveWorkspaceDoc,
  type UpdateWorkspaceDocInput,
  type WorkspaceCategory,
  type WorkspaceFrequency,
  type WorkspaceType,
} from '@/lib/airtable/workspaceDocs';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  try {
    const debug = req.nextUrl.searchParams.get('debug') === '1';
    const docs = await getWorkspaceDocs();

    if (debug) {
      // Diagnostic mode: also return the unfiltered count so we can see how
      // many Airtable records exist total vs how many passed the pinned/not-archived filter.
      const { getWorkspaceDocs: getAll } = await import('@/lib/airtable/workspaceDocs');
      const allIncludingUnpinned = await getAll({ includeArchived: true, includeUnpinned: true });
      return NextResponse.json({
        docs,
        count: docs.length,
        debug: {
          totalAirtableRecords: allIncludingUnpinned.length,
          pinnedCount: allIncludingUnpinned.filter((d) => d.pinned).length,
          archivedCount: allIncludingUnpinned.filter((d) => d.archivedAt).length,
          sampleRecord: allIncludingUnpinned[0] || null,
        },
      });
    }

    return NextResponse.json({ docs, count: docs.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch workspace docs' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    const created = await createWorkspaceDoc({
      name: body.name.trim(),
      url: body.url.trim(),
      description: typeof body.description === 'string' ? body.description : undefined,
      category: body.category as WorkspaceCategory | undefined,
      type: body.type as WorkspaceType | undefined,
      frequency: body.frequency as WorkspaceFrequency | undefined,
      lastReviewed: typeof body.lastReviewed === 'string' ? body.lastReviewed : undefined,
    });
    return NextResponse.json({ doc: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create workspace doc' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, ...rest } = body as {
      id?: string;
      action?: 'touch' | 'archive';
    } & UpdateWorkspaceDocInput;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    if (action === 'touch') {
      const updated = await touchWorkspaceDoc(id);
      return NextResponse.json({ doc: updated });
    }
    if (action === 'archive') {
      const updated = await archiveWorkspaceDoc(id);
      return NextResponse.json({ doc: updated });
    }

    const updated = await updateWorkspaceDoc(id, rest as UpdateWorkspaceDocInput);
    return NextResponse.json({ doc: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update workspace doc' },
      { status: 500 },
    );
  }
}
