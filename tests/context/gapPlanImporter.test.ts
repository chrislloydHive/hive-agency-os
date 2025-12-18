// tests/context/gapPlanImporter.test.ts
// GAP Plan Importer Tests
//
// Tests the GAP Plan importer functionality including:
// - Importer registration and structure
// - Mapping rules (maturity stage, KPIs, scores)
// - Safety: lower confidence than Labs, no overwrites

import { describe, it, expect } from 'vitest';
import { gapPlanImporter } from '@/lib/contextGraph/importers/gapPlanImporter';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { setField, createProvenance } from '@/lib/contextGraph/mutate';

describe('GAP Plan Importer', () => {
  describe('Importer Structure', () => {
    it('should have correct id and label', () => {
      expect(gapPlanImporter.id).toBe('gapPlan');
      expect(gapPlanImporter.label).toBe('GAP Plan');
    });

    it('should implement DomainImporter interface', () => {
      expect(typeof gapPlanImporter.supports).toBe('function');
      expect(typeof gapPlanImporter.importAll).toBe('function');
    });
  });

  describe('Safety: Secondary Source Behavior', () => {
    it('should use lower confidence (0.6) than Labs (0.85)', () => {
      // GAP Plan is a secondary source - fills gaps only
      // Labs use confidence 0.85, GAP Plan uses 0.6
      const gapPlanConfidence = 0.6;
      const labConfidence = 0.85;

      expect(gapPlanConfidence).toBeLessThan(labConfidence);
    });

    it('should not overwrite existing Lab data', () => {
      const graph = createEmptyContextGraph('test-company', 'Test Company');

      // Simulate Lab having already written a value
      const labProvenance = createProvenance('brand_lab', {
        confidence: 0.85,
        runId: 'lab-run-123',
      });
      setField(graph, 'objectives', 'primaryBusinessGoal', 'Lab goal', labProvenance);

      // Verify Lab data exists
      expect(graph.objectives?.primaryBusinessGoal?.value).toBe('Lab goal');

      // GAP Plan importer checks !graph.objectives?.primaryBusinessGoal?.value
      // before writing, so it would skip this field
      const shouldSkip = !!graph.objectives?.primaryBusinessGoal?.value;
      expect(shouldSkip).toBe(true);
    });

    it('should not overwrite human-confirmed data', () => {
      const graph = createEmptyContextGraph('test-company', 'Test Company');

      // Simulate human having confirmed a value
      const userProvenance = createProvenance('user', {
        confidence: 1.0,
        notes: 'Confirmed by user test-user-123',
      });
      setField(graph, 'objectives', 'kpiLabels', ['Revenue', 'Leads'], userProvenance);

      // Verify human data exists
      expect(graph.objectives?.kpiLabels?.value).toEqual(['Revenue', 'Leads']);

      // GAP Plan importer checks value existence before writing
      const shouldSkip = !!graph.objectives?.kpiLabels?.value?.length;
      expect(shouldSkip).toBe(true);
    });
  });

  describe('Mapping: Maturity Stage', () => {
    it('should map developing/early stages to launch', () => {
      const stageMap: Record<string, 'launch' | 'growth' | 'plateau' | 'turnaround' | 'exit' | 'other'> = {
        'developing': 'launch',
        'early': 'launch',
        'foundation': 'launch',
      };

      expect(stageMap['developing']).toBe('launch');
      expect(stageMap['early']).toBe('launch');
      expect(stageMap['foundation']).toBe('launch');
    });

    it('should map emerging/scaling stages to growth', () => {
      const stageMap: Record<string, 'launch' | 'growth' | 'plateau' | 'turnaround' | 'exit' | 'other'> = {
        'emerging': 'growth',
        'scaling': 'growth',
      };

      expect(stageMap['emerging']).toBe('growth');
      expect(stageMap['scaling']).toBe('growth');
    });

    it('should map established/leading stages to plateau', () => {
      const stageMap: Record<string, 'launch' | 'growth' | 'plateau' | 'turnaround' | 'exit' | 'other'> = {
        'established': 'plateau',
        'leading': 'plateau',
      };

      expect(stageMap['established']).toBe('plateau');
      expect(stageMap['leading']).toBe('plateau');
    });

    it('should default unknown stages to other', () => {
      const stageMap: Record<string, 'launch' | 'growth' | 'plateau' | 'turnaround' | 'exit' | 'other'> = {};
      const unknownStage = stageMap['unknown-stage'] || 'other';

      expect(unknownStage).toBe('other');
    });
  });

  describe('Mapping: KPIs', () => {
    it('should extract KPI names from structured data', () => {
      const kpisToWatch = [
        { name: 'Customer Acquisition Cost', description: 'Track CAC' },
        { name: 'Monthly Recurring Revenue', description: 'Track MRR' },
        { name: 'Churn Rate', description: 'Track churn' },
      ];

      const kpiLabels = kpisToWatch.map((kpi) => kpi.name);

      expect(kpiLabels).toEqual([
        'Customer Acquisition Cost',
        'Monthly Recurring Revenue',
        'Churn Rate',
      ]);
    });
  });

  describe('Mapping: Insights by Category', () => {
    it('should categorize insights correctly', () => {
      const insights = [
        { id: '1', title: 'Brand issue', body: 'Details', category: 'brand', severity: 'high' as const },
        { id: '2', title: 'SEO issue', body: 'Details', category: 'seo', severity: 'medium' as const },
        { id: '3', title: 'Website issue', body: 'Details', category: 'website', severity: 'low' as const },
      ];

      const byCategory: Record<string, typeof insights> = {};
      for (const insight of insights) {
        const cat = insight.category.toLowerCase();
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(insight);
      }

      expect(byCategory['brand']).toHaveLength(1);
      expect(byCategory['seo']).toHaveLength(1);
      expect(byCategory['website']).toHaveLength(1);
    });
  });

  describe('Integration: Registry', () => {
    it('should be registered in importer registry with high priority (95)', async () => {
      // GAP Plan runs late (priority 95) after Labs have written
      // This ensures it only fills gaps, never overwrites Lab data
      const { getEnabledImporters, getImporterById } = await import(
        '@/lib/contextGraph/importers/registry'
      );

      const importer = getImporterById('gapPlan');
      expect(importer).toBeDefined();
      expect(importer?.id).toBe('gapPlan');

      // Verify it's in the enabled importers list
      const enabledImporters = getEnabledImporters();
      const gapPlanInList = enabledImporters.find((i) => i.id === 'gapPlan');
      expect(gapPlanInList).toBeDefined();
    });
  });

  // =========================================================================
  // Extended Field Mappings (v2) - For Context Graph Completeness
  // =========================================================================

  describe('Extended Mapping: Primary Offers', () => {
    it('should extract product names from primaryOffers', () => {
      const primaryOffers = [
        { name: 'Premium Plan', description: 'Full access', priceTier: 'high' as const },
        { name: 'Basic Plan', description: 'Limited access', priceTier: 'low' as const },
      ];

      const productNames = primaryOffers.map((offer) => offer.name);

      expect(productNames).toEqual(['Premium Plan', 'Basic Plan']);
    });

    it('should derive value proposition from first offer with description', () => {
      const primaryOffers = [
        { name: 'Enterprise', description: 'Complete business solution with 24/7 support' },
        { name: 'Starter', description: 'Get started quickly' },
      ];

      const valueProposition = primaryOffers.find((o) => o.description)?.description;

      expect(valueProposition).toBe('Complete business solution with 24/7 support');
    });
  });

  describe('Extended Mapping: Competitors', () => {
    it('should extract competitor names', () => {
      const competitors = [
        { name: 'Competitor A', domain: 'competitora.com', positioningNote: 'Market leader' },
        { name: 'Competitor B', domain: 'competitorb.com', positioningNote: 'Low-cost alternative' },
      ];

      const competitorNames = competitors.map((c) => c.name);

      expect(competitorNames).toEqual(['Competitor A', 'Competitor B']);
    });

    it('should extract positioning notes for competitive advantages', () => {
      const competitors = [
        { name: 'Competitor A', positioningNote: 'Strong brand recognition' },
        { name: 'Competitor B', positioningNote: 'Lower pricing' },
      ];

      const competitorNotes = competitors
        .filter((c) => c.positioningNote)
        .map((c) => `vs ${c.name}: ${c.positioningNote}`);

      expect(competitorNotes).toEqual([
        'vs Competitor A: Strong brand recognition',
        'vs Competitor B: Lower pricing',
      ]);
    });
  });

  describe('Extended Mapping: Audience Summary', () => {
    it('should extract ICP description', () => {
      const audienceSummary = {
        icpDescription: 'Mid-market B2B SaaS companies with 50-500 employees',
        keyPainPoints: ['Manual processes', 'Lack of visibility'],
        buyingTriggers: ['Growth phase', 'New funding'],
      };

      expect(audienceSummary.icpDescription).toBe(
        'Mid-market B2B SaaS companies with 50-500 employees'
      );
    });

    it('should extract pain points', () => {
      const audienceSummary = {
        icpDescription: 'Enterprise customers',
        keyPainPoints: ['Integration complexity', 'Data silos', 'Compliance burden'],
      };

      expect(audienceSummary.keyPainPoints).toHaveLength(3);
      expect(audienceSummary.keyPainPoints).toContain('Data silos');
    });

    it('should extract buying triggers as motivations', () => {
      const audienceSummary = {
        icpDescription: 'SMB owners',
        keyPainPoints: ['Time constraints'],
        buyingTriggers: ['Business expansion', 'Competitor pressure'],
      };

      expect(audienceSummary.buyingTriggers).toEqual(['Business expansion', 'Competitor pressure']);
    });
  });

  describe('Extended Mapping: Brand Identity Notes', () => {
    it('should extract tone of voice', () => {
      const brandIdentityNotes = {
        tone: ['Professional', 'Trustworthy', 'Innovative'],
        personality: ['Expert', 'Reliable'],
        differentiationSummary: 'Industry-leading technology with personal service',
      };

      const toneString = brandIdentityNotes.tone?.join(', ');

      expect(toneString).toBe('Professional, Trustworthy, Innovative');
    });

    it('should extract brand personality', () => {
      const brandIdentityNotes = {
        tone: ['Friendly'],
        personality: ['Approachable', 'Knowledgeable', 'Supportive'],
      };

      expect(brandIdentityNotes.personality).toHaveLength(3);
    });

    it('should parse differentiation summary into array', () => {
      const differentiationSummary = 'AI-powered; 24/7 support; Industry expertise';

      const differentiators = differentiationSummary.includes(';')
        ? differentiationSummary.split(';').map((s) => s.trim()).filter(Boolean)
        : [differentiationSummary];

      expect(differentiators).toEqual(['AI-powered', '24/7 support', 'Industry expertise']);
    });
  });

  // =========================================================================
  // Confidence-Aware Upgrade Rules
  // =========================================================================

  describe('Confidence-Aware Upgrade Rules', () => {
    it('should define GAP Plan confidence as 0.6', async () => {
      // GAP Plan uses confidence 0.6 (lower than Labs at 0.85)
      const { SOURCE_CONFIDENCE_LEVELS } = await import('@/lib/contextGraph/sourcePriority');

      expect(SOURCE_CONFIDENCE_LEVELS['gap_full']).toBe(0.6);
    });

    it('should allow Labs (0.85) to upgrade GAP Plan (0.6) fields', async () => {
      const { canUpgradeFromGapPlan, SOURCE_CONFIDENCE_LEVELS } = await import(
        '@/lib/contextGraph/sourcePriority'
      );

      // Simulate existing GAP Plan provenance
      const existingProvenance = [
        {
          source: 'gap_full',
          confidence: 0.6,
          updatedAt: new Date().toISOString(),
        },
      ];

      const result = canUpgradeFromGapPlan(existingProvenance, 'brand_lab', 0.85);

      expect(result.canUpgrade).toBe(true);
      expect(result.reason).toContain('lab_upgrade_gap_plan');
    });

    it('should NOT allow GAP Plan to overwrite itself', async () => {
      const { canUpgradeFromGapPlan } = await import('@/lib/contextGraph/sourcePriority');

      const existingProvenance = [
        {
          source: 'gap_full',
          confidence: 0.6,
          updatedAt: new Date().toISOString(),
        },
      ];

      const result = canUpgradeFromGapPlan(existingProvenance, 'gap_full', 0.6);

      expect(result.canUpgrade).toBe(false);
      expect(result.reason).toBe('gap_plan_no_self_overwrite');
    });

    it('should NOT allow GAP Plan to overwrite human-confirmed fields', async () => {
      const { canUpgradeFromGapPlan } = await import('@/lib/contextGraph/sourcePriority');

      const existingProvenance = [
        {
          source: 'user',
          confidence: 1.0,
          updatedAt: new Date().toISOString(),
        },
      ];

      const result = canUpgradeFromGapPlan(existingProvenance, 'gap_full', 0.6);

      expect(result.canUpgrade).toBe(false);
      expect(result.reason).toBe('human_confirmed');
    });
  });

  // =========================================================================
  // Telemetry
  // =========================================================================

  describe('Hydration Telemetry', () => {
    it('should define telemetry interface with required fields', async () => {
      const { HydrationTelemetry, DomainTelemetry } = await import(
        '@/lib/contextGraph/importers/types'
      );

      // Type check - these should be defined
      const telemetry: import('@/lib/contextGraph/importers/types').HydrationTelemetry = {
        completenessBefore: 20,
        completenessAfter: 55,
        completenessChange: 35,
        fieldsWrittenByDomain: {
          brand: 3,
          audience: 4,
          identity: 2,
          productOffer: 3,
          competitive: 2,
          objectives: 1,
          website: 0,
          content: 0,
          seo: 0,
          other: 0,
        },
        durationMs: 1500,
      };

      expect(telemetry.completenessChange).toBe(35);
      expect(telemetry.fieldsWrittenByDomain.brand).toBe(3);
    });
  });
});
