import { describe, it, expect } from 'vitest';
import { parseAirtableCheckbox } from '@/lib/airtable/reviewAssetStatus';
import {
  isDriveFileEligibleForReviewPortal,
  matchPortalListedFile,
  portalAssetNamesMatch,
  portalDisplayFileId,
  portalListedFileFromChild,
  portalListedFileIds,
  portalShortcutTargetId,
} from '@/lib/review/reviewPortalVisibility';
import { reviewAssetIsDocumentFile, isReviewWordDoc } from '@/lib/review/reviewMediaDisplay';
import { isDriveNotFoundError } from '@/lib/review/googleDriveErrors';

describe('portalAssetNamesMatch', () => {
  it('treats YouTube Links variants as the same asset', () => {
    expect(portalAssetNamesMatch('YouTube Links', 'YouTube Links.gdoc')).toBe(true);
    expect(portalAssetNamesMatch('YouTube Links', 'youtube  links')).toBe(true);
  });
});

describe('parseAirtableCheckbox', () => {
  it('treats omitted / unchecked Airtable values as false', () => {
    expect(parseAirtableCheckbox(undefined)).toBe(false);
    expect(parseAirtableCheckbox(null)).toBe(false);
    expect(parseAirtableCheckbox(false)).toBe(false);
    expect(parseAirtableCheckbox([])).toBe(false);
  });

  it('treats true-ish Airtable checkbox / lookup values as true', () => {
    expect(parseAirtableCheckbox(true)).toBe(true);
    expect(parseAirtableCheckbox(1)).toBe(true);
    expect(parseAirtableCheckbox('true')).toBe(true);
    expect(parseAirtableCheckbox([true])).toBe(true);
    expect(parseAirtableCheckbox({ value: true })).toBe(true);
  });
});

describe('isDriveFileEligibleForReviewPortal', () => {
  const reviewFolder = 'variant-folder-video-prospecting';
  const allowedFolderIds = new Set([reviewFolder]);

  it('hides files Drive reports as 404 (deleted)', () => {
    expect(
      isDriveFileEligibleForReviewPortal({
        meta: null,
        notFound: true,
        allowedFolderIds,
      }),
    ).toBe(false);
  });

  it('hides trashed files', () => {
    expect(
      isDriveFileEligibleForReviewPortal({
        meta: { trashed: true, parents: [reviewFolder] },
        notFound: false,
        allowedFolderIds,
      }),
    ).toBe(false);
  });

  it('hides files whose only parent is outside Client Review variant folders', () => {
    expect(
      isDriveFileEligibleForReviewPortal({
        meta: { trashed: false, parents: ['production-assets-folder'] },
        notFound: false,
        allowedFolderIds,
      }),
    ).toBe(false);
  });

  it('shows files that are still direct children of a review variant folder', () => {
    expect(
      isDriveFileEligibleForReviewPortal({
        meta: { trashed: false, parents: [reviewFolder] },
        notFound: false,
        allowedFolderIds,
      }),
    ).toBe(true);
  });

  it('does not folder-filter when the allowed set is empty (map unavailable)', () => {
    expect(
      isDriveFileEligibleForReviewPortal({
        meta: { trashed: false, parents: ['unknown'] },
        notFound: false,
        allowedFolderIds: new Set(),
      }),
    ).toBe(true);
  });

  it('shows a Google Doc whose target lives elsewhere when a shortcut is in the review folder', () => {
    expect(
      isDriveFileEligibleForReviewPortal({
        meta: { trashed: false, parents: ['templates-folder'] },
        notFound: false,
        allowedFolderIds,
        presentInReviewFolder: true,
      }),
    ).toBe(true);
  });

  it('shows a listed document even when Drive metadata for the stored id 404s', () => {
    expect(
      isDriveFileEligibleForReviewPortal({
        meta: null,
        notFound: true,
        allowedFolderIds,
        presentInReviewFolder: true,
      }),
    ).toBe(true);
  });

  it('still hides a trashed file that was listed', () => {
    expect(
      isDriveFileEligibleForReviewPortal({
        meta: { trashed: true, parents: [reviewFolder] },
        notFound: false,
        allowedFolderIds,
        presentInReviewFolder: true,
      }),
    ).toBe(false);
  });
});

