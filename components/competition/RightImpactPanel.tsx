// components/competition/RightImpactPanel.tsx
// Competition Lab v2 - Right Column
//
// Strategic impact panels:
// - Positioning: Market position gaps, differentiation
// - Creative: Messaging themes, creative angles
// - Media & SEO: Share of voice, SERP overlap
// - Offers & Pricing: Price tier analysis, value perception

'use client';

import { useState } from 'react';
import type { ScoredCompetitor, CompetitionRun } from '@/lib/competition/types';

// ============================================================================
// Types
// ============================================================================

type ImpactTab = 'positioning' | 'creative' | 'mediaSeo' | 'offersPricing';

interface Props {
  selectedCompetitor: ScoredCompetitor | null;
  competitors: ScoredCompetitor[];
  run: CompetitionRun | null;
  onCreateWorkItems: (type: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function RightImpactPanel({
  selectedCompetitor,
  competitors,
  run,
  onCreateWorkItems,
}: Props) {
  const [activeTab, setActiveTab] = useState<ImpactTab>('positioning');

  const tabs: { id: ImpactTab; label: string }[] = [
    { id: 'positioning', label: 'Positioning' },
    { id: 'creative', label: 'Creative' },
    { id: 'mediaSeo', label: 'Media & SEO' },
    { id: 'offersPricing', label: 'Offers' },
  ];

  // Calculate some aggregate stats
  const coreCompetitors = competitors.filter((c) => c.role === 'core');
  const highThreatCount = competitors.filter((c) => (c.threatLevel ?? 0) >= 60).length;
  const avgOfferSimilarity = competitors.length > 0
    ? Math.round(competitors.reduce((sum, c) => sum + c.offerSimilarity, 0) / competitors.length)
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-slate-800 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-amber-400 border-amber-400'
                : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'positioning' && (
          <PositioningTab
            selectedCompetitor={selectedCompetitor}
            coreCount={coreCompetitors.length}
            avgOfferSimilarity={avgOfferSimilarity}
            onCreateWorkItems={onCreateWorkItems}
          />
        )}
        {activeTab === 'creative' && (
          <CreativeTab
            selectedCompetitor={selectedCompetitor}
            competitors={competitors}
            onCreateWorkItems={onCreateWorkItems}
          />
        )}
        {activeTab === 'mediaSeo' && (
          <MediaSeoTab
            selectedCompetitor={selectedCompetitor}
            competitors={competitors}
            onCreateWorkItems={onCreateWorkItems}
          />
        )}
        {activeTab === 'offersPricing' && (
          <OffersPricingTab
            selectedCompetitor={selectedCompetitor}
            competitors={competitors}
            onCreateWorkItems={onCreateWorkItems}
          />
        )}
      </div>

      {/* Footer: Recent Changes */}
      <div className="border-t border-slate-800 pt-4 mt-4">
        <p className="text-xs text-slate-500 mb-2">Recent Changes</p>
        <div className="space-y-1">
          {run ? (
            <>
              <p className="text-xs text-slate-400">
                <span className="text-emerald-400">+{competitors.length}</span> competitors discovered
              </p>
              {highThreatCount > 0 && (
                <p className="text-xs text-slate-400">
                  <span className="text-red-400">{highThreatCount}</span> high-threat competitors identified
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500 italic">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Positioning Tab
// ============================================================================

function PositioningTab({
  selectedCompetitor,
  coreCount,
  avgOfferSimilarity,
  onCreateWorkItems,
}: {
  selectedCompetitor: ScoredCompetitor | null;
  coreCount: number;
  avgOfferSimilarity: number;
  onCreateWorkItems: (type: string) => void;
}) {
  // Determine positioning status
  const isCrowded = coreCount >= 3 && avgOfferSimilarity >= 70;
  const isDefensible = coreCount <= 2 && avgOfferSimilarity < 50;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <div className={`rounded-lg border p-4 ${
        isCrowded
          ? 'border-red-500/30 bg-red-500/5'
          : isDefensible
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-amber-500/30 bg-amber-500/5'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            isCrowded
              ? 'bg-red-500/20 text-red-400'
              : isDefensible
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            {isCrowded ? 'Crowded' : isDefensible ? 'Defensible' : 'Competitive'}
          </span>
        </div>
        <p className="text-sm text-slate-300">
          {isCrowded
            ? `You have ${coreCount} core competitors with high offer overlap (${avgOfferSimilarity}% avg). Differentiation is critical.`
            : isDefensible
            ? `Low competitive pressure with only ${coreCount} core competitors. Focus on market expansion.`
            : `Moderate competition with ${coreCount} core competitors. Balance differentiation with growth.`
          }
        </p>
      </div>

      {/* Selected Competitor Insights */}
      {selectedCompetitor ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h4 className="text-sm font-medium text-slate-200 mb-3">
            Positioning vs. {selectedCompetitor.competitorName}
          </h4>
          {selectedCompetitor.enrichedData?.positioning ? (
            <p className="text-sm text-slate-400 mb-3">{selectedCompetitor.enrichedData.positioning}</p>
          ) : (
            <p className="text-sm text-slate-500 italic mb-3">No positioning data available</p>
          )}

          {/* Differentiators */}
          {selectedCompetitor.enrichedData?.differentiators && selectedCompetitor.enrichedData.differentiators.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">Their Differentiators</p>
              <ul className="text-xs text-slate-400 space-y-1">
                {selectedCompetitor.enrichedData.differentiators.map((d, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {selectedCompetitor.enrichedData?.weaknesses && selectedCompetitor.enrichedData.weaknesses.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Their Weaknesses</p>
              <ul className="text-xs text-slate-400 space-y-1">
                {selectedCompetitor.enrichedData.weaknesses.map((w, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-center">
          <p className="text-sm text-slate-500">Select a competitor to see positioning insights</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => onCreateWorkItems('positioning')}
          className="w-full px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors"
        >
          Create Positioning Work Items
        </button>
        <button
          className="w-full px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Update Strategic Map
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Creative Tab
// ============================================================================

function CreativeTab({
  selectedCompetitor,
  competitors,
  onCreateWorkItems,
}: {
  selectedCompetitor: ScoredCompetitor | null;
  competitors: ScoredCompetitor[];
  onCreateWorkItems: (type: string) => void;
}) {
  // Extract common themes from competitors
  const allDifferentiators = competitors.flatMap((c) => c.enrichedData?.differentiators || []);
  const themeCounts: Record<string, number> = {};
  allDifferentiators.forEach((d) => {
    const normalized = d.toLowerCase();
    themeCounts[normalized] = (themeCounts[normalized] || 0) + 1;
  });

  const commonThemes = Object.entries(themeCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme]) => theme);

  return (
    <div className="space-y-4">
      {/* Narrative */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <h4 className="text-sm font-medium text-slate-200 mb-2">Creative Intelligence</h4>
        <p className="text-sm text-slate-400">
          {competitors.length > 0
            ? `Analysis of ${competitors.length} competitors reveals messaging patterns and creative territories to consider.`
            : 'Run competitor discovery to generate creative intelligence insights.'
          }
        </p>
      </div>

      {/* Common Themes */}
      {commonThemes.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h4 className="text-sm font-medium text-slate-200 mb-3">Themes Competitors Use</h4>
          <div className="flex flex-wrap gap-2">
            {commonThemes.map((theme, idx) => (
              <span key={idx} className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">
                {theme}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Consider differentiating from these saturated themes
          </p>
        </div>
      )}

      {/* Selected Competitor Creative */}
      {selectedCompetitor && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h4 className="text-sm font-medium text-slate-200 mb-2">
            {selectedCompetitor.competitorName}&apos;s Messaging
          </h4>
          {selectedCompetitor.enrichedData?.valueProposition ? (
            <p className="text-sm text-slate-400 mb-2">
              &ldquo;{selectedCompetitor.enrichedData.valueProposition}&rdquo;
            </p>
          ) : (
            <p className="text-sm text-slate-500 italic">No value proposition extracted</p>
          )}
          {selectedCompetitor.enrichedData?.tagline && (
            <p className="text-xs text-slate-500">
              Tagline: &ldquo;{selectedCompetitor.enrichedData.tagline}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Suggested Angles */}
      <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
        <h4 className="text-sm font-medium text-purple-400 mb-2">Creative Angles to Own</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-purple-400">•</span>
            Find underused positioning angles that competitors haven&apos;t claimed
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400">•</span>
            Emphasize your unique strengths and differentiators
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400">•</span>
            Target gaps in competitor messaging
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => onCreateWorkItems('creative')}
          className="w-full px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors"
        >
          Push to Creative Brief
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Media & SEO Tab
// ============================================================================

function MediaSeoTab({
  selectedCompetitor,
  competitors,
  onCreateWorkItems,
}: {
  selectedCompetitor: ScoredCompetitor | null;
  competitors: ScoredCompetitor[];
  onCreateWorkItems: (type: string) => void;
}) {
  // Extract channels from competitors
  const allChannels = competitors.flatMap((c) => c.enrichedData?.primaryChannels || []);
  const channelCounts: Record<string, number> = {};
  allChannels.forEach((ch) => {
    const normalized = ch.toLowerCase();
    channelCounts[normalized] = (channelCounts[normalized] || 0) + 1;
  });

  const popularChannels = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <h4 className="text-sm font-medium text-slate-200 mb-2">Share of Voice</h4>
        <p className="text-sm text-slate-400">
          Competitive media and SEO analysis helps identify conquesting opportunities and SERP overlap.
        </p>
      </div>

      {/* Popular Channels */}
      {popularChannels.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h4 className="text-sm font-medium text-slate-200 mb-3">Competitor Channels</h4>
          <div className="space-y-2">
            {popularChannels.map(([channel, count]) => (
              <div key={channel} className="flex items-center justify-between">
                <span className="text-xs text-slate-400 capitalize">{channel}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(count / competitors.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{count}/{competitors.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-2">Opportunities</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            Brand conquesting: Target competitor brand terms in paid search
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            Category terms: Identify high-value terms competitors rank for
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            Content gaps: Create content on topics competitors dominate
          </li>
        </ul>
      </div>

      {/* Selected Competitor */}
      {selectedCompetitor && selectedCompetitor.enrichedData?.primaryChannels && selectedCompetitor.enrichedData.primaryChannels.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h4 className="text-sm font-medium text-slate-200 mb-2">
            {selectedCompetitor.competitorName}&apos;s Channels
          </h4>
          <div className="flex flex-wrap gap-1">
            {selectedCompetitor.enrichedData.primaryChannels.map((ch, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-400">
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => onCreateWorkItems('media')}
          className="w-full px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-colors"
        >
          Create Media/SEO Work Items
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Offers & Pricing Tab
// ============================================================================

function OffersPricingTab({
  selectedCompetitor,
  competitors,
  onCreateWorkItems,
}: {
  selectedCompetitor: ScoredCompetitor | null;
  competitors: ScoredCompetitor[];
  onCreateWorkItems: (type: string) => void;
}) {
  // Group by pricing tier
  const tierCounts: Record<string, number> = {
    budget: 0,
    mid: 0,
    premium: 0,
    enterprise: 0,
  };
  competitors.forEach((c) => {
    const tier = c.enrichedData?.pricingTier;
    if (tier && tier in tierCounts) {
      tierCounts[tier]++;
    }
  });

  return (
    <div className="space-y-4">
      {/* Pricing Landscape */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <h4 className="text-sm font-medium text-slate-200 mb-3">Pricing Landscape</h4>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(tierCounts).map(([tier, count]) => (
            <div key={tier} className="text-center">
              <div className={`text-lg font-bold ${count > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                {count}
              </div>
              <div className="text-[10px] text-slate-500 capitalize">{tier}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Competitor Pricing */}
      {selectedCompetitor && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h4 className="text-sm font-medium text-slate-200 mb-2">
            {selectedCompetitor.competitorName}&apos;s Pricing
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Price Tier</span>
              <span className="text-sm text-slate-300 capitalize">
                {selectedCompetitor.enrichedData?.pricingTier || 'Unknown'}
              </span>
            </div>
            {selectedCompetitor.enrichedData?.pricingModel && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Model</span>
                <span className="text-sm text-slate-300">
                  {selectedCompetitor.enrichedData.pricingModel}
                </span>
              </div>
            )}
            {selectedCompetitor.priceTierOverlap !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Price Similarity</span>
                <span className="text-sm text-slate-300">{selectedCompetitor.priceTierOverlap}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <h4 className="text-sm font-medium text-emerald-400 mb-2">Pricing Strategy</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">•</span>
            Consider premium positioning if competitors cluster at mid-tier
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">•</span>
            Value-add packaging can justify price premium
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">•</span>
            Entry-level offers can capture price-sensitive segments
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => onCreateWorkItems('pricing')}
          className="w-full px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
        >
          Create Pricing Work Items
        </button>
      </div>
    </div>
  );
}
