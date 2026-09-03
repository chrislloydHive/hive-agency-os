import { describe, it, expect } from 'vitest';
import { mergeReviewSections } from '@/lib/review/mergeReviewSections';

describe('mergeReviewSections', () => {
  it('drops previous-only assets that the API omitted (unchecked in Airtable)', () => {
    const previous = [
      {
        variant: 'Prospecting',
        tactic: 'Video',
        fileCount: 2,
        assets: [
          { fileId: 'display-1', name: 'display.mp4', mimeType: 'video/mp4' },
          { fileId: 'youtube-1', name: 'YouTube Links.mp4', mimeType: 'video/mp4' },
        ],
      },
    ];
    const incoming = [
      {
        variant: 'Prospecting',
        tactic: 'Video',
        fileCount: 1,
        assets: [
          { fileId: 'display-1', name: 'display.mp4', mimeType: 'video/mp4', muxPlaybackId: 'pb_1' },
        ],
      },
    ];

    const merged = mergeReviewSections(previous, incoming);

    expect(merged[0].assets.map((a) => a.fileId)).toEqual(['display-1']);
    expect(merged[0].fileCount).toBe(1);
    expect(merged[0].assets[0]).toMatchObject({ muxPlaybackId: 'pb_1' });
  });

  it('keeps incoming-only assets and overlays API fields onto matching previous assets', () => {
    const previous = [
      {
        variant: 'Prospecting',
        tactic: 'Display',
        fileCount: 1,
        groupId: 'crs-1',
        assets: [{ fileId: 'a', name: 'old-name.jpg', mimeType: 'image/jpeg' }],
      },
    ];
    const incoming = [
      {
        variant: 'Prospecting',
        tactic: 'Display',
        fileCount: 2,
        assets: [
          { fileId: 'a', name: 'new-name.jpg', mimeType: 'image/jpeg' },
          { fileId: 'b', name: 'added.jpg', mimeType: 'image/jpeg' },
        ],
      },
    ];

    const merged = mergeReviewSections(previous, incoming);

    expect(merged[0].assets.map((a) => a.fileId).sort()).toEqual(['a', 'b']);
    expect(merged[0].assets.find((a) => a.fileId === 'a')?.name).toBe('new-name.jpg');
    expect((merged[0] as { groupId?: string }).groupId).toBe('crs-1');
  });
});
