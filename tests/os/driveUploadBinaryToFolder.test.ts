// tests/os/driveUploadBinaryToFolder.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { drive_v3 } from 'googleapis';
import {
  buildListFilesByNameQuery,
  uploadOrUpdateFileInFolder,
} from '@/lib/os/driveUploadBinaryToFolder';

function makeMockDrive(opts: {
  listFiles: Array<{ id?: string; name?: string; webViewLink?: string }>;
  createReturn?: { id?: string; webViewLink?: string };
  updateReturn?: { id?: string; webViewLink?: string };
  getReturn?: { webViewLink?: string };
}) {
  const files = {
    list: vi.fn().mockResolvedValue({ data: { files: opts.listFiles } }),
    create: vi.fn().mockResolvedValue({
      data: opts.createReturn ?? { id: 'created-1', webViewLink: 'https://drive.google.com/file/d/created-1/view' },
    }),
    update: vi.fn().mockResolvedValue({
      data: opts.updateReturn ?? { id: 'updated-1', webViewLink: 'https://drive.google.com/file/d/updated-1/view' },
    }),
    get: vi.fn().mockResolvedValue({
      data: { webViewLink: opts.getReturn?.webViewLink ?? 'https://drive.google.com/file/d/fallback/view' },
    }),
  };
  return { files } as unknown as drive_v3.Drive;
}

describe('uploadOrUpdateFileInFolder', () => {
  it('creates when no matching file exists', async () => {
    const drive = makeMockDrive({ listFiles: [] });
    const buf = Buffer.from('hello');

    const out = await uploadOrUpdateFileInFolder(drive, {
      folderId: 'folderABC',
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      body: buf,
    });

    expect(out.action).toBe('Uploaded');
    expect(out.fileId).toBe('created-1');
    expect(out.fileUrl).toContain('created-1');
    expect(drive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringMatching(/name = 'report\.pdf'/),
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      }),
    );
    expect(drive.files.create).toHaveBeenCalled();
    expect(drive.files.update).not.toHaveBeenCalled();
  });

  it('updates when a file with the same name exists in the folder', async () => {
    const drive = makeMockDrive({
      listFiles: [{ id: 'existing-9', name: 'report.pdf', webViewLink: 'https://example/old' }],
      updateReturn: { id: 'existing-9', webViewLink: 'https://drive.google.com/file/d/existing-9/view' },
    });
    const buf = Buffer.from('v2');

    const out = await uploadOrUpdateFileInFolder(drive, {
      folderId: 'folderABC',
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      body: buf,
    });

    expect(out.action).toBe('Updated');
    expect(out.fileId).toBe('existing-9');
    expect(drive.files.update).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'existing-9',
        supportsAllDrives: true,
        media: expect.objectContaining({ mimeType: 'application/pdf' }),
      }),
    );
    expect(drive.files.create).not.toHaveBeenCalled();
  });
});

describe('buildListFilesByNameQuery', () => {
  it('escapes single quotes in file names for the q parameter', () => {
    const q = buildListFilesByNameQuery('abc', "O'Reilly.pdf");
    expect(q).toContain("name = 'O\\'Reilly.pdf'");
    expect(q).toContain("'abc' in parents");
  });
});
