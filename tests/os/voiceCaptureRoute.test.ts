import { describe, expect, test } from 'vitest';
import {
  buildVoiceCaptureUserContent,
  coerceVoiceCaptureDue,
} from '@/app/api/os/voice-capture/route';

describe('voice-capture date helpers', () => {
  test('prepends LA date and weekday before transcript', () => {
    // 2026-04-26 is a Sunday UTC; still assert shape from LA wall clock.
    const ref = new Date('2026-04-26T12:00:00Z');
    const out = buildVoiceCaptureUserContent('Email Adam tomorrow about the install', ref);
    expect(out).toMatch(/^Today is \d{4}-\d{2}-\d{2} \(America\/Los_Angeles, \w+\)\.\n\n/);
    expect(out).toContain('Email Adam tomorrow about the install');
  });

  test('coerceVoiceCaptureDue accepts valid YYYY-MM-DD and rejects bad values', () => {
    expect(coerceVoiceCaptureDue('2028-06-15')).toBe('2028-06-15');
    expect(coerceVoiceCaptureDue(null)).toBe(null);
    expect(coerceVoiceCaptureDue('')).toBe(null);
    expect(coerceVoiceCaptureDue('2026-02-30')).toBe(null);
    expect(coerceVoiceCaptureDue('not-a-date')).toBe(null);
    expect(coerceVoiceCaptureDue('26-04-2026')).toBe(null);
  });
});
