import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => { process.env.DRIVE_ENSURE_FOLDER_SETTLE_MS = '0'; });

vi.mock('@/lib/airtable', () => ({ getProjectsBase: vi.fn() }));
vi.mock('@/lib/airtable/tables', () => ({ AIRTABLE_TABLES: { PROJECTS: 'Projects' } }));

import { syncPartnerJobFolder, parseDriveFolderId } from '@/lib/delivery/syncPartnerJobFolder';

const FOLDER = 'application/vnd.google-apps.folder';
const SHEET = 'application/vnd.google-apps.spreadsheet';
const DOC = 'application/vnd.google-apps.document';
const SHORTCUT = 'application/vnd.google-apps.shortcut';

type F = {
  id: string; name: string; mimeType: string; parent: string; createdTime: string;
  trashed?: boolean; shortcutDetails?: { targetId: string; targetMimeType?: string };
};

function fakeDrive(initial: F[]) {
  const files = [...initial];
  let n = 100;
  const drive: any = {
    files: {
      list: vi.fn(async ({ q }: { q: string }) => {
        const parent = /'([^']+)' in parents/.exec(q)![1];
        const nameM = /name = '((?:\\.|[^'])*)'/.exec(q);
        let out = files.filter((f) => f.parent === parent && !f.trashed);
        if (nameM) out = out.filter((f) => f.name === nameM[1].replace(/\\(.)/g, '$1') && f.mimeType === FOLDER);
        return { data: { files: out } };
      }),
      create: vi.fn(async ({ requestBody }: any) => {
        n += 1;
        const f: F = {
          id: `new${n}`, name: requestBody.name, mimeType: requestBody.mimeType,
          parent: requestBody.parents[0], createdTime: new Date(1_800_000_000_000 + n).toISOString(),
          shortcutDetails: requestBody.shortcutDetails,
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

const t = (i: number) => new Date(1_700_000_000_000 + i).toISOString();
const fld = (id: string, name: string, parent: string, i = 1): F => ({ id, name, mimeType: FOLDER, parent, createdTime: t(i) });

describe('parseDriveFolderId', () => {
  it('handles urls and raw ids', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/folders/1abcDEF_ghi-123?usp=sharing')).toBe('1abcDEF_ghi-123');
    expect(parseDriveFolderId('1abcDEF_ghi-123456')).toBe('1abcDEF_ghi-123456');
    expect(parseDriveFolderId('')).toBeNull();
  });
});

describe('syncPartnerJobFolder', () => {
  const primary = () => [
    fld('S', 'Social', 'P'), fld('SP', 'Prospecting', 'S'), fld('SR', 'Retargeting', 'S'),
    fld('G', 'Geofence', 'P'), fld('O', 'OOH', 'P'),
    { id: 'sheet', name: 'Creative Review', mimeType: SHEET, parent: 'P', createdTime: t(1) },
    { id: 'copydoc', name: 'SOCIAL-COPY', mimeType: DOC, parent: 'S', createdTime: t(1) },
    { id: 'video', name: 'spot.mp4', mimeType: 'video/mp4', parent: 'S', createdTime: t(1) },
  ] as F[];

  it('creates missing folders and shortcuts docs (never media), leaving primary untouched', async () => {
    const { drive, files } = fakeDrive([...primary(), fld('B', 'Job', 'ROOT')]);
    const before = JSON.stringify(files.filter((f) => ['P','S','SP','SR','G','O','sheet','copydoc','video'].includes(f.id)));
    const r = await syncPartnerJobFolder(drive, 'P', 'B');
    expect(r.failures).toEqual([]);
    expect(r.foldersCreated).toBe(5); // Social, Prospecting, Retargeting, Geofence, OOH
    expect(r.shortcutsCreated).toBe(2);
    const sc = files.filter((f) => f.mimeType === SHORTCUT);
    expect(sc.map((s) => s.shortcutDetails!.targetId).sort()).toEqual(['copydoc', 'sheet']);
    expect(files.some((f) => f.name === 'spot.mp4' && f.parent !== 'S')).toBe(false);
    expect(JSON.stringify(files.filter((f) => ['P','S','SP','SR','G','O','sheet','copydoc','video'].includes(f.id)))).toBe(before);
  });

  it('is idempotent', async () => {
    const { drive, files } = fakeDrive([...primary(), fld('B', 'Job', 'ROOT')]);
    await syncPartnerJobFolder(drive, 'P', 'B');
    const count = files.length;
    const r2 = await syncPartnerJobFolder(drive, 'P', 'B');
    expect(files.length).toBe(count);
    expect(r2.foldersCreated + r2.shortcutsCreated + r2.duplicateFoldersTrashed).toBe(0);
  });

  it('trashes empty duplicates, reports non-empty ones, never deletes content', async () => {
    const { drive, files } = fakeDrive([
      ...primary(), fld('B', 'Job', 'ROOT'),
      fld('B_S1', 'Social', 'B', 1), fld('B_S2', 'Social', 'B', 2), fld('B_S3', 'Social', 'B', 3),
      { id: 'asset', name: 'x.mp4', mimeType: 'video/mp4', parent: 'B_S3', createdTime: t(3) },
    ]);
    const r = await syncPartnerJobFolder(drive, 'P', 'B');
    expect(files.find((f) => f.id === 'B_S1')!.trashed).toBeUndefined(); // oldest = winner
    expect(files.find((f) => f.id === 'B_S2')!.trashed).toBe(true);      // empty dup
    expect(files.find((f) => f.id === 'B_S3')!.trashed).toBeUndefined(); // has content
    expect(files.find((f) => f.id === 'asset')!.trashed).toBeUndefined();
    expect(r.duplicatesNeedingReview).toEqual([{ path: '/Social', folderIds: ['B_S1', 'B_S3'] }]);
  });

  it('does not replace an existing real copy of a doc; reports it', async () => {
    const { drive, files } = fakeDrive([
      ...primary(), fld('B', 'Job', 'ROOT'),
      { id: 'oldcopy', name: 'Creative Review', mimeType: SHEET, parent: 'B', createdTime: t(2) },
    ]);
    const r = await syncPartnerJobFolder(drive, 'P', 'B');
    expect(r.docCopiesNeedingReview).toEqual([{ path: '/Creative Review', partnerFileId: 'oldcopy' }]);
    expect(files.filter((f) => f.parent === 'B' && f.name === 'Creative Review')).toHaveLength(1);
  });

  it('dryRun makes no writes', async () => {
    const { drive } = fakeDrive([...primary(), fld('B', 'Job', 'ROOT')]);
    const r = await syncPartnerJobFolder(drive, 'P', 'B', { dryRun: true });
    expect(drive.files.create).not.toHaveBeenCalled();
    expect(drive.files.update).not.toHaveBeenCalled();
    expect(r.foldersCreated).toBeGreaterThan(0);
  });

  it('refuses to sync a folder onto itself', async () => {
    const { drive } = fakeDrive([]);
    await expect(syncPartnerJobFolder(drive, 'X', 'X')).rejects.toThrow();
  });
});
