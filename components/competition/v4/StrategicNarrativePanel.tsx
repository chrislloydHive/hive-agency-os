// components/competition/v4/StrategicNarrativePanel.tsx
// Strategic narrative panel for Competition Lab V4
//
// Generates dynamic narrative from V4 data that answers:
// - Who actually threatens installs?
// - Who pressures pricing?
// - Who shapes customer expectations?
// - Where is the company structurally advantaged?
//
// Derives insights from tier distribution, modality, geographic overlap,
// and presence of national vs local competitors.

'use client';

import { useMemo } from 'react';
import type {
  CompetitionV4Result,
  ScoredCompetitor,
} from '@/lib/competition-v4/types';

// ============================================================================
// Types
// ============================================================================

interface Props {
  data: CompetitionV4Result;
  companyName: string;
}

interface NarrativeSection {
  id: string;
  question: string;
  answer: string;
  competitors: Array<{
    name: string;
    role: string;
  }>;
  severity: 'low' | 'moderate' | 'high';
}

interface StructuralAdvantage {
  area: string;
  description: string;
  confidence: 'strong' | 'moderate' | 'weak';
}

// ============================================================================
// Narrative Generation Functions
// ============================================================================

function generateInstallationThreats(
  primary: ScoredCompetitor[],
  contextual: ScoredCompetitor[],
  companyName: string
): NarrativeSection {
  // Filter competitors with installation capability
  const installationCompetitors = primary.filter(
    c => c.hasInstallation || c.signalsUsed?.installationCapability
  );
  const highOverlapInstallers = installationCompetitors.filter(
    c => c.overlapScore >= 60
  );

  let answer: string;
  let severity: 'low' | 'moderate' | 'high';

  if (highOverlapInstallers.length >= 3) {
    answer = `${companyName} faces significant installation competition from ${highOverlapInstallers.length} direct competitors with high service overlap. These competitors are actively competing for the same installation jobs in the same markets.`;
    severity = 'high';
  } else if (installationCompetitors.length >= 2) {
    answer = `${companyName} has ${installationCompetitors.length} competitors with installation capabilities. While competition exists, differentiation through service quality and expertise can create defensible positioning.`;
    severity = 'moderate';
  } else if (installationCompetitors.length === 1) {
    answer = `Limited installation competition exists. ${installationCompetitors[0]?.name || 'One competitor'} is the primary installation threat. ${companyName} has opportunity to establish market leadership through service differentiation.`;
    severity = 'low';
  } else {
    answer = `No direct installation competitors identified in primary tier. ${companyName} may have a structural advantage in installation services, though contextual competitors or big-box retailers may still influence customer expectations.`;
    severity = 'low';
  }

  return {
    id: 'installation-threats',
    question: 'Who actually threatens installs?',
    answer,
    competitors: installationCompetitors.slice(0, 4).map(c => ({
      name: c.name,
      role: c.overlapScore >= 60 ? 'High threat' : 'Moderate threat',
    })),
    severity,
  };
}

function generatePricingPressure(
  primary: ScoredCompetitor[],
  contextual: ScoredCompetitor[],
  companyName: string
): NarrativeSection {
  // Identify pricing pressure sources
  const allCompetitors = [...primary, ...contextual];
  const budgetCompetitors = allCompetitors.filter(c => c.pricePositioning === 'budget');
  const majorRetailers = allCompetitors.filter(c => c.isMajorRetailer);
  const nationalPlayers = allCompetitors.filter(c => c.hasNationalReach);

  const pressureSources: string[] = [];
  const competitors: Array<{ name: string; role: string }> = [];

  if (majorRetailers.length > 0) {
    pressureSources.push(
      `${majorRetailers.length} major retailer${majorRetailers.length > 1 ? 's' : ''} with significant purchasing power`
    );
    majorRetailers.slice(0, 2).forEach(c => {
      competitors.push({ name: c.name, role: 'Retail pricing anchor' });
    });
  }

  if (budgetCompetitors.length > 0) {
    pressureSources.push(
      `${budgetCompetitors.length} budget-positioned competitor${budgetCompetitors.length > 1 ? 's' : ''}`
    );
    budgetCompetitors.slice(0, 2).forEach(c => {
      if (!competitors.find(x => x.name === c.name)) {
        competitors.push({ name: c.name, role: 'Budget positioning' });
      }
    });
  }

  if (nationalPlayers.length > 0 && !majorRetailers.some(r => nationalPlayers.includes(r))) {
    pressureSources.push(
      `${nationalPlayers.length} national player${nationalPlayers.length > 1 ? 's' : ''} with scale economics`
    );
  }

  let answer: string;
  let severity: 'low' | 'moderate' | 'high';

  if (majorRetailers.length >= 2 || budgetCompetitors.length >= 3) {
    answer = `Significant pricing pressure from ${pressureSources.join(' and ')}. ${companyName} must compete on value-added services rather than price, or risk margin erosion.`;
    severity = 'high';
  } else if (pressureSources.length > 0) {
    answer = `Moderate pricing pressure from ${pressureSources.join(' and ')}. ${companyName} has room for premium positioning but must clearly articulate value differentiation.`;
    severity = 'moderate';
  } else {
    answer = `Limited pricing pressure identified in the competitive landscape. ${companyName} has pricing flexibility, though customer expectations from adjacent markets may still influence willingness to pay.`;
    severity = 'low';
  }

  return {
    id: 'pricing-pressure',
    question: 'Who pressures pricing?',
    answer,
    competitors: competitors.slice(0, 4),
    severity,
  };
}

