/**
 * @fileoverview Tests for domain visibility configuration
 *
 * Validates that:
 * - All domains have a visibility level
 * - Core domains include SRM-critical fields
 * - Hidden domains include non-user-facing data
 * - Visibility helpers work correctly
 */

import { describe, expect, it } from 'vitest';
import { DOMAIN_NAMES } from '@/lib/contextGraph/companyContextGraph';
import {
  DOMAIN_VISIBILITY,
  getCoreDomains,
  getAdvancedDomains,
  getHiddenDomains,
  getDomainVisibility,
  isDomainVisible,
  getDomainLabel,
  getDomainDescription,
} from '@/lib/contextGraph/visibility';

describe('Domain Visibility Configuration', () => {
  it('should have visibility configured for all domains', () => {
    for (const domain of DOMAIN_NAMES) {
      const visibility = DOMAIN_VISIBILITY[domain];
      expect(visibility).toBeDefined();
      expect(['core', 'advanced', 'hidden']).toContain(visibility);
    }
  });

  it('should have all domains accounted for in visibility levels', () => {
    const core = getCoreDomains();
    const advanced = getAdvancedDomains();
    const hidden = getHiddenDomains();

    const allVisibleDomains = [...core, ...advanced, ...hidden];

    // Every domain should be in exactly one category
    expect(allVisibleDomains.length).toBe(DOMAIN_NAMES.length);

    for (const domain of DOMAIN_NAMES) {
      expect(allVisibleDomains).toContain(domain);
    }
  });

  it('should include strategy-critical domains as core', () => {
    const core = getCoreDomains();

    // These are SRM-required domains
    expect(core).toContain('identity');
    expect(core).toContain('audience');
    expect(core).toContain('objectives');
    expect(core).toContain('brand');
    expect(core).toContain('productOffer');
    expect(core).toContain('competitive');
  });

  it('should hide lab/diagnostic domains', () => {
    const hidden = getHiddenDomains();

    // Lab-generated data should be hidden
    expect(hidden).toContain('digitalInfra');
    expect(hidden).toContain('historical');
    expect(hidden).toContain('historyRefs');
    expect(hidden).toContain('storeRisk');

    // Capabilities is Hive Brain only
    expect(hidden).toContain('capabilities');
  });

  it('should include power-user domains as advanced', () => {
    const advanced = getAdvancedDomains();

    expect(advanced).toContain('budgetOps');
    expect(advanced).toContain('performanceMedia');
    expect(advanced).toContain('website');
    expect(advanced).toContain('ops');
  });
});

describe('Visibility Helper Functions', () => {
  it('getDomainVisibility should return correct level', () => {
    expect(getDomainVisibility('identity')).toBe('core');
    expect(getDomainVisibility('budgetOps')).toBe('advanced');
    expect(getDomainVisibility('capabilities')).toBe('hidden');
  });

  it('isDomainVisible should check visibility correctly', () => {
    // Core domain visible at core level
    expect(isDomainVisible('identity', 'core')).toBe(true);

    // Core domain visible at advanced level
    expect(isDomainVisible('identity', 'advanced')).toBe(true);

    // Advanced domain NOT visible at core level
    expect(isDomainVisible('budgetOps', 'core')).toBe(false);

    // Advanced domain visible at advanced level
    expect(isDomainVisible('budgetOps', 'advanced')).toBe(true);

    // Hidden domain visible at hidden level
    expect(isDomainVisible('capabilities', 'hidden')).toBe(true);

    // Hidden domain NOT visible at advanced level
    expect(isDomainVisible('capabilities', 'advanced')).toBe(false);
  });

  it('getDomainLabel should return human-readable labels', () => {
    expect(getDomainLabel('identity')).toBe('Company Identity');
    expect(getDomainLabel('audience')).toBe('Audience & ICP');
    expect(getDomainLabel('capabilities')).toBe('Hive Capabilities');
  });

  it('getDomainDescription should return descriptions', () => {
    expect(getDomainDescription('identity')).toBeTruthy();
    expect(getDomainDescription('audience')).toBeTruthy();
    expect(getDomainDescription('capabilities')).toBeTruthy();
  });
});

describe('Visibility Stability', () => {
  it('should not change core domains without careful consideration', () => {
    // Core domains are used for SRM and affect strategy generation
    // Changes here should be intentional
    const core = getCoreDomains();

    // Minimum expected core domains
    const expectedCore = [
      'identity',
      'audience',
      'productOffer',
      'objectives',
      'brand',
      'competitive',
      'operationalConstraints',
    ];

    for (const domain of expectedCore) {
      expect(core).toContain(domain);
    }
  });
});
