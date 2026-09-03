import { describe, it, expect } from 'vitest';
import { enrichReviewSectionsFromCras } from '@/lib/review/enrichReviewSectionsFromCras';
import type { StatusRecord } from '@/lib/airtable/reviewAssetStatus';

function makeStatus(overrides: Partial<StatusRecord> & { driveFileId: string }): StatusRecord {
  return {
    recordId: 'rec12345678901234',
    filename: 'clip.mp4',
    tactic: 'Display',
    variant: 'Prospecting',
    hidden: false,
    showInClientPortal: true,
    status: 'New',
    assetApprovedClient: false,
    firstSeenByClientAt: null,
    firstSeenAt: null,
    lastSeenAt: null,
    approvedAt: null,
    approvedByName: null,
    approvedByEmail: null,
    lastActivityAt: null,
    notes: null,
    landingPageOverrideUrl: null,
    effectiveLandingPageUrl: null,
    deliveredAt: null,
    delivered: false,
    deliveredFolderId: null,
    deliveredFileUrl: null,
    partnerDownloadedAt: null,
    placementGroupId: null,
    placementGroupName: null,
    placementType: null,
    placementCardOrder: null,
    muxPlaybackId: 'pb_ready',
    muxStatus: 'ready',
    muxDuration: 10,
    muxAspectRatio: '16:9',
    ...overrides,
  };
}

describe('enrichReviewSectionsFromCras', () => {
  it('looks up CRAS rows by token::driveFileId, not bare fileId', () => {
    const token = 'portal-token';
    const fileId = 'drive-file-abc';
    const statusMap = new Map<string, StatusRecord>([
      [`${token}::${fileId}`, makeStatus({ driveFileId: fileId })],
    ]);

    const sections = enrichReviewSectionsFromCras(
      [
        {
          variant: 'Prospecting',
          tactic: 'Display',
          fileCount: 1,
          assets: [{ fileId, name: 'clip.mp4', mimeType: 'video/mp4' }],
        },
      ],
      statusMap,
      token,
    );

    expect(sections[0].assets[0]).toMatchObject({
      muxPlaybackId: 'pb_ready',
      muxStatus: 'ready',
      muxAspectRatio: '16:9',
      airtableRecordId: 'rec12345678901234',
    });
  });

  it('omits assets with Show in Client Portal unchecked even when no sibling is checked', () => {
    const token = 'portal-token';
    const shownId = 'drive-file-shown';
    const hiddenId = 'drive-file-youtube';
    const statusMap = new Map<string, StatusRecord>([
      [`${token}::${shownId}`, makeStatus({ driveFileId: shownId, filename: 'display.mp4' })],
      [
        `${token}::${hiddenId}`,
        makeStatus({
          driveFileId: hiddenId,
          filename: 'YouTube Links.mp4',
          showInClientPortal: false,
        }),
      ],
    ]);

    const sections = enrichReviewSectionsFromCras(
      [
        {
          variant: 'Prospecting',
          tactic: 'Video',
          fileCount: 2,
          assets: [
            { fileId: shownId, name: 'display.mp4', mimeType: 'video/mp4' },
            { fileId: hiddenId, name: 'YouTube Links.mp4', mimeType: 'video/mp4' },
          ],
        },
      ],
      statusMap,
      token,
    );

    expect(sections[0].assets.map((a) => a.fileId)).toEqual([shownId]);
    expect(sections[0].fileCount).toBe(1);
  });

  it('omits a Drive-listed Google Doc when CRAS filename matches an unchecked row', () => {
    const token = 'portal-token';
    const driveDocId = 'drive-doc-actual-id';
    const crasStoredId = 'https://docs.google.com/document/d/old-id/edit';
    const statusMap = new Map<string, StatusRecord>([
      [
        `${token}::${crasStoredId}`,
        makeStatus({
          driveFileId: crasStoredId,
          filename: 'YouTube Links',
          tactic: 'Video',
          showInClientPortal: false,
          muxPlaybackId: null,
          muxStatus: null,
        }),
      ],
    ]);

    const sections = enrichReviewSectionsFromCras(
      [
        {
          variant: 'Prospecting',
          tactic: 'Video',
          fileCount: 1,
          assets: [
            {
              fileId: driveDocId,
              name: 'YouTube Links',
              mimeType: 'application/vnd.google-apps.document',
            },
          ],
        },
      ],
      statusMap,
      token,
    );

    expect(sections[0].assets).toHaveLength(0);
  });

  it('omits a Drive file when a same-named CRAS row is unchecked even if another id is checked', () => {
    const token = 'portal-token';
    const driveId = 'drive-file-new';
    const statusMap = new Map<string, StatusRecord>([
      [
        `${token}::${driveId}`,
        makeStatus({
          driveFileId: driveId,
          filename: 'YouTube Links',
          tactic: 'Video',
          showInClientPortal: true,
        }),
      ],
      [
        `${token}::old-id`,
        makeStatus({
          driveFileId: 'old-id',
          filename: 'YouTube Links',
          tactic: 'Video',
          showInClientPortal: false,
          muxPlaybackId: null,
          muxStatus: null,
        }),
      ],
    ]);

    const sections = enrichReviewSectionsFromCras(
      [
        {
          variant: 'Prospecting',
          tactic: 'Video',
          fileCount: 1,
          assets: [
            {
              fileId: driveId,
              name: 'YouTube Links',
              mimeType: 'application/vnd.google-apps.document',
            },
          ],
        },
      ],
      statusMap,
      token,
    );

    expect(sections[0].assets).toHaveLength(0);
  });

  it('omits Drive-only files that have no CRAS row', () => {
    const token = 'portal-token';
    const sections = enrichReviewSectionsFromCras(
      [
        {
          variant: 'Prospecting',
          tactic: 'Video',
          fileCount: 1,
          assets: [
            {
              fileId: 'drive-only',
              name: 'YouTube Links',
              mimeType: 'application/vnd.google-apps.document',
            },
          ],
        },
      ],
      new Map(),
      token,
    );

    expect(sections[0].assets).toHaveLength(0);
  });

  it('omits Hidden CRAS rows even if Show in Client Portal is checked', () => {
    const token = 'portal-token';
    const fileId = 'drive-file-hidden';
    const statusMap = new Map<string, StatusRecord>([
      [`${token}::${fileId}`, makeStatus({ driveFileId: fileId, hidden: true })],
    ]);

    const sections = enrichReviewSectionsFromCras(
      [
        {
          variant: 'Prospecting',
          tactic: 'Display',
          fileCount: 1,
          assets: [{ fileId, name: 'clip.mp4', mimeType: 'video/mp4' }],
        },
      ],
      statusMap,
      token,
    );

    expect(sections[0].assets).toHaveLength(0);
    expect(sections[0].fileCount).toBe(0);
  });
});
