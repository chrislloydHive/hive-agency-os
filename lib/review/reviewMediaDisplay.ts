// lib/review/reviewMediaDisplay.ts
// Drive metadata in /api/review/assets is sometimes missing or generic (application/octet-stream).
// The portal must still pick <img> vs <video> vs generic file — match video’s extension fallback for images.

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg)$/i;
const AUDIO_EXT = /\.(mp3|wav|aac|ogg|m4a|flac)$/i;

function basename(filename: string): string {
  const t = filename.trim();
  const i = Math.max(t.lastIndexOf('/'), t.lastIndexOf('\\'));
  return i >= 0 ? t.slice(i + 1) : t;
}

/**
 * Single classification for grid/lightbox so we never render both <img> and <video> for one asset.
 * Image extensions win over wrong video/* from Drive (animated GIF/WebP mislabeled as video).
 */
export type ReviewAssetDisplayKind = 'image' | 'video' | 'audio' | 'file';

export function reviewAssetDisplayKind(mimeType: string, filename: string): ReviewAssetDisplayKind {
  const m = mimeType.trim().toLowerCase();
  const base = basename(filename);

  if (m.startsWith('image/')) return 'image';
  if (IMAGE_EXT.test(base)) return 'image';

  if (m.startsWith('audio/')) return 'audio';
  if (AUDIO_EXT.test(base)) return 'audio';

  if (m.startsWith('video/')) return 'video';
  if (VIDEO_EXT.test(base)) return 'video';

  return 'file';
}

export function reviewAssetIsImage(mimeType: string, filename: string): boolean {
  return reviewAssetDisplayKind(mimeType, filename) === 'image';
}

export function reviewAssetIsVideo(mimeType: string, filename: string): boolean {
  return reviewAssetDisplayKind(mimeType, filename) === 'video';
}

export function reviewAssetIsAudio(mimeType: string, filename: string): boolean {
  return reviewAssetDisplayKind(mimeType, filename) === 'audio';
}

/** When Drive returns empty or octet-stream, set a concrete mime for clients (optional UX). */
export function inferMimeTypeFromFilename(filename: string): string | null {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  return null;
}

