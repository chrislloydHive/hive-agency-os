/**
 * Tests for Bundle Instantiation
 *
 * Covers:
 * - Creates one program per domain
 * - Stable IDs and idempotency
 * - No duplicates on repeated calls
 * - Deliverable generation with correct due dates from cadence
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  BundleInstantiationRequest,
  ProgramDomain,
  IntensityLevel,
} from '@/lib/types/programTemplate';
import {
  generateBundleKey,
  generateBundleProgramKey,
} from '@/lib/types/programTemplate';
import { validateBundleRequest } from '@/lib/os/planning/bundleInstantiation';
import {
  getDomainTemplate,
  getIntensityConfig,
  getMaxConcurrentWork,
  getAllowedWorkstreams,
  getBundleDomains,
  calculateOutputCount,
  DOMAIN_TEMPLATES,
} from '@/lib/os/planning/domainTemplates';

// ============================================================================
// Bundle Key Generation Tests
// ============================================================================

describe('Bundle Key Generation', () => {
  it('generates stable bundle key from company and bundle ID', () => {
    const key1 = generateBundleKey('company_123', 'local-demand-engine');
    const key2 = generateBundleKey('company_123', 'local-demand-engine');

    expect(key1).toBe(key2);
    expect(key1).toBe('bundle::company_123::local-demand-engine');
  });

  it('generates different keys for different companies', () => {
    const key1 = generateBundleKey('company_123', 'local-demand-engine');
    const key2 = generateBundleKey('company_456', 'local-demand-engine');

    expect(key1).not.toBe(key2);
  });

  it('generates stable program key within bundle', () => {
    const key1 = generateBundleProgramKey('local-demand-engine', 'Strategy');
    const key2 = generateBundleProgramKey('local-demand-engine', 'Strategy');

    expect(key1).toBe(key2);
    expect(key1).toBe('local-demand-engine::strategy');
  });

  it('generates different program keys for different domains', () => {
    const strategyKey = generateBundleProgramKey('bundle-1', 'Strategy');
    const creativeKey = generateBundleProgramKey('bundle-1', 'Creative');

    expect(strategyKey).not.toBe(creativeKey);
  });
});

// ============================================================================
// Bundle Request Validation Tests
// ============================================================================

describe('Bundle Request Validation', () => {
  const validRequest: BundleInstantiationRequest = {
    bundleId: 'local-demand-engine-standard',
    domains: ['Strategy', 'Creative', 'Media'],
    intensity: 'Standard',
    startDate: '2025-01-15',
    companyId: 'company_123',
    strategyId: 'strategy_abc',
  };

  it('validates a complete request successfully', () => {
    const result = validateBundleRequest(validRequest);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects request without bundleId', () => {
    const result = validateBundleRequest({
      ...validRequest,
      bundleId: '',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Bundle ID is required');
  });

  it('rejects request without domains', () => {
    const result = validateBundleRequest({
      ...validRequest,
      domains: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one domain is required');
  });

  it('rejects request without intensity', () => {
    const result = validateBundleRequest({
      ...validRequest,
      intensity: '' as IntensityLevel,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Intensity level is required');
  });

  it('rejects request with invalid date', () => {
    const result = validateBundleRequest({
      ...validRequest,
      startDate: 'not-a-date',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Start date must be a valid ISO date string');
  });

  it('rejects request without companyId', () => {
    const result = validateBundleRequest({
      ...validRequest,
      companyId: '',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Company ID is required');
  });

  it('rejects request without strategyId', () => {
    const result = validateBundleRequest({
      ...validRequest,
      strategyId: '',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Strategy ID is required');
  });

  it('collects multiple validation errors', () => {
    const result = validateBundleRequest({
      bundleId: '',
      domains: [],
      intensity: '' as IntensityLevel,
      startDate: '',
      companyId: '',
      strategyId: '',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(3);
  });
});

// ============================================================================
// Domain Template Tests
// ============================================================================

describe('Domain Templates', () => {
  const allDomains: ProgramDomain[] = [
    'Strategy',
    'Creative',
    'Media',
    'LocalVisibility',
    'Analytics',
    'Operations',
  ];

  it('has templates for all 6 domains', () => {
    for (const domain of allDomains) {
      const template = getDomainTemplate(domain);
      expect(template).toBeDefined();
      expect(template.domain).toBe(domain);
    }
  });

  it('each template has all three intensity levels', () => {
    for (const domain of allDomains) {
      const template = getDomainTemplate(domain);

      expect(template.intensityLevels.Core).toBeDefined();
      expect(template.intensityLevels.Standard).toBeDefined();
      expect(template.intensityLevels.Aggressive).toBeDefined();
    }
  });

  it('each template has expected outputs', () => {
    for (const domain of allDomains) {
      const template = getDomainTemplate(domain);
      expect(template.expectedOutputs.length).toBeGreaterThan(0);
    }
  });

  it('each template has success signals', () => {
    for (const domain of allDomains) {
      const template = getDomainTemplate(domain);
      expect(template.successSignals.length).toBeGreaterThan(0);
    }
  });

  it('each template has allowed work types', () => {
    for (const domain of allDomains) {
      const template = getDomainTemplate(domain);
      expect(template.allowedWorkTypes.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Intensity Configuration Tests
// ============================================================================

describe('Intensity Configuration', () => {
  it('Core intensity has lower output multiplier', () => {
    const config = getIntensityConfig('Strategy', 'Core');
    expect(config.outputMultiplier).toBeLessThan(1.0);
  });

  it('Standard intensity has 1.0 output multiplier', () => {
    const config = getIntensityConfig('Strategy', 'Standard');
    expect(config.outputMultiplier).toBe(1.0);
  });

  it('Aggressive intensity has higher output multiplier', () => {
    const config = getIntensityConfig('Strategy', 'Aggressive');
    expect(config.outputMultiplier).toBeGreaterThan(1.0);
  });

  it('Core has no experimentation budget', () => {
    const config = getIntensityConfig('Media', 'Core');
    expect(config.experimentationBudget).toBe('none');
  });

  it('Aggressive has full experimentation budget', () => {
    const config = getIntensityConfig('Media', 'Aggressive');
    expect(config.experimentationBudget).toBe('full');
  });

  it('max concurrent work increases with intensity', () => {
    const core = getMaxConcurrentWork('Creative', 'Core');
    const standard = getMaxConcurrentWork('Creative', 'Standard');
    const aggressive = getMaxConcurrentWork('Creative', 'Aggressive');

    expect(core).toBeLessThan(standard);
    expect(standard).toBeLessThan(aggressive);
  });
});

// ============================================================================
// Workstream Mapping Tests
// ============================================================================

describe('Workstream Mapping', () => {
  it('Strategy domain maps to ops and analytics', () => {
    const workstreams = getAllowedWorkstreams('Strategy');
    expect(workstreams).toContain('ops');
    expect(workstreams).toContain('analytics');
  });

  it('Creative domain maps to content, brand, and social', () => {
    const workstreams = getAllowedWorkstreams('Creative');
    expect(workstreams).toContain('content');
    expect(workstreams).toContain('brand');
    expect(workstreams).toContain('social');
  });

  it('Media domain maps to paid_media', () => {
    const workstreams = getAllowedWorkstreams('Media');
    expect(workstreams).toContain('paid_media');
  });

  it('LocalVisibility domain maps to seo and partnerships', () => {
    const workstreams = getAllowedWorkstreams('LocalVisibility');
    expect(workstreams).toContain('seo');
    expect(workstreams).toContain('partnerships');
  });

  it('Analytics domain maps to analytics', () => {
    const workstreams = getAllowedWorkstreams('Analytics');
    expect(workstreams).toContain('analytics');
  });

  it('Operations domain maps to ops', () => {
    const workstreams = getAllowedWorkstreams('Operations');
    expect(workstreams).toContain('ops');
  });
});

// ============================================================================
// Bundle Domain Helpers Tests
// ============================================================================

describe('Bundle Domain Helpers', () => {
  it('local-demand-engine includes all 6 domains', () => {
    const domains = getBundleDomains('local-demand-engine');
    expect(domains).toHaveLength(6);
    expect(domains).toContain('Strategy');
    expect(domains).toContain('Creative');
    expect(domains).toContain('Media');
    expect(domains).toContain('LocalVisibility');
    expect(domains).toContain('Analytics');
    expect(domains).toContain('Operations');
  });

  it('digital-foundation includes 4 domains', () => {
    const domains = getBundleDomains('digital-foundation');
    expect(domains).toHaveLength(4);
    expect(domains).toContain('Strategy');
    expect(domains).toContain('Creative');
    expect(domains).toContain('Analytics');
    expect(domains).toContain('Operations');
  });

  it('media-accelerator includes 4 domains with Media', () => {
    const domains = getBundleDomains('media-accelerator');
    expect(domains).toHaveLength(4);
    expect(domains).toContain('Strategy');
    expect(domains).toContain('Media');
    expect(domains).toContain('Analytics');
    expect(domains).toContain('Operations');
  });

  it('unknown bundle type returns default domains', () => {
    const domains = getBundleDomains('unknown-bundle');
    expect(domains).toHaveLength(6);
  });
});

// ============================================================================
// Output Count Calculation Tests
// ============================================================================

describe('Output Count Calculation', () => {
  it('Core intensity reduces output count', () => {
    const count = calculateOutputCount(10, 'Core');
    expect(count).toBeLessThan(10);
    expect(count).toBe(6); // 10 * 0.6 = 6
  });

  it('Standard intensity maintains output count', () => {
    const count = calculateOutputCount(10, 'Standard');
    expect(count).toBe(10);
  });

  it('Aggressive intensity increases output count', () => {
    const count = calculateOutputCount(10, 'Aggressive');
    expect(count).toBeGreaterThan(10);
    expect(count).toBe(15); // 10 * 1.5 = 15
  });

  it('rounds up partial counts', () => {
    const count = calculateOutputCount(5, 'Core');
    expect(count).toBe(3); // 5 * 0.6 = 3.0
  });
});

// ============================================================================
// Deliverable Due Date Tests
// ============================================================================

describe('Deliverable Due Date Calculation', () => {
  const startDate = '2025-01-15';

  function calculateDueDate(cadence: 'weekly' | 'monthly' | 'quarterly', start: string): string {
    // Parse date parts to avoid timezone issues
    const [year, month, day] = start.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    switch (cadence) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
    }
    // Format as YYYY-MM-DD in local time
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  it('weekly cadence adds 7 days', () => {
    const dueDate = calculateDueDate('weekly', startDate);
    expect(dueDate).toBe('2025-01-22');
  });

  it('monthly cadence adds 1 month', () => {
    const dueDate = calculateDueDate('monthly', startDate);
    expect(dueDate).toBe('2025-02-15');
  });

  it('quarterly cadence adds 3 months', () => {
    const dueDate = calculateDueDate('quarterly', startDate);
    expect(dueDate).toBe('2025-04-15');
  });
});

// ============================================================================
// Idempotency Tests (Unit Level)
// ============================================================================

describe('Bundle Idempotency', () => {
  it('same bundle + company generates same stable key', () => {
    const key1 = generateBundleKey('company_abc', 'bundle-xyz');
    const key2 = generateBundleKey('company_abc', 'bundle-xyz');
    const key3 = generateBundleKey('company_abc', 'bundle-xyz');

    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  it('same bundle + domain generates same program key', () => {
    const key1 = generateBundleProgramKey('bundle-xyz', 'Strategy');
    const key2 = generateBundleProgramKey('bundle-xyz', 'Strategy');

    expect(key1).toBe(key2);
  });

  it('different domains generate different program keys for same bundle', () => {
    const keys = [
      generateBundleProgramKey('bundle-xyz', 'Strategy'),
      generateBundleProgramKey('bundle-xyz', 'Creative'),
      generateBundleProgramKey('bundle-xyz', 'Media'),
      generateBundleProgramKey('bundle-xyz', 'LocalVisibility'),
      generateBundleProgramKey('bundle-xyz', 'Analytics'),
      generateBundleProgramKey('bundle-xyz', 'Operations'),
    ];

    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(6);
  });
});

// ============================================================================
// Template Structure Tests
// ============================================================================

describe('Template Structure Completeness', () => {
  it('all expected outputs have required fields', () => {
    for (const domain of Object.keys(DOMAIN_TEMPLATES) as ProgramDomain[]) {
      const template = DOMAIN_TEMPLATES[domain];
      for (const output of template.expectedOutputs) {
        expect(output.id).toBeDefined();
        expect(output.name).toBeDefined();
        expect(output.workstreamType).toBeDefined();
        expect(output.cadence).toBeDefined();
        expect(['weekly', 'monthly', 'quarterly']).toContain(output.cadence);
      }
    }
  });

  it('all success signals have required fields', () => {
    for (const domain of Object.keys(DOMAIN_TEMPLATES) as ProgramDomain[]) {
      const template = DOMAIN_TEMPLATES[domain];
      for (const signal of template.successSignals) {
        expect(signal.id).toBeDefined();
        expect(signal.metric).toBeDefined();
        expect(signal.targetDirection).toBeDefined();
        expect(['increase', 'decrease', 'maintain']).toContain(signal.targetDirection);
        expect(signal.measurementFrequency).toBeDefined();
      }
    }
  });

  it('max concurrent work is positive for all intensities', () => {
    for (const domain of Object.keys(DOMAIN_TEMPLATES) as ProgramDomain[]) {
      const template = DOMAIN_TEMPLATES[domain];
      expect(template.maxConcurrentWork.Core).toBeGreaterThan(0);
      expect(template.maxConcurrentWork.Standard).toBeGreaterThan(0);
      expect(template.maxConcurrentWork.Aggressive).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Bundle Preset Tests
// ============================================================================

import {
  BUNDLE_PRESETS,
  getEnabledBundlePresets,
  getBundlePresetById,
  getBundlePresetsForClient,
  isValidBundlePreset,
} from '@/lib/os/planning/domainTemplates';

describe('Bundle Presets', () => {
  describe('Car Toys Preset', () => {
    it('exists with correct ID', () => {
      const preset = getBundlePresetById('car-toys-local-demand-engine-standard');

      expect(preset).toBeDefined();
      expect(preset?.id).toBe('car-toys-local-demand-engine-standard');
    });

    it('has correct name', () => {
      const preset = getBundlePresetById('car-toys-local-demand-engine-standard');

      expect(preset?.name).toBe('Car Toys — Local Demand Engine (Standard)');
    });

    it('includes all 6 domains', () => {
      const preset = getBundlePresetById('car-toys-local-demand-engine-standard');

      expect(preset?.domains).toHaveLength(6);
      expect(preset?.domains).toContain('Strategy');
      expect(preset?.domains).toContain('Creative');
      expect(preset?.domains).toContain('Media');
      expect(preset?.domains).toContain('LocalVisibility');
      expect(preset?.domains).toContain('Analytics');
      expect(preset?.domains).toContain('Operations');
    });

    it('defaults to Standard intensity', () => {
      const preset = getBundlePresetById('car-toys-local-demand-engine-standard');

      expect(preset?.defaultIntensity).toBe('Standard');
    });

    it('is enabled', () => {
      const preset = getBundlePresetById('car-toys-local-demand-engine-standard');

      expect(preset?.enabled).toBe(true);
    });

    it('has Car Toys as target client', () => {
      const preset = getBundlePresetById('car-toys-local-demand-engine-standard');

      expect(preset?.targetClient).toBe('Car Toys');
    });

    it('appears in Car Toys client presets', () => {
      const carToysPresets = getBundlePresetsForClient('Car Toys');

      expect(carToysPresets.length).toBeGreaterThan(0);
      expect(carToysPresets.some((p) => p.id === 'car-toys-local-demand-engine-standard')).toBe(true);
    });

    it('is first in sort order', () => {
      const enabledPresets = getEnabledBundlePresets();

      expect(enabledPresets[0].id).toBe('car-toys-local-demand-engine-standard');
    });
  });

  describe('All Presets Structure', () => {
    it('all presets have required fields', () => {
      for (const preset of BUNDLE_PRESETS) {
        expect(preset.id).toBeDefined();
        expect(preset.id.length).toBeGreaterThan(0);
        expect(preset.name).toBeDefined();
        expect(preset.name.length).toBeGreaterThan(0);
        expect(preset.description).toBeDefined();
        expect(preset.domains).toBeDefined();
        expect(preset.domains.length).toBeGreaterThan(0);
        expect(preset.defaultIntensity).toBeDefined();
        expect(['Core', 'Standard', 'Aggressive']).toContain(preset.defaultIntensity);
      }
    });

    it('all presets have unique IDs', () => {
      const ids = BUNDLE_PRESETS.map((p) => p.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all preset domains are valid', () => {
      const validDomains: ProgramDomain[] = [
        'Strategy',
        'Creative',
        'Media',
        'LocalVisibility',
        'Analytics',
        'Operations',
      ];

      for (const preset of BUNDLE_PRESETS) {
        for (const domain of preset.domains) {
          expect(validDomains).toContain(domain);
        }
      }
    });
  });

  describe('Preset Lookup Functions', () => {
    describe('getEnabledBundlePresets', () => {
      it('returns only enabled presets', () => {
        const enabled = getEnabledBundlePresets();

        for (const preset of enabled) {
          expect(preset.enabled).toBe(true);
        }
      });

      it('returns presets sorted by sortOrder', () => {
        const enabled = getEnabledBundlePresets();

        for (let i = 1; i < enabled.length; i++) {
          const prevOrder = enabled[i - 1].sortOrder ?? 100;
          const currOrder = enabled[i].sortOrder ?? 100;
          expect(currOrder).toBeGreaterThanOrEqual(prevOrder);
        }
      });
    });

    describe('getBundlePresetById', () => {
      it('returns preset for valid ID', () => {
        const preset = getBundlePresetById('local-demand-engine-standard');

        expect(preset).toBeDefined();
        expect(preset?.id).toBe('local-demand-engine-standard');
      });

      it('returns undefined for invalid ID', () => {
        const preset = getBundlePresetById('nonexistent-preset');

        expect(preset).toBeUndefined();
      });
    });

    describe('getBundlePresetsForClient', () => {
      it('returns presets for matching client (case insensitive)', () => {
        const presetsUpper = getBundlePresetsForClient('CAR TOYS');
        const presetsLower = getBundlePresetsForClient('car toys');

        expect(presetsUpper.length).toBe(presetsLower.length);
      });

      it('returns empty array for unknown client', () => {
        const presets = getBundlePresetsForClient('Unknown Client XYZ');

        expect(presets).toHaveLength(0);
      });
    });

    describe('isValidBundlePreset', () => {
      it('returns true for valid preset ID', () => {
        expect(isValidBundlePreset('car-toys-local-demand-engine-standard')).toBe(true);
        expect(isValidBundlePreset('local-demand-engine-standard')).toBe(true);
      });

      it('returns false for invalid preset ID', () => {
        expect(isValidBundlePreset('fake-preset')).toBe(false);
        expect(isValidBundlePreset('')).toBe(false);
      });
    });
  });

  describe('Local Demand Engine Presets', () => {
    it('has Core, Standard, and Aggressive variants', () => {
      expect(getBundlePresetById('local-demand-engine-core')).toBeDefined();
      expect(getBundlePresetById('local-demand-engine-standard')).toBeDefined();
      expect(getBundlePresetById('local-demand-engine-aggressive')).toBeDefined();
    });

    it('all variants have 6 domains', () => {
      const core = getBundlePresetById('local-demand-engine-core');
      const standard = getBundlePresetById('local-demand-engine-standard');
      const aggressive = getBundlePresetById('local-demand-engine-aggressive');

      expect(core?.domains).toHaveLength(6);
      expect(standard?.domains).toHaveLength(6);
      expect(aggressive?.domains).toHaveLength(6);
    });

    it('each variant has matching intensity', () => {
      const core = getBundlePresetById('local-demand-engine-core');
      const standard = getBundlePresetById('local-demand-engine-standard');
      const aggressive = getBundlePresetById('local-demand-engine-aggressive');

      expect(core?.defaultIntensity).toBe('Core');
      expect(standard?.defaultIntensity).toBe('Standard');
      expect(aggressive?.defaultIntensity).toBe('Aggressive');
    });
  });

  describe('Specialized Bundles', () => {
    it('digital-foundation has 4 domains without Media or LocalVisibility', () => {
      const preset = getBundlePresetById('digital-foundation-standard');

      expect(preset?.domains).toHaveLength(4);
      expect(preset?.domains).not.toContain('Media');
      expect(preset?.domains).not.toContain('LocalVisibility');
      expect(preset?.domains).toContain('Strategy');
      expect(preset?.domains).toContain('Creative');
      expect(preset?.domains).toContain('Analytics');
      expect(preset?.domains).toContain('Operations');
    });

    it('media-accelerator has 4 domains without Creative or LocalVisibility', () => {
      const preset = getBundlePresetById('media-accelerator-standard');

      expect(preset?.domains).toHaveLength(4);
      expect(preset?.domains).not.toContain('Creative');
      expect(preset?.domains).not.toContain('LocalVisibility');
      expect(preset?.domains).toContain('Strategy');
      expect(preset?.domains).toContain('Media');
      expect(preset?.domains).toContain('Analytics');
      expect(preset?.domains).toContain('Operations');
    });

    it('local-visibility-starter has 3 domains', () => {
      const preset = getBundlePresetById('local-visibility-starter');

      expect(preset?.domains).toHaveLength(3);
      expect(preset?.domains).toContain('LocalVisibility');
      expect(preset?.domains).toContain('Analytics');
      expect(preset?.domains).toContain('Operations');
    });
  });
});
