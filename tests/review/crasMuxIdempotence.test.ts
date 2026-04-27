import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getProjectsBase } from '@/lib/airtable';
import { getProjectsByCreativeReviewHubFolderId } from '@/lib/airtable/projectFolderMap';
import { ensureCrasRecord } from '@/lib/airtable/reviewAssetStatus';
import { ensurePartnerDeliverySetup } from '@/lib/delivery/ensurePartnerDeliverySetup';
import {
  crasFieldsHaveAnyMuxIdentifier,
  CRAS_MUX_ASSET_ID_FIELD,
  CRAS_MUX_IDENTIFIER_FIELD_NAMES,
  CRAS_MUX_PLAYBACK_ID_FIELD,
  CRAS_MUX_UPLOAD_ID_FIELD,
} from '@/lib/mux/crasMuxFields';
import { createMuxAssetFromDrive } from '@/lib/mux/createMuxAsset';

vi.mock('@/lib/airtable', () => ({
  getProjectsBase: vi.fn(),
}));

vi.mock('@/lib/airtable/projectFolderMap', () => ({
  getProjectsByCreativeReviewHubFolderId: vi.fn(),
}));

vi.mock('@/lib/airtable/reviewAssetStatus', () => ({
  ensureCrasRecord: vi.fn(),
}));

vi.mock('@/lib/delivery/ensurePartnerDeliverySetup', () => ({
  ensurePartnerDeliverySetup: vi.fn().mockResolvedValue({ status: 'exists' }),
}));

vi.mock('@/lib/mux/createMuxAsset', () => ({
  createMuxAssetFromDrive: vi.fn(),
}));

const mockEnsureCrasRecord = vi.mocked(ensureCrasRecord);
const mockCreateMux = vi.mocked(createMuxAssetFromDrive);
const mockFolderMap = vi.mocked(getProjectsByCreativeReviewHubFolderId);
const mockGetProjectsBase = vi.mocked(getProjectsBase);
const mockEnsurePartnerDelivery = vi.mocked(ensurePartnerDeliverySetup);

describe('crasFieldsHaveAnyMuxIdentifier', () => {
  it('returns false when fields undefined or all mux ids empty', () => {
    expect(crasFieldsHaveAnyMuxIdentifier(undefined)).toBe(false);
    expect(crasFieldsHaveAnyMuxIdentifier({})).toBe(false);
    expect(
      crasFieldsHaveAnyMuxIdentifier({
        [CRAS_MUX_ASSET_ID_FIELD]: '',
        [CRAS_MUX_UPLOAD_ID_FIELD]: '  ',
      }),
    ).toBe(false);
  });

  it('returns true when any mux id is non-empty', () => {
    expect(crasFieldsHaveAnyMuxIdentifier({ [CRAS_MUX_UPLOAD_ID_FIELD]: 'up_abc' })).toBe(true);
    expect(crasFieldsHaveAnyMuxIdentifier({ [CRAS_MUX_ASSET_ID_FIELD]: 'as_xyz' })).toBe(true);
    expect(crasFieldsHaveAnyMuxIdentifier({ [CRAS_MUX_PLAYBACK_ID_FIELD]: 'pb_1' })).toBe(true);
  });
});

