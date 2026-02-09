// lib/utils/googleDrive.ts
// Utilities for working with Google Drive links

/**
 * Extracts the file ID from a Google Drive share link
 * Supports multiple Google Drive URL formats:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - FILE_ID (if already extracted)
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;

  // If it's already just an ID (no URL structure)
  if (!url.includes('drive.google.com') && !url.includes('/')) {
    return url;
  }

  // Try to extract from /file/d/FILE_ID/ format
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return fileMatch[1];
  }

  // Try to extract from ?id= format
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return idMatch[1];
  }

  // Try to extract from /uc?id= format
  const ucMatch = url.match(/\/uc\?id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) {
    return ucMatch[1];
  }

  return null;
}

/**
 * Converts a Google Drive share link to a direct view URL
 * This URL can be used in <img> tags for images/GIFs or <video> tags for videos
 */
export function getGoogleDriveDirectUrl(shareUrl: string): string | null {
  const fileId = extractGoogleDriveFileId(shareUrl);
  if (!fileId) {
    return null;
  }

  // Direct view URL - works for images, GIFs, and can be used for videos
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/**
 * Converts a Google Drive share link to a direct download URL
 * Use this for videos or files that need to be downloaded
 */
export function getGoogleDriveDownloadUrl(shareUrl: string): string | null {
  const fileId = extractGoogleDriveFileId(shareUrl);
  if (!fileId) {
    return null;
  }

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Detects the file type from a Google Drive URL or filename
 * Returns the MIME type or file extension
 */
export function detectFileType(url: string, filename?: string): 'image' | 'video' | 'gif' | 'unknown' {
  const lowerUrl = url.toLowerCase();
  const lowerFilename = filename?.toLowerCase() || '';

  // Check for GIF
  if (lowerUrl.includes('.gif') || lowerFilename.includes('.gif')) {
    return 'gif';
  }

  // Check for video formats
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  if (videoExtensions.some(ext => lowerUrl.includes(ext) || lowerFilename.includes(ext))) {
    return 'video';
  }

  // Check for image formats
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
  if (imageExtensions.some(ext => lowerUrl.includes(ext) || lowerFilename.includes(ext))) {
    return 'image';
  }

  return 'unknown';
}
