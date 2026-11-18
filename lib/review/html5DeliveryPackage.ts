import type { drive_v3 } from 'googleapis';

import {
  html5PortalFileId,
  html5SizeFromEntry,
  html5SizeLabel,
  isHtml5DeliveryPackageName,
  isSafeZipEntry,
} from '@/lib/review/html5PortalIds';
import { readZipFile, readZipFiles } from '@/lib/review/zipBytes';

export interface Html5PackageSize {
  entry: string;
  width: number;
  height: number;
  label: string;
}

const PACKAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const PACKAGE_CACHE_MAX = 24;
const packageCache = new Map<string, { buf: Buffer; at: number }>();

function parseManifest(csv: string): Html5PackageSize[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]);
  const zipCol = header.indexOf('ZIP file');
  const dimCol = header.indexOf('Dimensions');
  if (zipCol < 0) return [];
  const sizes: Html5PackageSize[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const entry = (cols[zipCol] ?? '').trim();
    if (!isSafeZipEntry(entry)) continue;
    const dims = (dimCol >= 0 ? cols[dimCol] : '')?.match(/(\d+)\s*x\s*(\d+)/i);
    const fromName = html5SizeFromEntry(entry);
    const width = dims ? Number(dims[1]) : fromName?.width;
    const height = dims ? Number(dims[2]) : fromName?.height;
    if (!width || !height) continue;
    sizes.push({ entry, width, height, label: html5SizeLabel(entry, width, height) });
  }
  return sizes;
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim());
}

/** Sizes inside a Foldwrap HTML5 delivery package. Manifest order, else inner zip names. */
export function listHtml5PackageSizes(packageBuf: Buffer): Html5PackageSize[] {
  const files = readZipFiles(packageBuf);
  const manifest = files.find((file) => file.name.replace(/\\/g, '/').toLowerCase().endsWith('manifest.csv'));
  const fromManifest = manifest ? parseManifest(manifest.data.toString('utf8')) : [];
  if (fromManifest.length > 0) return fromManifest;

  const sizes: Html5PackageSize[] = [];
  for (const file of files) {
    const entry = file.name.split('/').pop() ?? file.name;
    if (!isSafeZipEntry(entry)) continue;
    const size = html5SizeFromEntry(entry);
    if (!size) continue;
    sizes.push({
      entry,
      width: size.width,
      height: size.height,
      label: html5SizeLabel(entry, size.width, size.height),
    });
  }
  return sizes;
}

export function contentTypeForHtml5Path(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.woff')) return 'font/woff';
  return 'application/octet-stream';
}

export function safeHtml5InnerPath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) return null;
  if (normalized.split('/').some((part) => !part || part === '.')) return null;
  return normalized;
}

/** One file inside an inner size zip, or null when the path is not in the package. */
export function readHtml5CreativeFile(
  packageBuf: Buffer,
  entry: string,
  innerPath: string,
): Buffer | null {
  if (!isSafeZipEntry(entry)) return null;
  const path = safeHtml5InnerPath(innerPath);
  if (!path) return null;
  const inner = readZipFile(packageBuf, entry) ?? readZipFileByBasename(packageBuf, entry);
  if (!inner) return null;
  return readZipFile(inner, path);
}

export function readHtml5InnerZip(packageBuf: Buffer, entry: string): Buffer | null {
  if (!isSafeZipEntry(entry)) return null;
  return readZipFile(packageBuf, entry) ?? readZipFileByBasename(packageBuf, entry);
}

function readZipFileByBasename(buf: Buffer, entry: string): Buffer | null {
  const hit = readZipFiles(buf).find((file) => (file.name.split('/').pop() ?? file.name) === entry);
  return hit?.data ?? null;
}

/** So index.html relative images and scripts resolve on our preview route. */
export function injectHtmlBase(html: string, baseHref: string): string {
  const tag = `<base href="${baseHref}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}${tag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (open) => `${open}<head>${tag}</head>`);
  }
  return `<!DOCTYPE html><html><head>${tag}</head><body>${html}</body></html>`;
}

async function downloadDriveBuffer(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );
  const data = res.data as ArrayBuffer | Buffer | Uint8Array;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

export async function loadHtml5PackageBuffer(drive: drive_v3.Drive, driveFileId: string): Promise<Buffer> {
  const now = Date.now();
  const cached = packageCache.get(driveFileId);
  if (cached && now - cached.at < PACKAGE_CACHE_TTL_MS) return cached.buf;
  const buf = await downloadDriveBuffer(drive, driveFileId);
  packageCache.set(driveFileId, { buf, at: now });
  if (packageCache.size > PACKAGE_CACHE_MAX) {
    const oldest = [...packageCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) packageCache.delete(oldest[0]);
  }
  return buf;
}

type NamedFile = { fileId: string; name: string; mimeType: string };

/**
 * Replace each `*_html5_delivery.zip` with one portal file per inner size.
 * The package itself is omitted when it expands. A failed read leaves the zip in place.
 */
export async function expandHtml5DeliveryFiles<T extends NamedFile>(
  drive: drive_v3.Drive,
  files: T[],
): Promise<{ files: T[]; expandedPackageIds: Set<string> }> {
  const out: T[] = [];
  const expandedPackageIds = new Set<string>();
  for (const file of files) {
    if (!isHtml5DeliveryPackageName(file.name)) {
      out.push(file);
      continue;
    }
    try {
      const buf = await loadHtml5PackageBuffer(drive, file.fileId);
      const sizes = listHtml5PackageSizes(buf);
      if (sizes.length === 0) {
        out.push(file);
        continue;
      }
      expandedPackageIds.add(file.fileId);
      for (const size of sizes) {
        const portalFileId = html5PortalFileId(file.fileId, size.entry);
        out.push({
          ...file,
          fileId: portalFileId,
          ...('listedId' in file ? { listedId: portalFileId } : {}),
          name: size.label,
          mimeType: 'application/x-html5-ad',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[html5] could not expand ${file.name}: ${msg}`);
      out.push(file);
    }
  }
  return { files: out, expandedPackageIds };
}
