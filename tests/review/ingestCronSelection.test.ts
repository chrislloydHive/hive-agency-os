import { describe, expect, it } from 'vitest';
import {
  CRAS_MUX_PLAYBACK_ID_FIELD,
  CRAS_MUX_UPLOAD_ID_FIELD,
} from '@/lib/mux/crasMuxFields';
import {
  driveFileIdFromCrasSourceField,
  existingCrasEntryFromFields,
  ingestCronFileAction,
  selectIngestCronFiles,
} from '@/lib/review/ingestCronSelection';

describe('driveFileIdFromCrasSourceField', () => {
  it('extracts ids from Drive URLs', () => {
    expect(
      driveFileIdFromCrasSourceField('https://drive.google.com/file/d/abcDEF1234567890/view'),
    ).toBe('abcDEF1234567890');
  });
});

describe('ingestCronFileAction', () => {
  const existing = new Map([
    ['img-1', { hasMuxIdentifier: false, filename: 'banner.gif' }],
    ['vid-ready', { hasMuxIdentifier: true, filename: 'spot.mp4' }],
    ['vid-empty', { hasMuxIdentifier: false, filename: 'new-display.mp4' }],
  ]);

  it('processes Drive files that have no CRAS yet', () => {
    expect(ingestCronFileAction({ id: 'brand-new', name: 'spot.mp4' }, existing)).toBe('new');
  });

  it('skips images that already have CRAS (Mux not required)', () => {
    expect(ingestCronFileAction({ id: 'img-1', name: 'banner.gif' }, existing)).toBe('skip');
  });

  it('skips videos that already have Mux identifiers', () => {
    expect(ingestCronFileAction({ id: 'vid-ready', name: 'spot.mp4' }, existing)).toBe('skip');
  });

  it('Mux-backfills videos whose CRAS was created without Mux (portal first-open)', () => {
    expect(ingestCronFileAction({ id: 'vid-empty', name: 'new-display.mp4' }, existing)).toBe(
      'mux-backfill',
    );
  });
});

describe('selectIngestCronFiles', () => {
  it('includes new files and Mux-missing videos, not ready videos or images', () => {
    const existing = new Map([
      ['gif', { hasMuxIdentifier: false, filename: 'ad.gif' }],
      ['ready', { hasMuxIdentifier: true, filename: 'old.mp4' }],
      ['empty-mp4', { hasMuxIdentifier: false, filename: 'today.mp4' }],
    ]);
    const selected = selectIngestCronFiles(
      [
        { id: 'gif', name: 'ad.gif' },
        { id: 'ready', name: 'old.mp4' },
        { id: 'empty-mp4', name: 'today.mp4' },
        { id: 'brand-new', name: 'fresh.png' },
      ],
      existing,
    );
    expect(selected.newCount).toBe(1);
    expect(selected.muxBackfillCount).toBe(1);
    expect(selected.toProcess.map((f) => f.id)).toEqual(['empty-mp4', 'brand-new']);
  });
});

describe('existingCrasEntryFromFields', () => {
  it('detects Mux identifiers on CRAS fields', () => {
    expect(
      existingCrasEntryFromFields({
        Filename: 'a.mp4',
        [CRAS_MUX_PLAYBACK_ID_FIELD]: 'pb_1',
      }).hasMuxIdentifier,
    ).toBe(true);
    expect(
      existingCrasEntryFromFields({
        Filename: 'a.mp4',
        [CRAS_MUX_UPLOAD_ID_FIELD]: '',
      }).hasMuxIdentifier,
    ).toBe(false);
  });
});
