// tests/os/decideRoute.test.ts
// Unit tests for Decide route-based active sub-view detection

import { describe, it, expect } from 'vitest';
import {
  isDecidePhaseRoute,
  getActiveDecideSubViewFromPath,
  getDecideRouteInfo,
  buildDecideSubViewUrl,
} from '@/lib/os/ui/decideRoute';

// ============================================================================
// isDecidePhaseRoute Tests
// ============================================================================

describe('isDecidePhaseRoute', () => {
  it('returns true for /c/[companyId]/decide', () => {
    expect(isDecidePhaseRoute('/c/test-company/decide')).toBe(true);
  });

  it('returns true for /c/[companyId]/decide/', () => {
    expect(isDecidePhaseRoute('/c/test-company/decide/')).toBe(true);
  });

  it('returns true for /c/[companyId]/context', () => {
    expect(isDecidePhaseRoute('/c/test-company/context')).toBe(true);
  });

  it('returns true for /c/[companyId]/context/map', () => {
    expect(isDecidePhaseRoute('/c/test-company/context/map')).toBe(true);
  });

  it('returns true for /c/[companyId]/context/table', () => {
    expect(isDecidePhaseRoute('/c/test-company/context/table')).toBe(true);
  });

  it('returns true for /c/[companyId]/context/fields', () => {
    expect(isDecidePhaseRoute('/c/test-company/context/fields')).toBe(true);
  });

  it('returns true for /c/[companyId]/strategy', () => {
    expect(isDecidePhaseRoute('/c/test-company/strategy')).toBe(true);
  });

  it('returns true for /c/[companyId]/strategy/compare', () => {
    expect(isDecidePhaseRoute('/c/test-company/strategy/compare')).toBe(true);
  });

  it('returns true for /c/[companyId]/readiness', () => {
    expect(isDecidePhaseRoute('/c/test-company/readiness')).toBe(true);
  });

  it('returns false for /c/[companyId]/discover', () => {
    expect(isDecidePhaseRoute('/c/test-company/discover')).toBe(false);
  });

  it('returns false for /c/[companyId]/deliver', () => {
    expect(isDecidePhaseRoute('/c/test-company/deliver')).toBe(false);
  });

  it('returns false for /c/[companyId]/work', () => {
    expect(isDecidePhaseRoute('/c/test-company/work')).toBe(false);
  });

  it('returns false for /companies', () => {
    expect(isDecidePhaseRoute('/companies')).toBe(false);
  });

  it('handles company IDs with special characters', () => {
    expect(isDecidePhaseRoute('/c/rec123ABC/context')).toBe(true);
    expect(isDecidePhaseRoute('/c/company-name-here/strategy')).toBe(true);
  });
});

// ============================================================================
// getActiveDecideSubViewFromPath Tests
// ============================================================================

describe('getActiveDecideSubViewFromPath', () => {
  describe('pathname-based detection', () => {
    it('returns "context" for /c/[companyId]/context', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/context')).toBe('context');
    });

    it('returns "context" for /c/[companyId]/context/map', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/context/map')).toBe('context');
    });

    it('returns "context" for /c/[companyId]/context/table', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/context/table')).toBe('context');
    });

    it('returns "context" for /c/[companyId]/context/fields', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/context/fields')).toBe('context');
    });

    it('returns "strategy" for /c/[companyId]/strategy', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/strategy')).toBe('strategy');
    });

    it('returns "strategy" for /c/[companyId]/strategy/compare', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/strategy/compare')).toBe('strategy');
    });

    it('returns "review" for /c/[companyId]/readiness', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/readiness')).toBe('review');
    });

    it('returns "context" for /c/[companyId]/decide (default)', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/decide')).toBe('context');
    });
  });

  describe('hash-based detection', () => {
    it('returns "context" for #context hash', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/decide', '#context')).toBe('context');
    });

    it('returns "strategy" for #strategy hash', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/decide', '#strategy')).toBe('strategy');
    });

    it('returns "review" for #review hash', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/decide', '#review')).toBe('review');
    });

    it('handles uppercase hash values', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/decide', '#CONTEXT')).toBe('context');
      expect(getActiveDecideSubViewFromPath('/c/test-company/decide', '#STRATEGY')).toBe('strategy');
      expect(getActiveDecideSubViewFromPath('/c/test-company/decide', '#REVIEW')).toBe('review');
    });

    it('hash takes precedence over pathname', () => {
      // On /context page with #strategy hash
      expect(getActiveDecideSubViewFromPath('/c/test-company/context', '#strategy')).toBe('strategy');
      // On /strategy page with #review hash
      expect(getActiveDecideSubViewFromPath('/c/test-company/strategy', '#review')).toBe('review');
    });

    it('ignores invalid hash values', () => {
      expect(getActiveDecideSubViewFromPath('/c/test-company/context', '#invalid')).toBe('context');
      expect(getActiveDecideSubViewFromPath('/c/test-company/strategy', '#foo')).toBe('strategy');
    });
  });
});

// ============================================================================
// getDecideRouteInfo Tests
// ============================================================================

describe('getDecideRouteInfo', () => {
  it('returns correct info for context page', () => {
    const info = getDecideRouteInfo('/c/test-company/context');
    expect(info).toEqual({
      isDecidePage: true,
      activeSubView: 'context',
    });
  });

  it('returns correct info for strategy page', () => {
    const info = getDecideRouteInfo('/c/test-company/strategy');
    expect(info).toEqual({
      isDecidePage: true,
      activeSubView: 'strategy',
    });
  });

  it('returns correct info for decide page with review hash', () => {
    const info = getDecideRouteInfo('/c/test-company/decide', '#review');
    expect(info).toEqual({
      isDecidePage: true,
      activeSubView: 'review',
    });
  });

  it('returns correct info for non-Decide page', () => {
    const info = getDecideRouteInfo('/c/test-company/deliver');
    expect(info).toEqual({
      isDecidePage: false,
      activeSubView: 'context', // Falls back to context
    });
  });

  it('handles readiness page as review sub-view', () => {
    const info = getDecideRouteInfo('/c/test-company/readiness');
    expect(info).toEqual({
      isDecidePage: true,
      activeSubView: 'review',
    });
  });
});

// ============================================================================
// buildDecideSubViewUrl Tests
// ============================================================================

describe('buildDecideSubViewUrl', () => {
  it('builds correct URL for context sub-view', () => {
    expect(buildDecideSubViewUrl('test-company', 'context')).toBe('/c/test-company/context');
  });

  it('builds correct URL for strategy sub-view', () => {
    expect(buildDecideSubViewUrl('test-company', 'strategy')).toBe('/c/test-company/strategy');
  });

  it('builds correct URL for review sub-view', () => {
    expect(buildDecideSubViewUrl('test-company', 'review')).toBe('/c/test-company/decide#review');
  });

  it('handles special characters in company ID', () => {
    expect(buildDecideSubViewUrl('rec123ABC', 'context')).toBe('/c/rec123ABC/context');
    expect(buildDecideSubViewUrl('company-name', 'strategy')).toBe('/c/company-name/strategy');
  });
});
