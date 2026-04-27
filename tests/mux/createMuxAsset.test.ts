import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';

import type { Base as AirtableBase } from 'airtable';

import { getProjectsBase } from '@/lib/airtable';
import { getMuxClient } from '@/lib/mux/client';
import {
  createMuxAssetFromDrive,
  isCrasAssetEligibleForMux,
} from '@/lib/mux/createMuxAsset';
import {
  CRAS_MUX_ASSET_ID_FIELD,
  CRAS_MUX_STATUS_FIELD,
  CRAS_MUX_UPLOAD_ID_FIELD,
} from '@/lib/mux/crasMuxFields';

vi.mock('@/lib/airtable', () => ({
  getProjectsBase: vi.fn(),
}));

vi.mock('@/lib/mux/client', () => ({
  getMuxClient: vi.fn(),
}));

const mockGetProjectsBase = vi.mocked(getProjectsBase);
const mockGetMuxClient = vi.mocked(getMuxClient);

describe('createMuxAssetFromDrive', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns skipped when Mux client is not configured', async () => {
    mockGetMuxClient.mockReturnValue(null);
    const drive = { files: { get: vi.fn() } } as any;
    const res = await createMuxAssetFromDrive({
      drive,
      driveFileId: 'drive1',
      crasRecordId: 'rec12345678901234',
      fileName: 'clip.mp4',
    });
    expect(res).toEqual({ ok: false, error: 'Mux not configured', skipped: true });
    expect(drive.files.get).not.toHaveBeenCalled();
  });

  it('skips non-video files (e.g. GIF stays image)', async () => {
    mockGetMuxClient.mockReturnValue({} as any);
    expect(isCrasAssetEligibleForMux('image/gif', 'social.gif')).toBe(false);

    const drive = {
      files: {
        get: vi.fn().mockResolvedValue({
          data: { mimeType: 'image/gif', size: '10', name: 'social.gif' },
        }),
      },
    } as any;

    const res = await createMuxAssetFromDrive({
      drive,
      driveFileId: 'drive1',
      crasRecordId: 'rec12345678901234',
      fileName: 'social.gif',
    });
    expect(res).toMatchObject({ ok: false, skipped: true });
    expect(drive.files.get).toHaveBeenCalledTimes(1);
  });

  it('creates direct upload, writes preparing to CRAS, PUTs Drive stream to Mux URL', async () => {
    const update = vi.fn().mockResolvedValue({});
    mockGetProjectsBase.mockReturnValue((() => ({ update }) as any) as unknown as AirtableBase);

    const uploadsCreate = vi.fn().mockResolvedValue({
      id: 'up_ABC',
      url: 'https://mux-upload.example/put',
      asset_id: 'asset_from_create',
    });
    const uploadsRetrieve = vi.fn().mockResolvedValue({ asset_id: 'asset_refreshed' });
    mockGetMuxClient.mockReturnValue({
      video: {
        uploads: {
          create: uploadsCreate,
          retrieve: uploadsRetrieve,
        },
      },
    } as any);

    const mediaStream = Readable.from(Buffer.from('fake-bytes'));
    const drive = {
      files: {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            data: { mimeType: 'video/mp4', size: '12', name: 'a.mp4' },
          })
          .mockResolvedValueOnce({ data: mediaStream }),
      },
    } as any;

    const res = await createMuxAssetFromDrive({
      drive,
      driveFileId: 'driveFile99',
      crasRecordId: 'rec12345678901234',
      fileName: 'a.mp4',
    });

    expect(res).toEqual({ ok: true, uploadId: 'up_ABC', assetId: 'asset_refreshed' });
    expect(uploadsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        new_asset_settings: expect.objectContaining({
          passthrough: 'rec12345678901234',
          playback_policies: ['public'],
        }),
      }),
    );
    expect(update).toHaveBeenCalled();
    const firstPatch = update.mock.calls.find(
      (c) => c[1]?.[CRAS_MUX_STATUS_FIELD] === 'preparing',
    );
    expect(firstPatch?.[1]).toMatchObject({
      [CRAS_MUX_UPLOAD_ID_FIELD]: 'up_ABC',
      [CRAS_MUX_STATUS_FIELD]: 'preparing',
      [CRAS_MUX_ASSET_ID_FIELD]: 'asset_from_create',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mux-upload.example/put',
      expect.objectContaining({ method: 'PUT' }),
    );
    const lastAssetPatch = update.mock.calls.filter((c) => c[1]?.[CRAS_MUX_ASSET_ID_FIELD]).pop();
    expect(lastAssetPatch?.[1]?.[CRAS_MUX_ASSET_ID_FIELD]).toBe('asset_refreshed');
  });

  it('on uploads.create failure, marks CRAS errored and returns ok false', async () => {
    const update = vi.fn().mockResolvedValue({});
    mockGetProjectsBase.mockReturnValue((() => ({ update }) as any) as unknown as AirtableBase);
    mockGetMuxClient.mockReturnValue({
      video: {
        uploads: {
          create: vi.fn().mockRejectedValue(new Error('rate limited')),
        },
      },
    } as any);

    const drive = {
      files: {
        get: vi.fn().mockResolvedValue({
          data: { mimeType: 'video/mp4', size: '1', name: 'x.mp4' },
        }),
      },
    } as any;

    const res = await createMuxAssetFromDrive({
      drive,
      driveFileId: 'f1',
      crasRecordId: 'rec12345678901234',
      fileName: 'x.mp4',
    });
    expect(res.ok).toBe(false);
    expect(update).toHaveBeenCalledWith(
      'rec12345678901234',
      expect.objectContaining({ [CRAS_MUX_STATUS_FIELD]: 'errored' }),
    );
  });
});
