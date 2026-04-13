// lib/review/reviewMediaDisplay.ts
// Drive metadata in /api/review/assets is sometimes missing or generic (application/octet-stream).
// The portal must still pick <img> vs <video> vs generic file — match video’s extension fallback for images.

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg)$/i;
const AUDIO_EXT = /\.(mp3|wav|aac|ogg|m4a|flac)$/i;

export function reviewAssetIsImage(mimeType: string, filename: string): boolean {
  const m = mimeType.trim().toLowerCase();
  if (m.startsWith('image/')) return true;
  return IMAGE_EXT.test(filename);
}

export function reviewAssetIsVideo(mimeType: string, filename: string): boolean {
  const m = mimeType.trim().toLowerCase();
  if (m.startsWith('video/')) return true;
  return VIDEO_EXT.test(filename);
}

export function reviewAssetIsAudio(mimeType: string, filename: string): boolean {
  const m = mimeType.trim().toLowerCase();
  if (m.startsWith('audio/')) return true;
  return AUDIO_EXT.test(filename);
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
