// app/api/os/google/drive-preflight/route.ts
// TEMPORARY preflight check – remove after verifying Shared Drive access
//
// Uses the same JWT service-account auth path as the scaffold flow
// (lib/google/driveClient.ts → getDriveClient).
//
// Usage:
//   GET /api/os/google/drive-preflight?rootFolderId=...&templateId=...

import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google/driveClient';

export const dynamic = 'force-dynamic';

interface PreflightResult {
  ok: boolean;
  actingEmail: string | null;
  rootAccessible: boolean;
  canListChildren: boolean;
  canCopyTemplate: boolean;
  errors: string[];
}

export async function GET(req: NextRequest) {
  // ── Dev-only guard ──────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production.' },
      { status: 403 }
    );
  }

  const rootFolderId = req.nextUrl.searchParams.get('rootFolderId');
  const templateId = req.nextUrl.searchParams.get('templateId');

  if (!rootFolderId) {
    return NextResponse.json(
      { error: 'Missing required query param: rootFolderId' },
      { status: 400 }
    );
  }

  const result: PreflightResult = {
    ok: false,
    actingEmail: null,
    rootAccessible: false,
    canListChildren: false,
    canCopyTemplate: false,
    errors: [],
  };

  // ── Resolve acting email from SA credentials ────────────────────────
  try {
    const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (jsonStr) {
      result.actingEmail = JSON.parse(jsonStr).client_email ?? null;
    } else {
      result.actingEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null;
    }
  } catch {
    result.actingEmail = null;
  }

  let drive: ReturnType<typeof getDriveClient>;
  try {
    drive = getDriveClient();
  } catch (err: any) {
    result.errors.push(`Auth failed: ${err.message}`);
    return NextResponse.json(result, { status: 200 });
  }

  // ── (a) drive.files.get – can we see the root folder? ──────────────
  try {
    const res = await drive.files.get({
      fileId: rootFolderId,
      fields: 'id, name, mimeType, driveId',
      supportsAllDrives: true,
    });
    result.rootAccessible = true;

    const driveId = res.data.driveId;
    if (driveId) {
      console.log(
        `[drive-preflight] Root folder "${res.data.name}" is in Shared Drive ${driveId}`
      );
    }
  } catch (err: any) {
    result.rootAccessible = false;
    const code = err?.code ?? err?.status;
    if (code === 404) {
      result.errors.push(
        `Root folder ${rootFolderId} not found (404). ` +
          sharedDriveHint(result.actingEmail)
      );
    } else if (code === 403) {
      result.errors.push(
        `Access denied to root folder ${rootFolderId} (403). ` +
          sharedDriveHint(result.actingEmail)
      );
    } else {
      result.errors.push(`files.get failed: ${err.message ?? err}`);
    }
  }

  // ── (b) drive.files.list – can we enumerate children? ──────────────
  if (result.rootAccessible) {
    try {
      const res = await drive.files.list({
        q: `'${rootFolderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 5,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      result.canListChildren = true;

      const names = (res.data.files ?? []).map((f) => f.name);
      console.log(
        `[drive-preflight] Children sample (${names.length}): ${names.join(', ')}`
      );
    } catch (err: any) {
      result.canListChildren = false;
      result.errors.push(`files.list children failed: ${err.message ?? err}`);
    }
  }

  // ── (c) drive.files.copy – can we copy a template into root? ───────
  if (templateId && result.rootAccessible) {
    try {
      const copyRes = await drive.files.copy({
        fileId: templateId,
        requestBody: {
          name: `_preflight_test_${Date.now()}`,
          parents: [rootFolderId],
        },
        fields: 'id, name',
        supportsAllDrives: true,
      });

      result.canCopyTemplate = true;
      const copiedId = copyRes.data.id!;

      // Clean up immediately
      try {
        await drive.files.update({
          fileId: copiedId,
          requestBody: { trashed: true },
          supportsAllDrives: true,
        });
      } catch {
        // Best-effort cleanup; ignore failures
        console.warn(`[drive-preflight] Could not trash test copy ${copiedId}`);
      }
    } catch (err: any) {
      result.canCopyTemplate = false;
      const code = err?.code ?? err?.status;
      if (code === 404) {
        result.errors.push(
          `Template ${templateId} not found (404). Ensure the template is shared with the service account, or it may have been deleted.`
        );
      } else if (code === 403) {
        result.errors.push(
          `Cannot copy template into root folder (403). ` +
            `The service account needs Content Manager (or higher) role on the Shared Drive. ` +
            sharedDriveHint(result.actingEmail)
        );
      } else {
        result.errors.push(`files.copy failed: ${err.message ?? err}`);
      }
    }
  } else if (!templateId) {
    result.errors.push(
      'Skipped template copy check – no templateId query param provided.'
    );
  }

  // ── Final verdict ──────────────────────────────────────────────────
  result.ok =
    result.rootAccessible &&
    result.canListChildren &&
    (templateId ? result.canCopyTemplate : true);

  console.log('[drive-preflight]', JSON.stringify(result, null, 2));

  return NextResponse.json(result, { status: 200 });
}

// ---------------------------------------------------------------------------

function sharedDriveHint(actingEmail: string | null): string {
  const who = actingEmail ?? '<service account email>';
  return (
    `Share the Shared Drive (or folder) with ${who} as Content Manager. ` +
    `If it's a Shared Drive, go to Shared Drive → Manage members → add ${who}.`
  );
}
