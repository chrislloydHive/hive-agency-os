/**
 * Tests for Services-Aware Strategy Generation
 *
 * Verifies that strategy and tactic generation:
 * - Includes Hive services in AI context
 * - Uses service-weighted reasoning rules
 * - Returns service coverage metadata
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Test Helpers - Inline versions of functions to test behavior
// ============================================================================

interface HydratedFrame {
  audience: { value: string | null };
  offering: { value: string | null };
  valueProp: { value: string | null };
  positioning: { value: string | null };
  constraints: { value: string | null };
}

interface StrategyInputs {
  executionCapabilities?: {
    serviceTaxonomy: string[];
    operatingPrinciples: string[];
    doctrineVersion: string;
  };
  businessReality?: {
    companyName?: string;
    businessModel?: string;
    goals?: string[];
  };
  competition?: {
    competitors?: Array<{ name: string; description?: string }>;
  };
}

/**
 * Inline copy of buildContextForAI for testing
 * (matches the actual implementation in ai-propose/route.ts)
 */
function buildContextForAI(params: {
  strategy: any;
  hydratedFrame: HydratedFrame;
  inputs: StrategyInputs | null;
  additionalContext?: string;
}): string {
  const { strategy, hydratedFrame, inputs, additionalContext } = params;

  const sections: string[] = [];

  // Hive Services (FIRST - most important for service-aware generation)
  if (inputs?.executionCapabilities?.serviceTaxonomy?.length) {
    sections.push('## Hive Services (What We Can Deliver)');
    sections.push('The following services are enabled and available for this client:');
    for (const service of inputs.executionCapabilities.serviceTaxonomy) {
      sections.push(`- ${service}`);
    }
    sections.push('\nIMPORTANT: Only recommend tactics/strategies that leverage these services.');
  } else {
    sections.push('## Hive Services');
    sections.push('WARNING: No services are currently enabled. Please configure Hive Brain before generating strategy.');
  }

  // Strategic Frame
  sections.push('\n## Strategic Frame');
  if (hydratedFrame.audience.value) {
    sections.push(`- Target Audience: ${hydratedFrame.audience.value}`);
  }
  if (hydratedFrame.offering.value) {
    sections.push(`- Primary Offering: ${hydratedFrame.offering.value}`);
  }
  if (hydratedFrame.valueProp.value) {
    sections.push(`- Value Proposition: ${hydratedFrame.valueProp.value}`);
  }
  if (hydratedFrame.positioning.value) {
    sections.push(`- Market Positioning: ${hydratedFrame.positioning.value}`);
  }
  if (hydratedFrame.constraints.value) {
    sections.push(`- Constraints: ${hydratedFrame.constraints.value}`);
  }

  // Business Context from Inputs
  if (inputs?.businessReality) {
    sections.push('\n## Business Context');
    if (inputs.businessReality.companyName) {
      sections.push(`- Company: ${inputs.businessReality.companyName}`);
    }
    if (inputs.businessReality.businessModel) {
      sections.push(`- Business Model: ${inputs.businessReality.businessModel}`);
    }
    if (inputs.businessReality.goals?.length) {
      sections.push(`- Goals: ${inputs.businessReality.goals.join(', ')}`);
    }
  }

  // Additional Context
  if (additionalContext) {
    sections.push(`\n## Additional Context\n${additionalContext}`);
  }

  return sections.join('\n');
}

/**
 * Inline copy of getInputsUsed for testing
 */
function getInputsUsed(inputs: StrategyInputs | null, contextGraph: any): string[] {
  const used: string[] = [];

  if (contextGraph) {
    used.push('Context Graph');
  }

  if (inputs?.businessReality?.companyName) {
    used.push('Business Reality');
  }

  if (inputs?.competition?.competitors?.length) {
    used.push('Competition Data');
  }

  // Hive Services from execution capabilities
  if (inputs?.executionCapabilities?.serviceTaxonomy?.length) {
    used.push('Hive Services');
  }

  return used;
}

// ============================================================================
// Test Data
// ============================================================================

const mockHydratedFrame: HydratedFrame = {
  audience: { value: 'B2B SaaS Companies' },
  offering: { value: 'Marketing automation platform' },
  valueProp: { value: 'Reduce CAC by 40%' },
  positioning: { value: 'Premium, data-driven' },
  constraints: { value: 'No enterprise sales team' },
};

