/**
 * When the browser <video> cannot decode the review proxy (HEVC, ProRes, etc.),
 * transcode to H.264 MP4 in the browser with ffmpeg.wasm.
 * Only imported on the decode-failure path.
 *
 * @see https://ffmpegwasm.netlify.app/
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const MAX_INPUT_BYTES = 100 * 1024 * 1024;
const FFMPEG_CORE = '0.12.10';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getLoadedFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const base = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE}/dist/umd`;
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    } catch (e) {
      loadPromise = null;
      ffmpegInstance = null;
      throw e;
    }
  })();

  return loadPromise;
}

function inputNameFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.mov')) return 'in.mov';
  if (lower.endsWith('.m4v')) return 'in.m4v';
  if (lower.endsWith('.mp4')) return 'in.mp4';
  return 'in.mp4';
}

export type TranscodeProgress =
  | { phase: 'load' }
  | { phase: 'fetch' }
  | { phase: 'run'; progress: number };

/**
 * Transcode review proxy video to a blob: URL. Caller must
 * `URL.revokeObjectURL` when the preview is unmounted.
 */
export async function transcodeReviewVideoToPlayableH264(
  fileUrl: string,
  fileName: string,
  onProgress?: (p: TranscodeProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  onProgress?.({ phase: 'load' });
  const ffmpeg = await getLoadedFfmpeg();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  onProgress?.({ phase: 'fetch' });
  const res = await fetch(fileUrl, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch video (${res.status})`);
  }
  const len = res.headers.get('content-length');
  if (len) {
    const n = parseInt(len, 10);
    if (!Number.isNaN(n) && n > MAX_INPUT_BYTES) {
      throw new Error(
        `File too large for in-browser conversion (${(n / (1024 * 1024)).toFixed(0)} MB; max ${MAX_INPUT_BYTES / (1024 * 1024)} MB). Use Download.`,
      );
    }
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_INPUT_BYTES) {
    throw new Error(
      `File too large for in-browser conversion (max ${MAX_INPUT_BYTES / (1024 * 1024)} MB). Use Download.`,
    );
  }

  const inName = inputNameFromFileName(fileName);
  await ffmpeg.writeFile(inName, buf, { signal });

  const onFfmpegProgress = ({ progress }: { progress: number; time: number }) => {
    onProgress?.({ phase: 'run', progress: Math.min(1, Math.max(0, progress)) });
  };
  ffmpeg.on('progress', onFfmpegProgress);

  const baseVideo: string[] = [
    '-i',
    inName,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '22',
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'high',
    '-movflags',
    '+faststart',
  ];

  const run = async (withAudio: boolean) => {
    onProgress?.({ phase: 'run', progress: 0 });
    const outArgs = withAudio
      ? [...baseVideo, '-c:a', 'aac', '-b:a', '128k', 'out.mp4']
      : [...baseVideo, '-an', 'out.mp4'];
    const code = await ffmpeg.exec(outArgs, undefined, { signal });
    if (code !== 0) {
      throw new Error(`FFmpeg failed (code ${code})`);
    }
  };

  try {
    try {
      await run(true);
    } catch (first) {
      if (signal?.aborted) throw first;
      await ffmpeg.deleteFile('out.mp4', { signal }).catch(() => {});
      await run(false);
    }
  } finally {
    ffmpeg.off('progress', onFfmpegProgress);
  }

  const out = await ffmpeg.readFile('out.mp4', undefined, { signal });
  const u8: Uint8Array = out instanceof Uint8Array
    ? out
    : new Uint8Array(out as unknown as ArrayBuffer);
  await ffmpeg.deleteFile(inName, { signal }).catch(() => {});
  await ffmpeg.deleteFile('out.mp4', { signal }).catch(() => {});

  const blob = new Blob([u8 as BlobPart], { type: 'video/mp4' });
  return URL.createObjectURL(blob);
}

export function isPortalFfmpegTranscodeEnabled(): boolean {
  if (typeof process === 'undefined' || !process.env) return true;
  return process.env.NEXT_PUBLIC_REVIEW_PORTAL_FFMPEG !== '0';
}
