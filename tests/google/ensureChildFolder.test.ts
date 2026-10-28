import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => { process.env.DRIVE_ENSURE_FOLDER_SETTLE_MS = '0'; });

import { ensureChildFolderWithDrive } from '@/lib/google/driveClient';

type F = { id: string; name: string; createdTime: string; parent: string; trashed: boolean };

/** Minimal in-memory Drive that allows duplicate names (like the real one). */
function makeFakeDrive() {
  const files: F[] = [];
  let n = 0;
  const drive: any = {
    files: {
      list: vi.fn(async ({ q }: { q: string }) => {
        const parent = /'([^']+)' in parents/.exec(q)![1];
        const name = /name = '((?:\\.|[^'])*)'/.exec(q)![1].replace(/\\(.)/g, '$1');
        return {
          data: {
            files: files.filter((f) => f.parent === parent && f.name === name && !f.trashed),
          },
        };
      }),
      create: vi.fn(async ({ requestBody }: any) => {
        // yield so concurrent callers interleave between find and create
        await new Promise((r) => setTimeout(r, 1));
        n += 1;
        const f: F = {
          id: `id${String(n).padStart(3, '0')}`,
          name: requestBody.name,
          createdTime: new Date(1_700_000_000_000 + n).toISOString(),
          parent: requestBody.parents[0],
          trashed: false,
        };
        files.push(f);
        return { data: { id: f.id, name: f.name } };
      }),
      update: vi.fn(async ({ fileId, requestBody }: any) => {
        const f = files.find((x) => x.id === fileId)!;
        if (requestBody.trashed) f.trashed = true;
        return { data: {} };
      }),
    },
  };
  return { drive, files };
}

describe('ensureChildFolderWithDrive', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the existing folder without creating', async () => {
    const { drive, files } = makeFakeDrive();
    const a = await ensureChildFolderWithDrive(drive, 'P', 'Social');
    const b = await ensureChildFolderWithDrive(drive, 'P', 'Social');
    expect(b.id).toBe(a.id);
    expect(files.filter((f) => !f.trashed)).toHaveLength(1);
  });

  it('converges on one folder when separate instances race (separate module copies, shared Drive)', async () => {
    const { drive, files } = makeFakeDrive();
    // Fresh module copies = separate in-process guards, like separate serverless instances.
    const loadEnsure = async () => {
      vi.resetModules();
      return (await import('@/lib/google/driveClient')).ensureChildFolderWithDrive;
    };
    const ensures = [await loadEnsure(), await loadEnsure(), await loadEnsure()];
    const results = await Promise.all(ensures.map((fn) => fn(drive, 'P', 'Retargeting')));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(files.filter((f) => !f.trashed && f.name === 'Retargeting')).toHaveLength(1);
    expect(files.filter((f) => f.name === 'Retargeting')).toHaveLength(3); // 2 losers trashed, not left behind
  });

  it('trashes its own folder and returns the older winner when a duplicate already exists post-create', async () => {
    const { drive, files } = makeFakeDrive();
    // First list says nothing; then a concurrent caller's older folder appears.
    const realList = drive.files.list;
    let first = true;
    drive.files.list = vi.fn(async (args: any) => {
      if (first) {
        first = false;
        files.push({ id: 'id000', name: 'Audio', createdTime: new Date(1_600_000_000_000).toISOString(), parent: 'P', trashed: false });
        return { data: { files: [] } };
      }
      return realList(args);
    });
    const out = await ensureChildFolderWithDrive(drive, 'P', 'Audio');
    expect(out.id).toBe('id000');
    expect(files.filter((f) => !f.trashed && f.name === 'Audio')).toHaveLength(1);
    expect(drive.files.update).toHaveBeenCalledWith(
      expect.objectContaining({ requestBody: { trashed: true } }),
    );
  });

  it('picks the oldest when duplicates already exist (find is deterministic)', async () => {
    const { drive, files } = makeFakeDrive();
    files.push(
      { id: 'b', name: 'Social', createdTime: '2026-01-02T00:00:00Z', parent: 'P', trashed: false },
      { id: 'a', name: 'Social', createdTime: '2026-01-01T00:00:00Z', parent: 'P', trashed: false },
    );
    const out = await ensureChildFolderWithDrive(drive, 'P', 'Social');
    expect(out.id).toBe('a');
    expect(drive.files.create).not.toHaveBeenCalled();
  });
});