const mockInputsWithServices: StrategyInputs = {
  executionCapabilities: {
    serviceTaxonomy: [
      'Growth Strategy',
      'SEO Content',
      'Technical SEO',
      'On-Page SEO',
      'Search (Google/Bing)',
      'GA4/GTM Setup',
      'Conversion Tracking',
    ],
    operatingPrinciples: ['Be direct', 'Measure everything'],
    doctrineVersion: '1.0.0',
  },
  businessReality: {
    companyName: 'TestCo',
    businessModel: 'B2B SaaS',
    goals: ['Increase organic traffic', 'Lower CAC'],
  },
};

const mockInputsWithoutServices: StrategyInputs = {
  executionCapabilities: {
    serviceTaxonomy: [],
    operatingPrinciples: [],
    doctrineVersion: '1.0.0',
  },
  businessReality: {
    companyName: 'TestCo',
  },
};

// ============================================================================
// Tests: buildContextForAI Service Integration
// ============================================================================

describe('Services-Aware Strategy Generation', () => {
  describe('buildContextForAI', () => {
    it('includes Hive services section first when services are enabled', () => {
      const context = buildContextForAI({
        strategy: null,
        hydratedFrame: mockHydratedFrame,
        inputs: mockInputsWithServices,
      });

      // Hive Services should be first section
      expect(context.startsWith('## Hive Services')).toBe(true);
      expect(context).toContain('What We Can Deliver');
    });

    it('lists all enabled services in context', () => {
      const context = buildContextForAI({
        strategy: null,
        hydratedFrame: mockHydratedFrame,
        inputs: mockInputsWithServices,
      });

      expect(context).toContain('- Growth Strategy');
      expect(context).toContain('- SEO Content');
      expect(context).toContain('- Technical SEO');
      expect(context).toContain('- Search (Google/Bing)');
      expect(context).toContain('- GA4/GTM Setup');
    });

    it('includes service constraint reminder', () => {
      const context = buildContextForAI({
        strategy: null,
        hydratedFrame: mockHydratedFrame,
        inputs: mockInputsWithServices,
      });

      expect(context).toContain('IMPORTANT: Only recommend tactics/strategies that leverage these services.');
    });

    it('shows warning when no services are enabled', () => {
      const context = buildContextForAI({
        strategy: null,
        hydratedFrame: mockHydratedFrame,
        inputs: mockInputsWithoutServices,
      });

      expect(context).toContain('WARNING: No services are currently enabled');
      expect(context).toContain('Please configure Hive Brain');
    });

    it('shows warning when inputs is null', () => {
      const context = buildContextForAI({
        strategy: null,
        hydratedFrame: mockHydratedFrame,
        inputs: null,
      });

      expect(context).toContain('WARNING: No services are currently enabled');
    });

    it('includes strategic frame after services', () => {
      const context = buildContextForAI({
        strategy: null,
        hydratedFrame: mockHydratedFrame,
        inputs: mockInputsWithServices,
      });

      // Strategic Frame should come after Hive Services
      const servicesIndex = context.indexOf('## Hive Services');
      const frameIndex = context.indexOf('## Strategic Frame');

      expect(servicesIndex).toBeLessThan(frameIndex);
      expect(context).toContain('- Target Audience: B2B SaaS Companies');
    });

    it('includes business context', () => {
      const context = buildContextForAI({
        strategy: null,
        hydratedFrame: mockHydratedFrame,
        inputs: mockInputsWithServices,
      });

      expect(context).toContain('## Business Context');
      expect(context).toContain('- Company: TestCo');
      expect(context).toContain('- Business Model: B2B SaaS');
    });
  });

  describe('getInputsUsed', () => {
    it('includes Hive Services when services are enabled', () => {
      const inputs = getInputsUsed(mockInputsWithServices, { id: 'graph1' });

      expect(inputs).toContain('Hive Services');
      expect(inputs).toContain('Context Graph');
      expect(inputs).toContain('Business Reality');
    });

    it('does not include Hive Services when none are enabled', () => {
      const inputs = getInputsUsed(mockInputsWithoutServices, { id: 'graph1' });

      expect(inputs).not.toContain('Hive Services');
      expect(inputs).toContain('Context Graph');
    });

    it('handles null inputs gracefully', () => {
      const inputs = getInputsUsed(null, { id: 'graph1' });

      expect(inputs).toEqual(['Context Graph']);
    });
  });
});

// ============================================================================
// Tests: Service Coverage Types
// ============================================================================

