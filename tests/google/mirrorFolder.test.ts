import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { drive_v3 } from 'googleapis';
import { mirrorFolder } from '@/lib/google/mirrorFolder';

const FOLDER = 'application/vnd.google-apps.folder';

type Node = {
  id: string;
  name: string;
  mimeType: string;
  parentId: string;
  shortcutTargetId?: string;
};

function buildMockDrive(initial: Node[]) {
  const nodes = new Map<string, Node>(initial.map((n) => [n.id, { ...n }]));
  let nextId = 100;

  const drive = {
    files: {
      list: vi.fn(async ({ q }: drive_v3.Params$Resource$Files$List) => {
        const parentMatch = q?.match(/'([^']+)' in parents/);
        const parentId = parentMatch?.[1] ?? '';
        const children = [...nodes.values()].filter((n) => n.parentId === parentId);
        return {
          data: {
            files: children.map((n) => ({
              id: n.id,
              name: n.name,
              mimeType: n.mimeType,
              shortcutDetails: n.shortcutTargetId
                ? { targetId: n.shortcutTargetId }
                : undefined,
            })),
          },
        };
      }),
      create: vi.fn(async ({ requestBody }: drive_v3.Params$Resource$Files$Create) => {
        const id = `new-${nextId++}`;
        nodes.set(id, {
          id,
          name: requestBody?.name ?? 'folder',
          mimeType: FOLDER,
          parentId: requestBody?.parents?.[0] ?? '',
        });
        return { data: { id } };
      }),
      copy: vi.fn(async ({ fileId, requestBody }: drive_v3.Params$Resource$Files$Copy) => {
        const src = nodes.get(fileId);
        const id = `copy-${nextId++}`;
        nodes.set(id, {
          id,
          name: requestBody?.name ?? src?.name ?? 'copy',
          mimeType: src?.mimeType ?? 'image/jpeg',
          parentId: requestBody?.parents?.[0] ?? '',
        });
        return { data: { id } };
      }),
    },
  } as unknown as drive_v3.Drive;

  return { drive, nodes };
}

describe('mirrorFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies missing files and skips existing by name', async () => {
    const { drive } = buildMockDrive([
      { id: 'src', name: 'root', mimeType: FOLDER, parentId: 'x' },
      { id: 'dst', name: 'root', mimeType: FOLDER, parentId: 'x' },
      { id: 'f1', name: 'a.jpg', mimeType: 'image/jpeg', parentId: 'src' },
      { id: 'f2', name: 'b.jpg', mimeType: 'image/jpeg', parentId: 'src' },
      { id: 'f3', name: 'a.jpg', mimeType: 'image/jpeg', parentId: 'dst' },
    ]);

    const result = await mirrorFolder(drive, 'src', 'dst', { copyConcurrency: 2 });

    expect(result.copied.map((c) => c.name)).toEqual(['b.jpg']);
    expect(result.skipped.map((s) => s.name)).toEqual(['a.jpg']);
    expect(drive.files.copy).toHaveBeenCalledTimes(1);
  });

  it('creates missing subfolders and recurses', async () => {
    const { drive, nodes } = buildMockDrive([
      { id: 'src', name: 'root', mimeType: FOLDER, parentId: 'x' },
      { id: 'dst', name: 'root', mimeType: FOLDER, parentId: 'x' },
      { id: 'sub', name: 'Display', mimeType: FOLDER, parentId: 'src' },
      { id: 'inner', name: 'banner.zip', mimeType: 'application/zip', parentId: 'sub' },
    ]);

    const result = await mirrorFolder(drive, 'src', 'dst');

    expect(result.folders.some((f) => f.name === 'Display' && f.created)).toBe(true);
    expect(result.copied.some((c) => c.name === 'banner.zip')).toBe(true);
    const displayDest = result.folders.find((f) => f.name === 'Display');
    expect(displayDest?.destFolderId).toBeTruthy();
    expect([...nodes.values()].some((n) => n.name === 'banner.zip' && n.parentId === displayDest?.destFolderId)).toBe(true);
  });

  it('reuses existing subfolder by name and only copies nested missing files', async () => {
    const { drive } = buildMockDrive([
      { id: 'src', name: 'root', mimeType: FOLDER, parentId: 'x' },
      { id: 'dst', name: 'root', mimeType: FOLDER, parentId: 'x' },
      { id: 'src-sub', name: 'Video', mimeType: FOLDER, parentId: 'src' },
      { id: 'dst-sub', name: 'Video', mimeType: FOLDER, parentId: 'dst' },
      { id: 'v1', name: 'clip.mp4', mimeType: 'video/mp4', parentId: 'src-sub' },
      { id: 'v2', name: 'clip.mp4', mimeType: 'video/mp4', parentId: 'dst-sub' },
    ]);

    const result = await mirrorFolder(drive, 'src', 'dst');

    expect(result.folders.find((f) => f.name === 'Video')?.created).toBe(false);
    expect(result.copied).toHaveLength(0);
    expect(result.skipped.some((s) => s.name === 'clip.mp4')).toBe(true);
    expect(drive.files.create).not.toHaveBeenCalled();
  });

  it('is a no-op on second run when destination already matches', async () => {
    const { drive } = buildMockDrive([
      { id: 'src', name: 'root', mimeType: FOLDER, parentId: 'x' },
      { id: 'dst', name: 'root', mimeType: FOLDER, parentId: 'x' },
      { id: 'f1', name: 'doc.pdf', mimeType: 'application/pdf', parentId: 'src' },
      { id: 'f2', name: 'doc.pdf', mimeType: 'application/pdf', parentId: 'dst' },
    ]);

    const first = await mirrorFolder(drive, 'src', 'dst');
    const second = await mirrorFolder(drive, 'src', 'dst');

    expect(first.copied).toHaveLength(0);
    expect(second.copied).toHaveLength(0);
    expect(second.skipped).toHaveLength(1);
    expect(drive.files.copy).not.toHaveBeenCalled();
  });
});