function generateExpectationShaping(
  primary: ScoredCompetitor[],
  contextual: ScoredCompetitor[],
  companyName: string
): NarrativeSection {
  const allCompetitors = [...primary, ...contextual];

  // Premium and high-trust brands shape expectations
  const premiumBrands = allCompetitors.filter(
    c => c.pricePositioning === 'premium' || (c.brandTrustScore && c.brandTrustScore >= 70)
  );
  const nationalBrands = allCompetitors.filter(c => c.hasNationalReach || c.isMajorRetailer);
  const highConfidence = allCompetitors.filter(c => (c.confidence || 0) >= 70);

  const competitors: Array<{ name: string; role: string }> = [];

  nationalBrands.slice(0, 2).forEach(c => {
    competitors.push({ name: c.name, role: 'National brand standard' });
  });

  premiumBrands.filter(c => !nationalBrands.includes(c)).slice(0, 2).forEach(c => {
    competitors.push({ name: c.name, role: 'Premium experience anchor' });
  });

  let answer: string;
  let severity: 'low' | 'moderate' | 'high';

  if (nationalBrands.length >= 2) {
    answer = `Customer expectations are heavily shaped by national brands like ${nationalBrands.slice(0, 2).map(c => c.name).join(' and ')}. ${companyName} must meet or exceed these baseline expectations while differentiating on local expertise and personalized service.`;
    severity = 'high';
  } else if (premiumBrands.length >= 2 || nationalBrands.length === 1) {
    answer = `Market expectations influenced by ${premiumBrands.length + nationalBrands.length} established brand${(premiumBrands.length + nationalBrands.length) > 1 ? 's' : ''}. ${companyName} should leverage local relationships and specialized expertise to exceed commoditized service expectations.`;
    severity = 'moderate';
  } else {
    answer = `No dominant expectation-setting competitors identified. ${companyName} has opportunity to define service standards in this market through consistent quality delivery.`;
    severity = 'low';
  }

  return {
    id: 'expectations',
    question: 'Who shapes customer expectations?',
    answer,
    competitors: competitors.slice(0, 4),
    severity,
  };
}

