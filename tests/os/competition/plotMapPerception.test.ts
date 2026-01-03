import { describe, it, expect } from 'vitest';
import {
  computePerceptionCoordinatesBatch,
  type Competitor,
  type PlotContext,
} from '@/lib/os/competition/plotMapPerception';

const ctx: PlotContext = { modalityConfidence: 82, seed: 'run-123' };

describe('plotMapPerception', () => {
  it('includes subject point with flag and no jitter collisions', () => {
    const competitors: Competitor[] = [
      { name: 'SubjectCo', domain: 'subject.co', classification: 'subject', brandRecognition: 70, pricePositioning: 'mid', geographicReach: 'regional' },
      { name: 'Retail Giant', domain: 'retail.com', classification: 'primary', isRetailer: true, isServiceProvider: true, geographicReach: 'national', pricePositioning: 'mid', brandRecognition: 80, overlapScore: 70 },
      { name: 'InstallerPro', domain: 'install.com', classification: 'primary', isServiceProvider: true, geographicReach: 'regional', pricePositioning: 'premium', brandRecognition: 55, overlapScore: 65 },
    ];

    const points = computePerceptionCoordinatesBatch(competitors, ctx);
    const subject = points.find(p => p.domain === 'subject.co');
    expect(subject).toBeDefined();
    expect(subject?.isSubject).toBe(true);
    // subject should keep reasonable mid-range coordinates
    expect(subject?.x).toBeGreaterThan(30);
    expect(subject?.x).toBeLessThan(80);
    expect(subject?.y).toBeGreaterThan(30);
  });

  it('maps price and brand using updated formula', () => {
    const budget: Competitor = { name: 'Budget', domain: 'budget.com', classification: 'primary', pricePositioning: 'budget', brandRecognition: 30, geographicReach: 'local' };
    const premium: Competitor = { name: 'Premium', domain: 'premium.com', classification: 'primary', pricePositioning: 'premium', brandRecognition: 80, geographicReach: 'national' };

    const [pBudget, pPremium] = computePerceptionCoordinatesBatch([budget, premium], ctx);
    expect(pBudget.x).toBeLessThan(pPremium.x);
    expect(pPremium.y).toBeGreaterThan(pBudget.y);
  });

  it('applies collision separation deterministically', () => {
    const a: Competitor = { name: 'A', domain: 'a.com', classification: 'primary', pricePositioning: 'mid', brandRecognition: 50, geographicReach: 'regional' };
    const b: Competitor = { name: 'B', domain: 'b.com', classification: 'primary', pricePositioning: 'mid', brandRecognition: 50, geographicReach: 'regional' };

    const [pa, pb] = computePerceptionCoordinatesBatch([a, b], ctx);
    const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
    expect(dist).toBeGreaterThan(0.5);
  });
});

