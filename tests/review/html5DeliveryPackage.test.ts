import { describe, expect, it } from 'vitest';

import { listHtml5PackageSizes, preparePortalHtml, readHtml5CreativeFile, readHtml5InnerZip } from '@/lib/review/html5DeliveryPackage';
import {
  html5DownloadUrl,
  html5PortalFileId,
  html5PreviewUrl,
  html5SizeFromEntry,
  isHtml5DeliveryPackageName,
  parseHtml5PortalFileId,
} from '@/lib/review/html5PortalIds';
import { zipFromFiles } from '@/lib/review/zipBytes';

function samplePackage(): Buffer {
  const inner = zipFromFiles([
    { name: 'index.html', data: Buffer.from('<html><head></head><body><img src="bg.jpg"></body></html>') },
    { name: 'bg.jpg', data: Buffer.from('jpeg-bytes') },
  ]);
  const manifest = [
    'Creative,Dimensions,Platform,ZIP file,ZIP bytes,Status,Files in ZIP,Issues,Notes',
    'gifts_300x250_google_ad_manager,300x250,Google Ad Manager,gifts_300x250_google_ad_manager.zip,10,warning,2,,',
    'gifts_728x90_google_ad_manager,728x90,Google Ad Manager,gifts_728x90_google_ad_manager.zip,11,warning,2,,',
  ].join('\n');
  const wide = zipFromFiles([{ name: 'index.html', data: Buffer.from('<html></html>') }]);
  return zipFromFiles([
    { name: 'gifts_300x250_google_ad_manager.zip', data: inner },
    { name: 'gifts_728x90_google_ad_manager.zip', data: wide },
    { name: 'INSTRUCTIONS/manifest.csv', data: Buffer.from(manifest) },
    { name: 'INSTRUCTIONS/README.txt', data: Buffer.from('keep the inner zip intact') },
  ]);
}

describe('html5 delivery packages', () => {
  it('recognizes Foldwrap delivery zips and not size zips', () => {
    expect(isHtml5DeliveryPackageName("321CAR-Prospecting-gifts_html5_delivery.zip")).toBe(true);
    expect(isHtml5DeliveryPackageName('gifts_300x250_google_ad_manager.zip')).toBe(false);
  });

  it('lists each size from the manifest and can read a file inside it', () => {
    const pkg = samplePackage();
    const sizes = listHtml5PackageSizes(pkg);
    expect(sizes.map((size) => size.label)).toEqual(['gifts · 300×250', 'gifts · 728×90']);

    const html = readHtml5CreativeFile(pkg, sizes[0].entry, 'index.html');
    expect(html?.toString('utf8')).toContain('bg.jpg');
    expect(readHtml5CreativeFile(pkg, sizes[0].entry, '../secret.txt')).toBeNull();
    expect(readHtml5InnerZip(pkg, sizes[1].entry)?.length).toBeGreaterThan(0);
  });

  it('round-trips the portal file id into preview and download URLs', () => {
    const id = html5PortalFileId('drive123', 'gifts_300x250_google_ad_manager.zip');
    expect(parseHtml5PortalFileId(id)).toEqual({
      driveFileId: 'drive123',
      entry: 'gifts_300x250_google_ad_manager.zip',
    });
    expect(html5PreviewUrl('abc', id)).toBe(
      '/api/review/html5/abc/drive123/gifts_300x250_google_ad_manager.zip/index.html',
    );
    expect(html5DownloadUrl('abc', id)).toBe(
      '/api/review/html5/abc/drive123/gifts_300x250_google_ad_manager.zip?dl=1',
    );
    expect(parseHtml5PortalFileId('drive123')).toBeNull();
    expect(html5SizeFromEntry('gifts_300x250_google_ad_manager.zip')).toEqual({ width: 300, height: 250 });
    expect(html5SizeFromEntry('tis_the_season160x600_google_ad_manager.zip')).toEqual({
      width: 160,
      height: 600,
    });
  });

  it('serves GSAP from our site and shows the ad if that script is blocked', () => {
    const html = preparePortalHtml(
      '<html><head></head><body><script src="https://s0.2mdn.net/ads/studio/cached_libs/gsap_3.11.5_min.js"></script><div id="foldwrap_container" style="display: none"></div></body></html>',
      '/api/review/html5/tok/file/size.zip/',
    );
    expect(html).toContain('<base href="/api/review/html5/tok/file/size.zip/">');
    expect(html).toContain('src="/review/gsap-3.11.5.min.js"');
    expect(html).not.toContain('2mdn.net');
    expect(html).toContain('display:block');
    expect(html).not.toContain('display: none');
  });
});