function generateStructuralAdvantages(
  data: CompetitionV4Result,
  companyName: string
): StructuralAdvantage[] {
  const advantages: StructuralAdvantage[] = [];
  const sc = data.scoredCompetitors;
  if (!sc) return advantages;

  const primary = sc.primary || [];
  const contextual = sc.contextual || [];
  const allCompetitors = [...primary, ...contextual];
  const decomposition = data.decomposition;

  // Geographic advantage
  const localScope = decomposition?.geographic_scope === 'Local' || decomposition?.geographic_scope === 'Regional';
  const nationalCompetitors = allCompetitors.filter(c => c.hasNationalReach);
  const localCompetitors = primary.filter(c => c.isLocal || c.signalsUsed?.geographicOverlap === 'local');

  if (localScope && nationalCompetitors.length > localCompetitors.length) {
    advantages.push({
      area: 'Local Market Knowledge',
      description: `As a ${decomposition?.geographic_scope?.toLowerCase()} player competing against ${nationalCompetitors.length} national brands, ${companyName} can leverage deep local relationships, faster response times, and market-specific expertise.`,
      confidence: 'strong',
    });
  }

  // Installation expertise advantage
  const nonInstallers = primary.filter(c => !c.hasInstallation);
  if (nonInstallers.length > primary.length / 2) {
    advantages.push({
      area: 'Installation Expertise',
      description: `${Math.round((nonInstallers.length / Math.max(primary.length, 1)) * 100)}% of primary competitors lack installation capabilities. ${companyName}'s service expertise creates a differentiated value proposition.`,
      confidence: nonInstallers.length > 2 ? 'strong' : 'moderate',
    });
  }

  // Install-first differentiation advantage
  const serviceOriented = decomposition?.economic_model === 'Service';
  const productFocusedCompetitors = allCompetitors.filter(c => !c.hasInstallation && !c.signalsUsed?.serviceOverlap);
  if (serviceOriented && productFocusedCompetitors.length >= 2) {
    advantages.push({
      area: 'Install-First Advantage',
      description: `While ${productFocusedCompetitors.length} competitors focus primarily on product sales, ${companyName}'s installation-focused model creates opportunity for higher-margin, relationship-based business.`,
      confidence: 'moderate',
    });
  }

  // Specialization advantage
  if (primary.length <= 3 && data.category) {
    advantages.push({
      area: 'Category Specialization',
      description: `Limited direct competition (${primary.length} primary competitors) in the ${data.category.category_name} category suggests ${companyName} operates in a defensible niche.`,
      confidence: primary.length <= 2 ? 'strong' : 'moderate',
    });
  }

  // Add a default if no advantages found
  if (advantages.length === 0) {
    advantages.push({
      area: 'Market Position',
      description: `${companyName} operates in a competitive market. Focus on service quality, customer relationships, and operational excellence to build defensible positioning.`,
      confidence: 'weak',
    });
  }

  return advantages;
}

// ============================================================================
// Sub-components
// ============================================================================

function NarrativeCard({ section }: { section: NarrativeSection }) {
  const severityColors = {
    low: 'border-emerald-500/30 bg-emerald-500/5',
    moderate: 'border-amber-500/30 bg-amber-500/5',
    high: 'border-red-500/30 bg-red-500/5',
  };

  const severityBadge = {
    low: 'bg-emerald-500/20 text-emerald-400',
    moderate: 'bg-amber-500/20 text-amber-400',
    high: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className={`border rounded-lg p-5 ${severityColors[section.severity]}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white">{section.question}</h4>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityBadge[section.severity]}`}>
          {section.severity}
        </span>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed mb-4">{section.answer}</p>

      {section.competitors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {section.competitors.map((c, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50"
            >
              <span className="text-xs text-white font-medium">{c.name}</span>
              <span className="text-[10px] text-slate-500">{c.role}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AdvantageCard({ advantage }: { advantage: StructuralAdvantage }) {
  const confidenceColors = {
    strong: 'border-emerald-500/50 bg-emerald-500/10',
    moderate: 'border-blue-500/50 bg-blue-500/10',
    weak: 'border-slate-500/50 bg-slate-500/10',
  };

  const confidenceBadge = {
    strong: 'bg-emerald-500/20 text-emerald-400',
    moderate: 'bg-blue-500/20 text-blue-400',
    weak: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <div className={`border rounded-lg p-4 ${confidenceColors[advantage.confidence]}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-white">{advantage.area}</h4>
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${confidenceBadge[advantage.confidence]}`}>
          {advantage.confidence}
        </span>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{advantage.description}</p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategicNarrativePanel({ data, companyName }: Props) {
  const { narratives, advantages } = useMemo(() => {
    const sc = data.scoredCompetitors;
    if (!sc) {
      return { narratives: [], advantages: [] };
    }

    const primary = sc.primary || [];
    const contextual = sc.contextual || [];

    const narratives: NarrativeSection[] = [
      generateInstallationThreats(primary, contextual, companyName),
      generatePricingPressure(primary, contextual, companyName),
      generateExpectationShaping(primary, contextual, companyName),
    ];

    const advantages = generateStructuralAdvantages(data, companyName);

    return { narratives, advantages };
  }, [data, companyName]);

  if (narratives.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>Insufficient data to generate strategic narrative.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Strategic Questions Section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Story of the Landscape</h3>
            <p className="text-xs text-slate-400">Strategic analysis derived from competitive data</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {narratives.map(section => (
            <NarrativeCard key={section.id} section={section} />
          ))}
        </div>
      </div>

      {/* Structural Advantages Section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Structural Advantages</h3>
            <p className="text-xs text-slate-400">Where {companyName} can win</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {advantages.map((advantage, idx) => (
            <AdvantageCard key={idx} advantage={advantage} />
          ))}
        </div>
      </div>
    </div>
  );
}
