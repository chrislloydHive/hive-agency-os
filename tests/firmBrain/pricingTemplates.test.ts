// tests/firmBrain/pricingTemplates.test.ts
// Tests for Pricing Templates (Simplified Schema)

import { describe, it, expect } from 'vitest';
import {
  PricingTemplateSchema,
  PricingTemplateInputSchema,
  parseDescriptionSections,
  getDescriptionPreview,
  PRICING_TEMPLATE_SCAFFOLD,
  DESCRIPTION_SECTION_LABELS,
  type PricingTemplate,
  type ListPricingTemplatesOptions,
} from '@/lib/types/firmBrain';

// ============================================================================
// Helper: In-memory filter logic (mirrors Airtable layer)
// ============================================================================

function filterPricingTemplates(
  templates: PricingTemplate[],
  options?: ListPricingTemplatesOptions
): PricingTemplate[] {
  let result = [...templates];

  if (options?.hasFile !== undefined) {
    result = result.filter((t) =>
      options.hasFile
        ? t.examplePricingFiles.length > 0
        : t.examplePricingFiles.length === 0
    );
  }

  if (options?.hasOpportunities !== undefined) {
    result = result.filter((t) =>
      options.hasOpportunities
        ? t.relevantOpportunities.length > 0
        : t.relevantOpportunities.length === 0
    );
  }

  if (options?.q) {
    const qLower = options.q.toLowerCase();
    result = result.filter(
      (t) =>
        t.name.toLowerCase().includes(qLower) ||
        t.description.toLowerCase().includes(qLower)
    );
  }

  return result;
}

// ============================================================================
// Test Fixtures
// ============================================================================

