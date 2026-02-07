// tests/review/reviewVariantDetection.test.ts
// Regression: Retargeting assets must be discovered; variant from path/folder name.

import { describe, it, expect } from 'vitest';
import { detectVariantFromPath } from '@/lib/review/reviewVariantDetection';

describe('detectVariantFromPath', () => {
  it('returns Prospecting for Prospecting folder or path ending in Prospecting', () => {
    expect(detectVariantFromPath('Prospecting')).toBe('Prospecting');
    expect(detectVariantFromPath('prospecting')).toBe('Prospecting');
    expect(detectVariantFromPath('/job/Display/Prospecting')).toBe('Prospecting');
  });

  it('returns Retargeting for Retargeting folder or path ending in Retargeting', () => {
    expect(detectVariantFromPath('Retargeting')).toBe('Retargeting');
    expect(detectVariantFromPath('retargeting')).toBe('Retargeting');
    expect(detectVariantFromPath('/job/Display/Retargeting')).toBe('Retargeting');
  });

  it('returns Retargeting for Remarketing (alias)', () => {
    expect(detectVariantFromPath('Remarketing')).toBe('Retargeting');
    expect(detectVariantFromPath('remarketing')).toBe('Retargeting');
    expect(detectVariantFromPath('/job/Social/Remarketing')).toBe('Retargeting');
  });

  it('returns Retargeting for RTG (alias)', () => {
    expect(detectVariantFromPath('RTG')).toBe('Retargeting');
    expect(detectVariantFromPath('rtg')).toBe('Retargeting');
    expect(detectVariantFromPath('.../Display/RTG')).toBe('Retargeting');
  });

  it('returns Retargeting for Re-targeting (alias)', () => {
    expect(detectVariantFromPath('Re-targeting')).toBe('Retargeting');
    expect(detectVariantFromPath('Re targeting')).toBe('Retargeting');
  });

  it('returns null for unknown folder name (regression: previously failed)', () => {
    expect(detectVariantFromPath('Default')).toBeNull();
    expect(detectVariantFromPath('Set A')).toBeNull();
    expect(detectVariantFromPath('')).toBeNull();
    expect(detectVariantFromPath('   ')).toBeNull();
  });

  it('uses last path segment when path contains slashes or backslashes', () => {
    expect(detectVariantFromPath('/job/Display/Retargeting')).toBe('Retargeting');
    expect(detectVariantFromPath('Client Review/229CAR/Display/Prospecting')).toBe('Prospecting');
    expect(detectVariantFromPath('Audio\\Remarketing')).toBe('Retargeting');
  });
});