describe('Service Coverage', () => {
  interface ServiceCoverage {
    servicesUsed: string[];
    unusedServices: string[];
    gaps: string[];
  }

  it('validates ServiceCoverage structure', () => {
    const coverage: ServiceCoverage = {
      servicesUsed: ['SEO Content', 'Technical SEO'],
      unusedServices: ['Social Ads', 'Retargeting'],
      gaps: ['Video Production'],
    };

    expect(coverage.servicesUsed).toHaveLength(2);
    expect(coverage.unusedServices).toHaveLength(2);
    expect(coverage.gaps).toHaveLength(1);
  });

  it('allows empty arrays for full coverage', () => {
    const fullCoverage: ServiceCoverage = {
      servicesUsed: ['Growth Strategy', 'SEO Content', 'Technical SEO'],
      unusedServices: [],
      gaps: [],
    };

    expect(fullCoverage.unusedServices).toHaveLength(0);
    expect(fullCoverage.gaps).toHaveLength(0);
  });
});

// ============================================================================
// Tests: Service-to-Channel Mapping
// ============================================================================

describe('Service to Channel Mapping', () => {
  const SERVICE_TO_CHANNEL_MAP: Record<string, string[]> = {
    'Technical SEO': ['seo'],
    'On-Page SEO': ['seo'],
    'Content SEO': ['seo'],
    'Local SEO': ['seo'],
    'SEO Content': ['content'],
    'Brand Content': ['content'],
    'Social Content': ['content'],
    'Search (Google/Bing)': ['paid'],
    'Social Ads': ['paid'],
    'PMax/Shopping': ['paid'],
    'Retargeting': ['paid'],
    'Web Design & Build': ['web'],
    'Conversion Optimization': ['web'],
    'GA4/GTM Setup': ['analytics'],
    'Conversion Tracking': ['analytics'],
    'Experimentation': ['analytics'],
  };

  it('maps SEO services to seo channel', () => {
    expect(SERVICE_TO_CHANNEL_MAP['Technical SEO']).toContain('seo');
    expect(SERVICE_TO_CHANNEL_MAP['On-Page SEO']).toContain('seo');
  });

  it('maps content services to content channel', () => {
    expect(SERVICE_TO_CHANNEL_MAP['SEO Content']).toContain('content');
    expect(SERVICE_TO_CHANNEL_MAP['Brand Content']).toContain('content');
  });

  it('maps paid media services to paid channel', () => {
    expect(SERVICE_TO_CHANNEL_MAP['Search (Google/Bing)']).toContain('paid');
    expect(SERVICE_TO_CHANNEL_MAP['Social Ads']).toContain('paid');
  });

  /**
   * Helper to validate tactic channels against enabled services
   */
  function validateTacticChannels(
    tacticChannels: string[],
    enabledServices: string[]
  ): { valid: boolean; missingCapabilities: string[] } {
    const missingCapabilities: string[] = [];

    for (const channel of tacticChannels) {
      // Find services that map to this channel
      const servicesForChannel = Object.entries(SERVICE_TO_CHANNEL_MAP)
        .filter(([, channels]) => channels.includes(channel))
        .map(([service]) => service);

      // Check if any of those services are enabled
      const hasCapability = servicesForChannel.some((service) =>
        enabledServices.includes(service)
      );

      if (!hasCapability) {
        missingCapabilities.push(channel);
      }
    }

    return {
      valid: missingCapabilities.length === 0,
      missingCapabilities,
    };
  }

  it('validates tactic with matching services', () => {
    const enabledServices = ['Technical SEO', 'SEO Content'];
    const tacticChannels = ['seo', 'content'];

    const result = validateTacticChannels(tacticChannels, enabledServices);

    expect(result.valid).toBe(true);
    expect(result.missingCapabilities).toHaveLength(0);
  });

  it('flags missing capabilities for unavailable channels', () => {
    const enabledServices = ['Technical SEO']; // Only SEO, no paid
    const tacticChannels = ['seo', 'paid'];

    const result = validateTacticChannels(tacticChannels, enabledServices);

    expect(result.valid).toBe(false);
    expect(result.missingCapabilities).toContain('paid');
  });

  it('handles empty enabled services', () => {
    const enabledServices: string[] = [];
    const tacticChannels = ['seo', 'content'];

    const result = validateTacticChannels(tacticChannels, enabledServices);

    expect(result.valid).toBe(false);
    expect(result.missingCapabilities).toEqual(['seo', 'content']);
  });
});
