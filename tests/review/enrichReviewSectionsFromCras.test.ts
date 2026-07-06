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
});
