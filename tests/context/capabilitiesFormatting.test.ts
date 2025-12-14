/**
 * @fileoverview Tests for Hive Capabilities formatting for AI prompts
 *
 * Validates that:
 * - Only enabled capabilities are included
 * - Formatting is compact and bounded
 * - Deliverables and constraints are truncated properly
 */

import { describe, expect, it } from 'vitest';
import { formatCapabilitiesForPrompt } from '@/lib/contextGraph/forAi';
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_KEYS,
  type CapabilitiesDomain,
  type Capability,
} from '@/lib/contextGraph/domains/capabilities';

// Helper to create a test capability
function createCapability(
  enabled: boolean,
  strength: 'basic' | 'strong' | 'elite' = 'basic',
  deliverables: string[] = [],
  constraints: string[] = []
): Capability {
  return {
    enabled: { value: enabled, provenance: [] },
    strength: { value: strength, provenance: [] },
    deliverables: { value: deliverables, provenance: [] },
    constraints: { value: constraints, provenance: [] },
  };
}

// Helper to create empty capabilities domain
function createEmptyCapabilities(): CapabilitiesDomain {
  const capabilities: Record<string, Record<string, Capability>> = {};

  for (const category of CAPABILITY_CATEGORIES) {
    capabilities[category] = {};
    for (const key of CAPABILITY_KEYS[category]) {
      capabilities[category][key] = createCapability(false);
    }
  }

  return capabilities as unknown as CapabilitiesDomain;
}

describe('formatCapabilitiesForPrompt', () => {
  it('should return empty string when no capabilities are enabled', () => {
    const capabilities = createEmptyCapabilities();
    const result = formatCapabilitiesForPrompt(capabilities);
    expect(result).toBe('');
  });

  it('should return empty string for undefined capabilities', () => {
    const result = formatCapabilitiesForPrompt(undefined);
    expect(result).toBe('');
  });

  it('should include only enabled capabilities', () => {
    const capabilities = createEmptyCapabilities();

    // Enable one capability
    (capabilities.paidMedia as Record<string, Capability>).search = createCapability(
      true,
      'strong',
      ['Campaign setup', 'Keyword research']
    );

    const result = formatCapabilitiesForPrompt(capabilities);

    expect(result).toContain('## Hive Capabilities');
    expect(result).toContain('Search (Google/Bing)');
    expect(result).toContain('(strong)');
    expect(result).toContain('Campaign setup');
  });

  it('should organize by category', () => {
    const capabilities = createEmptyCapabilities();

    // Enable capabilities in different categories
    (capabilities.paidMedia as Record<string, Capability>).search = createCapability(true);
    (capabilities.seo as Record<string, Capability>).technicalSeo = createCapability(true);

    const result = formatCapabilitiesForPrompt(capabilities);

    expect(result).toContain('### SEO');
    expect(result).toContain('### Paid Media');
  });

  it('should show strength level', () => {
    const capabilities = createEmptyCapabilities();

    (capabilities.strategy as Record<string, Capability>).growthStrategy = createCapability(
      true,
      'elite'
    );

    const result = formatCapabilitiesForPrompt(capabilities);

    expect(result).toContain('(elite)');
  });

  it('should truncate deliverables to first 3', () => {
    const capabilities = createEmptyCapabilities();

    const manyDeliverables = [
      'Deliverable 1',
      'Deliverable 2',
      'Deliverable 3',
      'Deliverable 4',
      'Deliverable 5',
    ];

    (capabilities.web as Record<string, Capability>).webDesignBuild = createCapability(
      true,
      'strong',
      manyDeliverables
    );

    const result = formatCapabilitiesForPrompt(capabilities);

    expect(result).toContain('Deliverable 1');
    expect(result).toContain('Deliverable 2');
    expect(result).toContain('Deliverable 3');
    expect(result).toContain('+2 more');
    expect(result).not.toContain('Deliverable 4');
  });

  it('should show constraints as warnings', () => {
    const capabilities = createEmptyCapabilities();

    (capabilities.paidMedia as Record<string, Capability>).retargeting = createCapability(
      true,
      'basic',
      ['Pixel setup'],
      ['Requires 1000+ monthly visitors']
    );

    const result = formatCapabilitiesForPrompt(capabilities);

    expect(result).toContain('Requires 1000+ monthly visitors');
  });

  it('should truncate constraints to first 2', () => {
    const capabilities = createEmptyCapabilities();

    const manyConstraints = [
      'Constraint 1',
      'Constraint 2',
      'Constraint 3',
    ];

    (capabilities.analytics as Record<string, Capability>).experimentation = createCapability(
      true,
      'basic',
      [],
      manyConstraints
    );

    const result = formatCapabilitiesForPrompt(capabilities);

    expect(result).toContain('Constraint 1');
    expect(result).toContain('Constraint 2');
    expect(result).not.toContain('Constraint 3');
  });

  it('should include header and intro text', () => {
    const capabilities = createEmptyCapabilities();
    (capabilities.strategy as Record<string, Capability>).growthStrategy = createCapability(true);

    const result = formatCapabilitiesForPrompt(capabilities);

    expect(result).toContain('## Hive Capabilities');
    expect(result).toContain('Services available from Hive');
  });
});

describe('Capabilities Categories', () => {
  it('should have all expected categories', () => {
    expect(CAPABILITY_CATEGORIES).toContain('strategy');
    expect(CAPABILITY_CATEGORIES).toContain('web');
    expect(CAPABILITY_CATEGORIES).toContain('contentCreative');
    expect(CAPABILITY_CATEGORIES).toContain('seo');
    expect(CAPABILITY_CATEGORIES).toContain('paidMedia');
    expect(CAPABILITY_CATEGORIES).toContain('analytics');
  });

  it('should have capability keys for each category', () => {
    for (const category of CAPABILITY_CATEGORIES) {
      const keys = CAPABILITY_KEYS[category];
      expect(keys).toBeDefined();
      expect(keys.length).toBeGreaterThan(0);
    }
  });
});