describe('ingestFileToCras Mux idempotence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreateMux.mockResolvedValue({ ok: true, uploadId: 'up_test' });
    mockFolderMap.mockResolvedValue(
      new Map([
        [
          'folder_hub',
          {
            projectId: 'recPROJ',
            projectName: 'Test Project',
            folderId: 'folder_hub',
            reviewToken: 'tok',
          },
        ],
      ]),
    );
  });

  it('calls createMuxAssetFromDrive when CRAS already exists and mux fields are empty', async () => {
    mockEnsureCrasRecord.mockResolvedValue({
      created: false,
      recordId: 'recCRAS1',
      existingFields: {
        Filename: 'clip.mp4',
        [CRAS_MUX_ASSET_ID_FIELD]: '',
        [CRAS_MUX_UPLOAD_ID_FIELD]: undefined,
      },
    });

    const { ingestFileToCras } = await import('@/lib/review/ingestFileToCras');
    const drive = {} as any;
    await ingestFileToCras(
      {
        fileId: 'file1',
        fileName: 'clip.mp4',
        folderId: 'folder_hub',
        parentFolderIds: ['folder_hub'],
      },
      undefined,
      { drive },
    );

    expect(mockCreateMux).toHaveBeenCalledTimes(1);
    expect(mockCreateMux).toHaveBeenCalledWith(
      expect.objectContaining({
        driveFileId: 'file1',
        crasRecordId: 'recCRAS1',
        fileName: 'clip.mp4',
      }),
    );
  });

  it('skips createMuxAssetFromDrive when CRAS already has mux identifiers', async () => {
    mockEnsureCrasRecord.mockResolvedValue({
      created: false,
      recordId: 'recCRAS2',
      existingFields: {
        [CRAS_MUX_UPLOAD_ID_FIELD]: 'up_existing',
      },
    });

    const { ingestFileToCras } = await import('@/lib/review/ingestFileToCras');
    const drive = {} as any;
    await ingestFileToCras(
      {
        fileId: 'file2',
        fileName: 'clip2.mp4',
        folderId: 'folder_hub',
        parentFolderIds: ['folder_hub'],
      },
      undefined,
      { drive },
    );

    expect(mockCreateMux).not.toHaveBeenCalled();
  });

  it('calls createMuxAssetFromDrive when CRAS is newly created and Drive client is present', async () => {
    mockEnsureCrasRecord.mockResolvedValue({
      created: true,
      recordId: 'recCRAS_NEW',
    });

    const { ingestFileToCras } = await import('@/lib/review/ingestFileToCras');
    const drive = {} as any;
    await ingestFileToCras(
      {
        fileId: 'file_new',
        fileName: 'new.mp4',
        folderId: 'folder_hub',
        parentFolderIds: ['folder_hub'],
      },
      undefined,
      { drive },
    );

    expect(mockCreateMux).toHaveBeenCalledTimes(1);
    expect(mockCreateMux).toHaveBeenCalledWith(
      expect.objectContaining({
        driveFileId: 'file_new',
        crasRecordId: 'recCRAS_NEW',
        fileName: 'new.mp4',
      }),
    );
    expect(mockEnsurePartnerDelivery).toHaveBeenCalledTimes(1);
  });

  it('does not call ensurePartnerDeliverySetup when CRAS already existed', async () => {
    mockEnsureCrasRecord.mockResolvedValue({
      created: false,
      recordId: 'recCRAS1',
      existingFields: {
        [CRAS_MUX_ASSET_ID_FIELD]: '',
      },
    });

    const { ingestFileToCras } = await import('@/lib/review/ingestFileToCras');
    await ingestFileToCras(
      {
        fileId: 'file1',
        fileName: 'clip.mp4',
        folderId: 'folder_hub',
        parentFolderIds: ['folder_hub'],
      },
      undefined,
      { drive: {} as any },
    );

    expect(mockEnsurePartnerDelivery).not.toHaveBeenCalled();
  });

  it('when existingFields is omitted, loads mux identifier fields only then calls createMuxAssetFromDrive', async () => {
    mockEnsureCrasRecord.mockResolvedValue({
      created: false,
      recordId: 'recCRAS_FALLBACK',
    });
    const firstPage = vi.fn().mockResolvedValue([{ id: 'recCRAS_FALLBACK', fields: {} }]);
    const select = vi.fn(() => ({ firstPage }));
    mockGetProjectsBase.mockReturnValue(() => ({ select }) as any);

    const { ingestFileToCras } = await import('@/lib/review/ingestFileToCras');
    await ingestFileToCras(
      {
        fileId: 'file_fb',
        fileName: 'fb.mp4',
        folderId: 'folder_hub',
        parentFolderIds: ['folder_hub'],
      },
      undefined,
      { drive: {} as any },
    );

    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        filterByFormula: 'RECORD_ID()="recCRAS_FALLBACK"',
        fields: [...CRAS_MUX_IDENTIFIER_FIELD_NAMES],
        maxRecords: 1,
      }),
    );
    expect(mockCreateMux).toHaveBeenCalledTimes(1);
    expect(mockCreateMux).toHaveBeenCalledWith(
      expect.objectContaining({ crasRecordId: 'recCRAS_FALLBACK', driveFileId: 'file_fb' }),
    );
  });
});
