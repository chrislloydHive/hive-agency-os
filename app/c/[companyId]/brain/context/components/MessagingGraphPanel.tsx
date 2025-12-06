// app/c/[companyId]/brain/context/components/MessagingGraphPanel.tsx
// Messaging Graph Panel for Brain → Context page
//
// Displays:
// - Core value proposition with edit capability
// - Key pillars visualization
// - Supporting points and proof points
// - Feature-to-benefit mapping
// - Tagline variants
// - Segment-specific messaging cards

'use client';

import { useState, useCallback } from 'react';
import type { MessagingArchitecture, SegmentMessage } from '@/lib/contextGraph/domains/creative';

// ============================================================================
// Types
// ============================================================================

interface MessagingGraphPanelProps {
  companyId: string;
  messaging: MessagingArchitecture | null;
  segmentMessages: Record<string, SegmentMessage> | null;
  onUpdate?: (path: string, value: unknown) => Promise<void>;
  readOnly?: boolean;
}

// ============================================================================
// Pillar Card Component
// ============================================================================

function PillarCard({
  pillar,
  index,
  supportingPoints,
}: {
  pillar: string;
  index: number;
  supportingPoints: string[];
}) {
  const colors = [
    'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    'from-purple-500/20 to-pink-500/20 border-purple-500/30',
    'from-amber-500/20 to-orange-500/20 border-amber-500/30',
    'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
    'from-red-500/20 to-rose-500/20 border-red-500/30',
  ];
  const colorClass = colors[index % colors.length];

  return (
    <div className={`p-4 rounded-lg bg-gradient-to-br ${colorClass} border`}>
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-slate-800/50 flex items-center justify-center text-xs font-bold text-slate-300">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-slate-100">{pillar}</h4>
          {supportingPoints.length > 0 && (
            <ul className="mt-2 space-y-1">
              {supportingPoints.map((point, idx) => (
                <li key={idx} className="text-xs text-slate-400 flex items-start gap-1.5">
                  <span className="text-slate-500 mt-0.5">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Proof Point Badge
// ============================================================================

function ProofPointBadge({ point }: { point: string }) {
  return (
    <div className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg">
      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-xs text-slate-300">{point}</span>
    </div>
  );
}

// ============================================================================
// Feature Benefit Card
// ============================================================================

function FeatureBenefitCard({
  feature,
  benefit,
  forSegment,
}: {
  feature: string;
  benefit: string;
  forSegment: string | null;
}) {
  return (
    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">Feature</span>
        {forSegment && (
          <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
            {forSegment}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-slate-200 mb-1">{feature}</p>
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span className="text-emerald-400">{benefit}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Segment Message Card
// ============================================================================

function SegmentMessageCard({
  segmentName,
  message,
}: {
  segmentName: string;
  message: SegmentMessage;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h4 className="text-sm font-medium text-slate-100">{segmentName}</h4>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{message.valueProp}</p>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 pt-4 border-t border-slate-700/50">
          {/* Value Prop */}
          <div>
            <h5 className="text-xs font-medium text-slate-400 mb-1">Value Proposition</h5>
            <p className="text-sm text-slate-200">{message.valueProp}</p>
          </div>

          {/* Pains Addressed */}
          {message.painsAddressed.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-slate-400 mb-2">Pains Addressed</h5>
              <div className="flex flex-wrap gap-1.5">
                {message.painsAddressed.map((pain, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded">
                    {pain}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Outcomes */}
          {message.outcomes.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-slate-400 mb-2">Desired Outcomes</h5>
              <div className="flex flex-wrap gap-1.5">
                {message.outcomes.map((outcome, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded">
                    {outcome}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Example Headlines */}
          {message.exampleHeadlines.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-slate-400 mb-2">Example Headlines</h5>
              <ul className="space-y-1">
                {message.exampleHeadlines.map((headline, idx) => (
                  <li key={idx} className="text-sm text-slate-300 italic">"{headline}"</li>
                ))}
              </ul>
            </div>
          )}

          {/* CTAs */}
          {message.ctas.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-slate-400 mb-2">CTAs</h5>
              <div className="flex flex-wrap gap-2">
                {message.ctas.map((cta, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30"
                  >
                    {cta}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Objections */}
          {Object.keys(message.objections).length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-slate-400 mb-2">Objection Handling</h5>
              <div className="space-y-2">
                {Object.entries(message.objections).map(([objection, response], idx) => (
                  <div key={idx} className="text-xs">
                    <p className="text-amber-400">"{objection}"</p>
                    <p className="text-slate-300 mt-0.5 ml-4">→ {response}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MessagingGraphPanel({
  companyId,
  messaging,
  segmentMessages,
  onUpdate,
  readOnly = false,
}: MessagingGraphPanelProps) {
  if (!messaging) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-8 text-center">
        <div className="p-3 rounded-full bg-blue-500/10 w-fit mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-200 mb-2">No Messaging Architecture</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Run Creative Lab to generate your messaging architecture including core value proposition,
          key pillars, proof points, and segment-specific messaging.
        </p>
      </div>
    );
  }

  const segmentEntries = segmentMessages ? Object.entries(segmentMessages) : [];

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Messaging Architecture</h3>
            <p className="text-xs text-slate-400">
              {messaging.keyPillars?.length || 0} pillars, {messaging.proofPoints.length} proof points
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Core Value Proposition */}
        <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-lg border border-emerald-500/20">
          <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-2">
            Core Value Proposition
          </h4>
          <p className="text-lg font-medium text-slate-100">{messaging.coreValueProp}</p>
        </div>

        {/* Key Pillars */}
        {messaging.keyPillars && messaging.keyPillars.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
              Key Messaging Pillars
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {messaging.keyPillars.map((pillar, idx) => (
                <PillarCard
                  key={idx}
                  pillar={pillar}
                  index={idx}
                  supportingPoints={messaging.supportingPoints.slice(idx * 2, idx * 2 + 2)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Proof Points */}
        {messaging.proofPoints.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
              Proof Points
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {messaging.proofPoints.map((point, idx) => (
                <ProofPointBadge key={idx} point={point} />
              ))}
            </div>
          </div>
        )}

        {/* Differentiators */}
        {messaging.differentiators.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
              Differentiators
            </h4>
            <div className="flex flex-wrap gap-2">
              {messaging.differentiators.map((diff, idx) => (
                <span
                  key={idx}
                  className="text-xs px-3 py-1.5 bg-purple-500/10 text-purple-300 rounded-full border border-purple-500/30"
                >
                  {diff}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tagline Variants */}
        {messaging.taglineVariants && messaging.taglineVariants.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
              Tagline Variants
            </h4>
            <div className="space-y-2">
              {messaging.taglineVariants.map((tagline, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-800/50 rounded-lg border-l-2 border-amber-500/50"
                >
                  <p className="text-sm text-slate-200 italic">"{tagline}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature to Benefit Map */}
        {messaging.featureToBenefitMap && messaging.featureToBenefitMap.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
              Feature → Benefit Map
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {messaging.featureToBenefitMap.map((item, idx) => (
                <FeatureBenefitCard
                  key={idx}
                  feature={item.feature}
                  benefit={item.benefit}
                  forSegment={item.forSegment}
                />
              ))}
            </div>
          </div>
        )}

        {/* Segment Messages */}
        {segmentEntries.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
              Segment-Specific Messaging
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {segmentEntries.map(([segmentName, message]) => (
                <SegmentMessageCard
                  key={segmentName}
                  segmentName={segmentName}
                  message={message}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
