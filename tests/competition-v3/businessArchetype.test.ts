import { describe, it, expect } from 'vitest';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { applyArchetypeCompetitionLogic, buildQueryContext, getBusinessArchetypeStatus } from '@/lib/competition-v3/orchestrator/runCompetitionAnalysis';
import type { DiscoveryCandidate } from '@/lib/competition-v3/types';

describe('Competition V3 - Business Archetype requirements', () => {
  it('flags missing businessArchetype as not confirmed', () => {
    const graph = createEmptyContextGraph('company-1', 'Test Co');
    const status = getBusinessArchetypeStatus(graph);
    expect(status.confirmed).toBe(false);
    expect(status.value).toBeNull();
  });

  it('injects big-box substitution competitors for regional multi-location service archetype', () => {
    const candidates: DiscoveryCandidate[] = [];
    const context = { businessArchetype: 'regional_multi_location_service' } as any;
    const result = applyArchetypeCompetitionLogic(candidates, context);
    const domains = result.map(c => c.domain);
    expect(domains).toContain('bestbuy.com');
  });

  it('propagates confirmed businessArchetype into query context', () => {
    const graph = createEmptyContextGraph('company-2', 'Car Toys');
    graph.identity.businessArchetype.value = 'regional_multi_location_service';
    graph.identity.businessArchetype.provenance.push({ source: 'user', updatedAt: new Date().toISOString(), confidence: 1 });

    const context = buildQueryContext(graph, 'company-2', {
      id: 'company-2',
      name: 'Car Toys',
      website: 'https://cartoys.com',
      domain: 'cartoys.com',
    } as any);

    expect(context.businessArchetype).toBe('regional_multi_location_service');
    expect(context.archetype).toBe('local_service');
  });
});