const createTestTemplate = (overrides: Partial<PricingTemplate> = {}): PricingTemplate => ({
  id: 'rec123',
  name: 'Test Template',
  description: `Best for: Startups needing brand foundation

Typical range: $18,000 – $35,000

Billing: One-time project fee

Includes:
- Brand positioning + messaging foundation
- Visual identity system

Excludes:
- Naming
- Photography

Notes: Price high end for complex stakeholder environments.`,
  linkedAgencyId: null,
  examplePricingFiles: [],
  relevantOpportunities: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('PricingTemplateSchema', () => {
  it('should accept valid complete template', () => {
    const template = createTestTemplate();
    const result = PricingTemplateSchema.safeParse(template);
    expect(result.success).toBe(true);
  });

  it('should accept template with attachments', () => {
    const template = createTestTemplate({
      examplePricingFiles: [
        { id: 'att1', url: 'https://example.com/file.pdf', filename: 'pricing.pdf' },
      ],
    });
    const result = PricingTemplateSchema.safeParse(template);
    expect(result.success).toBe(true);
  });

  it('should accept template with linked opportunities', () => {
    const template = createTestTemplate({
      relevantOpportunities: [
        { id: 'recOpp1', name: 'Project Alpha' },
        { id: 'recOpp2', name: 'Project Beta' },
      ],
    });
    const result = PricingTemplateSchema.safeParse(template);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    const template = {
      id: 'rec123',
      // missing name
    };
    const result = PricingTemplateSchema.safeParse(template);
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const template = createTestTemplate({ name: '' });
    const result = PricingTemplateSchema.safeParse(template);
    expect(result.success).toBe(false);
  });

  it('should provide default for empty description', () => {
    const template = { ...createTestTemplate() };
    delete (template as Record<string, unknown>).description;
    const result = PricingTemplateSchema.safeParse(template);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
    }
  });
});

describe('PricingTemplateInputSchema', () => {
  it('should accept valid input with name and description', () => {
    const input = {
      name: 'New Template',
      description: 'A new template description',
    };
    const result = PricingTemplateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept minimal input with just name', () => {
    const input = { name: 'New Template' };
    const result = PricingTemplateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept input with linkedAgencyId', () => {
    const input = {
      name: 'New Template',
      description: 'Test',
      linkedAgencyId: 'recAgency123',
    };
    const result = PricingTemplateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const input = { name: '' };
    const result = PricingTemplateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Description Parsing Tests
// ============================================================================

describe('parseDescriptionSections', () => {
  it('should parse description into labeled sections', () => {
    const description = `Best for: Startups

Typical range: $10k–$20k

Includes:
- Item 1
- Item 2`;

    const sections = parseDescriptionSections(description);
    expect(sections.length).toBeGreaterThan(0);

    const bestForSection = sections.find((s) => s.label === 'Best for');
    expect(bestForSection).toBeDefined();
    expect(bestForSection?.content).toBe('Startups');

    const rangeSection = sections.find((s) => s.label === 'Typical range');
    expect(rangeSection).toBeDefined();
    expect(rangeSection?.content).toBe('$10k–$20k');

    const includesSection = sections.find((s) => s.label === 'Includes');
    expect(includesSection).toBeDefined();
    expect(includesSection?.content).toContain('Item 1');
  });

  it('should handle empty description', () => {
    const sections = parseDescriptionSections('');
    expect(sections).toEqual([]);
  });

  it('should handle description with no labeled sections', () => {
    const description = 'Just some plain text without any labels';
    const sections = parseDescriptionSections(description);
    expect(sections.length).toBe(1);
    expect(sections[0].label).toBe('');
    expect(sections[0].content).toBe(description);
  });

  it('should parse all recognized section labels', () => {
    const description = DESCRIPTION_SECTION_LABELS.map((label) => `${label}: Test content`).join(
      '\n\n'
    );
    const sections = parseDescriptionSections(description);

    for (const label of DESCRIPTION_SECTION_LABELS) {
      const found = sections.find((s) => s.label === label);
      expect(found).toBeDefined();
    }
  });
});

describe('getDescriptionPreview', () => {
  it('should return first non-labeled content', () => {
    const description = 'Intro text here\n\nBest for: Startups';
    const preview = getDescriptionPreview(description, 100);
    expect(preview).toContain('Intro');
  });

  it('should truncate long previews', () => {
    const description = 'A'.repeat(200);
    const preview = getDescriptionPreview(description, 50);
    expect(preview.length).toBeLessThanOrEqual(53); // 50 + "..."
    expect(preview.endsWith('...')).toBe(true);
  });

  it('should return empty for empty description', () => {
    const preview = getDescriptionPreview('', 100);
    expect(preview).toBe('');
  });

  it('should return full first line including label prefix', () => {
    const description = 'Best for: Startups needing brand work';
    const preview = getDescriptionPreview(description, 100);
    // Current implementation preserves the full line including labels
    expect(preview).toBe('Best for: Startups needing brand work');
  });
});

describe('PRICING_TEMPLATE_SCAFFOLD', () => {
  it('should contain all section labels', () => {
    for (const label of DESCRIPTION_SECTION_LABELS) {
      expect(PRICING_TEMPLATE_SCAFFOLD).toContain(`${label}:`);
    }
  });
});

// ============================================================================
// Filter Logic Tests
// ============================================================================

describe('filterPricingTemplates', () => {
  const templates: PricingTemplate[] = [
    createTestTemplate({
      id: 'rec1',
      name: 'Brand Identity System',
      examplePricingFiles: [
        { id: 'att1', url: 'https://example.com/brand.pdf', filename: 'brand.pdf' },
      ],
      relevantOpportunities: [{ id: 'opp1', name: 'Project Alpha' }],
    }),
    createTestTemplate({
      id: 'rec2',
      name: 'Website Build',
      examplePricingFiles: [],
      relevantOpportunities: [],
    }),
    createTestTemplate({
      id: 'rec3',
      name: 'SEO Program',
      examplePricingFiles: [
        { id: 'att2', url: 'https://example.com/seo.pdf', filename: 'seo.pdf' },
      ],
      relevantOpportunities: [],
    }),
    createTestTemplate({
      id: 'rec4',
      name: 'Content Engine',
      examplePricingFiles: [],
      relevantOpportunities: [
        { id: 'opp2', name: 'Project Beta' },
        { id: 'opp3', name: 'Project Gamma' },
      ],
    }),
  ];

  describe('hasFile filter', () => {
    it('should filter templates with files', () => {
      const result = filterPricingTemplates(templates, { hasFile: true });
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.name)).toContain('Brand Identity System');
      expect(result.map((t) => t.name)).toContain('SEO Program');
    });

    it('should filter templates without files', () => {
      const result = filterPricingTemplates(templates, { hasFile: false });
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.name)).toContain('Website Build');
      expect(result.map((t) => t.name)).toContain('Content Engine');
    });
  });

  describe('hasOpportunities filter', () => {
    it('should filter templates with linked opportunities', () => {
      const result = filterPricingTemplates(templates, { hasOpportunities: true });
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.name)).toContain('Brand Identity System');
      expect(result.map((t) => t.name)).toContain('Content Engine');
    });

    it('should filter templates without linked opportunities', () => {
      const result = filterPricingTemplates(templates, { hasOpportunities: false });
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.name)).toContain('Website Build');
      expect(result.map((t) => t.name)).toContain('SEO Program');
    });
  });

  describe('search query (q) filter', () => {
    it('should search across name and description', () => {
      // 'Brand' matches 'Brand Identity System' by name AND all templates
      // via description ("Brand positioning + messaging foundation")
      const result = filterPricingTemplates(templates, { q: 'Brand' });
      expect(result).toHaveLength(4);
      expect(result.map((t) => t.name)).toContain('Brand Identity System');
    });

    it('should find unique matches by specific name', () => {
      // Use unique name portion that doesn't appear in shared description
      const result = filterPricingTemplates(templates, { q: 'SEO Program' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('SEO Program');
    });

    it('should search by description', () => {
      const result = filterPricingTemplates(templates, { q: 'Startups' });
      expect(result).toHaveLength(4); // All have this in description
    });

    it('should search case-insensitively', () => {
      const result = filterPricingTemplates(templates, { q: 'WEBSITE' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Website Build');
    });
  });

  describe('combined filters', () => {
    it('should combine hasFile and hasOpportunities filters', () => {
      const result = filterPricingTemplates(templates, {
        hasFile: true,
        hasOpportunities: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Brand Identity System');
    });

    it('should combine search and hasFile filters', () => {
      const result = filterPricingTemplates(templates, {
        hasFile: true,
        q: 'SEO',
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('SEO Program');
    });

    it('should return empty when filters exclude all', () => {
      const result = filterPricingTemplates(templates, {
        hasFile: true,
        hasOpportunities: true,
        q: 'nonexistent',
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('no filters', () => {
    it('should return all templates when no filters provided', () => {
      const result = filterPricingTemplates(templates);
      expect(result).toHaveLength(4);
    });

    it('should return all templates with empty options object', () => {
      const result = filterPricingTemplates(templates, {});
      expect(result).toHaveLength(4);
    });
  });
});
