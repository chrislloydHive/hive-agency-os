// lib/google/calendarDayBounds.ts
// Wall-calendar "today" bounds in an IANA timezone using Intl only (no extra deps).

/** Numeric key YYYYMMDD for comparing calendar dates in a timezone. */
export function localDateKeyInTimeZone(ms: number, timeZone: string): number {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const y = +p.find((x) => x.type === 'year')!.value;
  const m = +p.find((x) => x.type === 'month')!.value;
  const d = +p.find((x) => x.type === 'day')!.value;
  return y * 10000 + m * 100 + d;
}

export function wallClockYmdInTimeZone(now: Date, timeZone: string): { y: number; m: number; d: number } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return {
    y: +p.find((x) => x.type === 'year')!.value,
    m: +p.find((x) => x.type === 'month')!.value,
    d: +p.find((x) => x.type === 'day')!.value,
  };
}

/**
 * UTC epoch ms of the first instant of calendar day (y,m,d) in `timeZone`
 * (local midnight).
 */
export function zonedWallDayStartUtcMs(y: number, m: number, d: number, timeZone: string): number {
  const want = y * 10000 + m * 100 + d;
  let lo = Date.UTC(y, m - 1, d, 0, 0, 0) - 48 * 3600 * 1000;
  let hi = Date.UTC(y, m - 1, d, 0, 0, 0) + 48 * 3600 * 1000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDateKeyInTimeZone(mid, timeZone) >= want) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Next calendar date after (y,m,d) as it appears in `timeZone` (DST-safe). */
export function nextWallCalendarYmd(
  y: number,
  m: number,
  d: number,
  timeZone: string,
): { y: number; m: number; d: number } {
  const start = zonedWallDayStartUtcMs(y, m, d, timeZone);
  let t = start + 12 * 3600 * 1000;
  for (let i = 0; i < 48; i++) {
    const k = wallClockYmdInTimeZone(new Date(t), timeZone);
    if (k.y !== y || k.m !== m || k.d !== d) return k;
    t += 3600 * 1000;
  }
  throw new Error(`Failed to find next calendar day after ${y}-${m}-${d} in ${timeZone}`);
}

/** [startMs, endMs) = [today 00:00, tomorrow 00:00) in `timeZone`, as UTC instants. */
export function getTodayRangeUtcMs(now: Date, timeZone: string): { startMs: number; endMs: number } {
  const { y, m, d } = wallClockYmdInTimeZone(now, timeZone);
  const startMs = zonedWallDayStartUtcMs(y, m, d, timeZone);
  const n = nextWallCalendarYmd(y, m, d, timeZone);
  const endMs = zonedWallDayStartUtcMs(n.y, n.m, n.d, timeZone);
  return { startMs, endMs };
}
