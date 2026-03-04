// app/api/review/debug-folders/route.ts
// Debug endpoint to show folder tree structure for troubleshooting CRAS sync issues.
// GET /api/review/debug-folders?token=xxx

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getReviewFolderMapFromJobFolderPartial, getReviewFolderMapFromClientProjectsFolder } from '@/lib/review/reviewFolders';
import type { drive_v3 } from 'googleapis';

export const dynamic = 'force-dynamic';

interface FolderTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  mimeType?: string;
  children?: FolderTreeNode[];
  fileCount?: number;
  folderCount?: number;
}

/**
 * Recursively build folder tree structure with file counts.
 * Limited depth to prevent excessive API calls.
 */
async function buildFolderTree(
  drive: drive_v3.Drive,
  folderId: string,
  folderName: string,
  maxDepth: number = 4,
  currentDepth: number = 0,
): Promise<FolderTreeNode> {
  const node: FolderTreeNode = {
    id: folderId,
    name: folderName,
    type: 'folder',
    children: [],
    fileCount: 0,
    folderCount: 0,
  };

  if (currentDepth >= maxDepth) {
    node.children = [{ id: 'truncated', name: `[max depth ${maxDepth} reached]`, type: 'folder' }];
    return node;
  }

  // List all children
  let pageToken: string | undefined;
  const allChildren: drive_v3.Schema$File[] = [];

  while (true) {
    const listParams: drive_v3.Params$Resource$Files$List = {
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 100,
      pageToken,
    };
    const res = await drive.files.list(listParams);
    const data: drive_v3.Schema$FileList = res.data;
    allChildren.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  const folders: drive_v3.Schema$File[] = [];
  const files: drive_v3.Schema$File[] = [];

  for (const child of allChildren) {
    if (child.mimeType === 'application/vnd.google-apps.folder') {
      folders.push(child);
    } else {
      files.push(child);
    }
  }

  node.fileCount = files.length;
  node.folderCount = folders.length;

  // Add file entries (just names, no recursion)
  for (const file of files.slice(0, 10)) { // Limit to first 10 files for display
    node.children!.push({
      id: file.id!,
      name: file.name!,
      type: 'file',
      mimeType: file.mimeType ?? undefined,
    });
  }
  if (files.length > 10) {
    node.children!.push({
      id: 'truncated',
      name: `[...and ${files.length - 10} more files]`,
      type: 'file',
    });
  }

  // Recursively process folders
  for (const folder of folders) {
    const childTree = await buildFolderTree(
      drive,
      folder.id!,
      folder.name!,
      maxDepth,
      currentDepth + 1,
    );
    node.children!.push(childTree);
  }

  return node;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const resolved = await resolveReviewProject(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    const { project, auth } = resolved;
    const drive = google.drive({ version: 'v3', auth });

    // Resolve job folder
    const folderResult = project.jobFolderId
      ? await getReviewFolderMapFromJobFolderPartial(drive, project.jobFolderId)
      : await (async () => {
          const clientProjectsFolderId = process.env.CAR_TOYS_PROJECTS_FOLDER_ID ?? '1NLCt-piSxfAFeeINuFyzb3Pxp-kKXTw_';
          if (clientProjectsFolderId) {
            const fromClient = await getReviewFolderMapFromClientProjectsFolder(drive, project.name, clientProjectsFolderId);
            if (fromClient) return fromClient;
          }
          return null;
        })();

    if (!folderResult) {
      return NextResponse.json({
        error: 'Could not resolve folder structure',
        project: {
          name: project.name,
          hubName: project.hubName,
          jobFolderId: project.jobFolderId,
        },
      }, { status: 404 });
    }

    const { map: folderMap, jobFolderId } = folderResult;

    // Get job folder metadata
    let jobFolderName = 'Unknown';
    try {
      const meta = await drive.files.get({
        fileId: jobFolderId,
        fields: 'name',
        supportsAllDrives: true,
      });
      jobFolderName = meta.data.name ?? 'Unknown';
    } catch {
      // Ignore
    }

    // Build folder tree from job folder
    const folderTree = await buildFolderTree(drive, jobFolderId, jobFolderName);

    // Build variant folder summary
    const variantFolders: Array<{
      key: string;
      folderId: string;
      folderUrl: string;
    }> = [];

    for (const [key, folderId] of folderMap) {
      variantFolders.push({
        key,
        folderId,
        folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      });
    }

    // Count files recursively in each variant folder
    const variantFileCounts: Record<string, { direct: number; recursive: number }> = {};
    for (const [key, folderId] of folderMap) {
      // Count direct children
      let directCount = 0;
      let recursiveCount = 0;

      // Direct count
      const directRes = await drive.files.list({
        q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 1000,
      });
      directCount = directRes.data.files?.length ?? 0;

      // Recursive count (simplified - just count one level deep for subfolders)
      const subfolderRes = await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 100,
      });
      const subfolders = subfolderRes.data.files ?? [];
      recursiveCount = directCount;

      for (const subfolder of subfolders) {
        const subRes = await drive.files.list({
          q: `'${subfolder.id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          pageSize: 1000,
        });
        recursiveCount += subRes.data.files?.length ?? 0;
      }

      variantFileCounts[key] = { direct: directCount, recursive: recursiveCount };
    }

    return NextResponse.json({
      ok: true,
      project: {
        name: project.name,
        hubName: project.hubName,
        recordId: project.recordId,
        jobFolderId: project.jobFolderId,
      },
      jobFolder: {
        id: jobFolderId,
        name: jobFolderName,
        url: `https://drive.google.com/drive/folders/${jobFolderId}`,
      },
      variantFolders,
      variantFileCounts,
      summary: {
        totalVariantFolders: variantFolders.length,
        totalDirectFiles: Object.values(variantFileCounts).reduce((sum, v) => sum + v.direct, 0),
        totalRecursiveFiles: Object.values(variantFileCounts).reduce((sum, v) => sum + v.recursive, 0),
        hasNestedFiles: Object.values(variantFileCounts).some(v => v.recursive > v.direct),
      },
      folderTree,
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[review/debug-folders] Error:', message, err instanceof Error ? err.stack : undefined);
    return NextResponse.json(
      { error: 'Failed to build folder tree', detail: message },
      { status: 500 },
    );
  }
}