describe('portal listed documents', () => {
  it('treats a shortcut and its target as the same review-folder file', () => {
    const listed = portalListedFileFromChild({
      folderId: 'variant-folder',
      id: 'shortcut-id',
      name: 'YouTube Links',
      mimeType: 'application/vnd.google-apps.shortcut',
      shortcutTargetId: 'doc-id',
      shortcutTargetMimeType: 'application/vnd.google-apps.document',
    });
    expect(listed.fileId).toBe('doc-id');
    expect(listed.mimeType).toBe('application/vnd.google-apps.document');
    expect(portalListedFileIds([listed])).toEqual(new Set(['shortcut-id', 'doc-id']));
    expect(portalShortcutTargetId({
      mimeType: 'application/vnd.google-apps.shortcut',
      shortcutDetails: { targetId: 'doc-id', targetMimeType: 'application/vnd.google-apps.document' },
    })?.targetId).toBe('doc-id');
  });

  it('matches a stale CRAS id to the document currently in the folder by name', () => {
    const listed = portalListedFileFromChild({
      folderId: 'variant-folder',
      id: 'live-doc',
      name: 'Creative Brief.pdf',
      mimeType: 'application/pdf',
    });
    const match = matchPortalListedFile([listed], 'old-cras-id', 'Creative Brief.pdf', 'variant-folder');
    expect(match?.fileId).toBe('live-doc');
    expect(portalDisplayFileId('old-cras-id', match)).toBe('live-doc');
    expect(portalDisplayFileId('live-doc', match)).toBe('live-doc');
  });

  it('does not match a same-named file from a different variant folder', () => {
    const listed = portalListedFileFromChild({
      folderId: 'other-folder',
      id: 'live-doc',
      name: 'Creative Brief.pdf',
      mimeType: 'application/pdf',
    });
    expect(matchPortalListedFile([listed], 'old-cras-id', 'Creative Brief.pdf', 'variant-folder')).toBeNull();
  });
});

describe('reviewAssetIsDocumentFile', () => {
  it('treats Google Docs and PDFs as documents and videos as media', () => {
    expect(reviewAssetIsDocumentFile('application/vnd.google-apps.document', 'YouTube Links')).toBe(true);
    expect(reviewAssetIsDocumentFile('application/pdf', 'Brief.pdf')).toBe(true);
    expect(reviewAssetIsDocumentFile('video/mp4', 'spot.mp4')).toBe(false);
  });

  it('recognizes Word and Google Docs that should be written to Airtable', () => {
    expect(isReviewWordDoc('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Brief.docx')).toBe(true);
    expect(isReviewWordDoc('application/msword', 'Brief.doc')).toBe(true);
    expect(isReviewWordDoc('application/vnd.google-apps.document', 'YouTube Links')).toBe(true);
    expect(isReviewWordDoc('application/octet-stream', 'Offer.docx')).toBe(true);
    expect(isReviewWordDoc('video/mp4', 'spot.mp4')).toBe(false);
    expect(isReviewWordDoc('application/pdf', 'Brief.pdf')).toBe(false);
  });
});

describe('isDriveNotFoundError', () => {
  it('detects numeric 404 from Google client errors', () => {
    expect(isDriveNotFoundError({ code: 404, message: 'Not Found' })).toBe(true);
    expect(isDriveNotFoundError({ response: { status: 404 } })).toBe(true);
  });

  it('does not treat 403 permission errors as deleted', () => {
    expect(isDriveNotFoundError({ code: 403, message: 'Forbidden' })).toBe(false);
  });
});
