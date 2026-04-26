import { describe, it, expect } from 'vitest';
import {
  getTodayRangeUtcMs,
  localDateKeyInTimeZone,
  zonedWallDayStartUtcMs,
} from '@/lib/google/calendarDayBounds';

describe('calendarDayBounds', () => {
  const la = 'America/Los_Angeles';

  it('zonedWallDayStartUtcMs is stable for a fixed calendar day', () => {
    const ms = zonedWallDayStartUtcMs(2026, 6, 15, la);
    expect(localDateKeyInTimeZone(ms, la)).toBe(20260615);
    expect(localDateKeyInTimeZone(ms - 1, la)).toBeLessThan(20260615);
  });

  it('getTodayRangeUtcMs returns a same-day window under 26h', () => {
    const anchor = new Date('2026-03-15T12:00:00Z');
    const { startMs, endMs } = getTodayRangeUtcMs(anchor, la);
    expect(endMs).toBeGreaterThan(startMs);
    expect(endMs - startMs).toBeGreaterThan(22 * 3600 * 1000);
    expect(endMs - startMs).toBeLessThan(26 * 3600 * 1000);
    expect(localDateKeyInTimeZone(startMs, la)).toBe(localDateKeyInTimeZone(anchor.getTime(), la));
    expect(localDateKeyInTimeZone(endMs, la)).toBeGreaterThan(localDateKeyInTimeZone(startMs, la));
  });
});
