import { describe, it, expect } from 'vitest';
import { parseAirtableCheckbox } from '@/lib/airtable/reviewAssetStatus';
import {
  isDriveFileEligibleForReviewPortal,
  portalAssetNamesMatch,
} from '@/lib/review/reviewPortalVisibility';
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
