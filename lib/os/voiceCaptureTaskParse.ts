/** Shared with POST /api/os/voice-capture — kept out of route.ts because Next.js
 *  route modules may only export route handlers and route segment config. */

export const VOICE_CAPTURE_LA_TZ = 'America/Los_Angeles';

function laDateContext(ref = new Date()): { ymd: string; weekday: string } {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: VOICE_CAPTURE_LA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: VOICE_CAPTURE_LA_TZ,
    weekday: 'long',
  }).format(ref);
  return { ymd, weekday };
}

/** Prepended to the transcript so relative dates anchor to LA local "today". */
export function buildVoiceCaptureUserContent(transcript: string, ref = new Date()): string {
  const { ymd, weekday } = laDateContext(ref);
  return `Today is ${ymd} (${VOICE_CAPTURE_LA_TZ}, ${weekday}).\n\n${transcript.trim()}`;
}

function isValidYmd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** If the model returned a non-ISO or impossible date, treat as missing. */
export function coerceVoiceCaptureDue(due: string | null): string | null {
  if (due === null) return null;
  const s = due.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !isValidYmd(s)) return null;
  return s;
}
