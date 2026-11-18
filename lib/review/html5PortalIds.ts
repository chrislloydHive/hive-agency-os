/**
 * Portal identity for one size inside a Foldwrap `*_html5_delivery.zip`.
 * The Drive file stays the package. The portal file id points at one inner zip.
 * Safe to import from client components (no Node APIs).
 */

const PREFIX = 'html5~';

export function isHtml5DeliveryPackageName(name: string): boolean {
  return /_html5_delivery\.zip$/i.test(name.trim());
}

export function html5PortalFileId(driveFileId: string, entry: string): string {
  return `${PREFIX}${driveFileId}~${encodeURIComponent(entry)}`;
}

export function parseHtml5PortalFileId(
  fileId: string,
): { driveFileId: string; entry: string } | null {
  if (!fileId.startsWith(PREFIX)) return null;
  const rest = fileId.slice(PREFIX.length);
  const sep = rest.indexOf('~');
  if (sep <= 0) return null;
  const driveFileId = rest.slice(0, sep).trim();
  let entry = rest.slice(sep + 1);
  try {
    entry = decodeURIComponent(entry);
  } catch {
    return null;
  }
  if (!driveFileId || !isSafeZipEntry(entry)) return null;
  return { driveFileId, entry };
}

export function isSafeZipEntry(entry: string): boolean {
  const name = entry.trim();
  if (!name || name.length > 240) return false;
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return false;
  return name.toLowerCase().endsWith('.zip');
}

export function html5SizeFromEntry(entry: string): { width: number; height: number } | null {
  // gifts_300x250_… and tis_the_season160x600_… (no underscore before the size).
  const matches = [...entry.matchAll(/(\d+)x(\d+)/gi)];
  const match = matches.at(-1);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
  return { width, height };
}

export function html5SizeLabel(entry: string, width: number, height: number): string {
  const creative = entry.replace(/\.zip$/i, '').split('_')[0] || 'Display';
  return `${creative} · ${width}×${height}`;
}

function encodedPath(token: string, driveFileId: string, entry: string): string {
  return `/api/review/html5/${encodeURIComponent(token)}/${encodeURIComponent(driveFileId)}/${encodeURIComponent(entry)}`;
}

/** Iframe URL. Relative files in the ad resolve against this directory. */
export function html5PreviewUrl(token: string, portalFileId: string): string | null {
  const parsed = parseHtml5PortalFileId(portalFileId);
  if (!parsed) return null;
  return `${encodedPath(token, parsed.driveFileId, parsed.entry)}/index.html`;
}

/** Download the inner size zip, intact, for trafficking. */
export function html5DownloadUrl(token: string, portalFileId: string): string | null {
  const parsed = parseHtml5PortalFileId(portalFileId);
  if (!parsed) return null;
  return `${encodedPath(token, parsed.driveFileId, parsed.entry)}?dl=1`;
}
