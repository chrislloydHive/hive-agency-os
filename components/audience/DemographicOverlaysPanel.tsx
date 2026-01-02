// components/audience/DemographicOverlaysPanel.tsx
// Demographic Overlays Panel (Inferred) for Audience Lab
//
// DOCTRINE: Demographics are overlays, not facts.
// - Clearly labeled as INFERRED
// - Lower visual weight than core behavioral segments
// - Never displayed before behavioral segments
// - Confidence always shown

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Info, Lightbulb } from 'lucide-react';
import type { DemographicOverlay } from '@/lib/audience/demographicOverlays';
import type { AudienceSegment } from '@/lib/audience/model';

// ============================================================================
// Types
// ============================================================================

interface DemographicOverlaysPanelProps {
  overlays: DemographicOverlay[];
  segments: AudienceSegment[];
  /** Whether to show in collapsed state by default */
  defaultCollapsed?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const colorClass = confidence >= 55 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-500/20 text-slate-400';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {confidence}% confidence
    </span>
  );
}

function InferredBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
      <Lightbulb className="w-3 h-3 mr-1" />
      INFERRED
    </span>
  );
}

function OverlayAttribute({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-slate-500 min-w-[100px]">{label}:</span>
      <span className="text-slate-300">{value}</span>
    </div>
  );
}

function EvidenceItem({ evidence }: { evidence: DemographicOverlay['evidence'][0] }) {
  const typeLabels: Record<string, string> = {
    category: 'Category Signal',
    cta: 'CTA Signal',
    behavior_pattern: 'Behavior Pattern',
    industry_norm: 'Industry Norm',
  };

  return (
    <div className="flex items-start gap-2 text-xs text-slate-500 py-1">
      <span className="text-slate-600 min-w-[100px]">[{typeLabels[evidence.type] || evidence.type}]</span>
      <span>{evidence.snippet}</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DemographicOverlaysPanel({
  overlays,
  segments,
  defaultCollapsed = true,
}: DemographicOverlaysPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [expandedOverlays, setExpandedOverlays] = useState<Set<string>>(new Set());

  // Don't render if no overlays
  if (overlays.length === 0) {
    return null;
  }

  // Get segment name for an overlay
  const getSegmentName = (segmentKey: string): string => {
    const segment = segments.find(s => s.id === segmentKey);
    return segment?.name || segmentKey;
  };

  // Toggle evidence expansion
  const toggleEvidence = (overlayKey: string) => {
    setExpandedOverlays(prev => {
      const next = new Set(prev);
      if (next.has(overlayKey)) {
        next.delete(overlayKey);
      } else {
        next.add(overlayKey);
      }
      return next;
    });
  };

  return (
    <div className="border border-purple-500/20 rounded-lg overflow-hidden bg-slate-900/50">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-purple-500/5 hover:bg-purple-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-purple-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-purple-400" />
          )}
          <span className="text-sm font-medium text-purple-300">
            Demographic Overlays (Inferred)
          </span>
          <span className="text-xs text-slate-500">
            {overlays.length} overlay{overlays.length !== 1 ? 's' : ''}
          </span>
        </div>
        <InferredBadge />
      </button>

      {/* Warning Banner */}
      {!isCollapsed && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">
            These demographics are <strong>inferred</strong> from behavioral patterns, not confirmed facts.
            They require human review before use in targeting. Confidence is capped at 70%.
          </p>
        </div>
      )}

      {/* Overlays List */}
      {!isCollapsed && (
        <div className="divide-y divide-slate-800">
          {overlays.map((overlay) => {
            const segmentName = getSegmentName(overlay.appliesToSegmentKey);
            const isExpanded = expandedOverlays.has(overlay.appliesToSegmentKey);
            const attrs = overlay.inferredAttributes;

            return (
              <div key={overlay.appliesToSegmentKey} className="p-4">
                {/* Overlay Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{segmentName}</span>
                  </div>
                  <ConfidenceBadge confidence={overlay.confidence} />
                </div>

                {/* Attributes */}
                <div className="space-y-1.5 mb-3">
                  {attrs.ageRange && (
                    <OverlayAttribute label="Age Range" value={attrs.ageRange} />
                  )}
                  {attrs.incomeTier && (
                    <OverlayAttribute label="Income Tier" value={attrs.incomeTier} />
                  )}
                  {attrs.householdType && (
                    <OverlayAttribute label="Household" value={attrs.householdType} />
                  )}
                  {attrs.genderSkew && (
                    <OverlayAttribute label="Gender Skew" value={attrs.genderSkew} />
                  )}
                  {attrs.lifestyleContext && (
                    <OverlayAttribute label="Lifestyle" value={attrs.lifestyleContext} />
                  )}
                </div>

                {/* Rationale */}
                <div className="text-xs text-slate-500 mb-2 flex items-start gap-1.5">
                  <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>{overlay.rationale}</span>
                </div>

                {/* Evidence Toggle */}
                {overlay.evidence.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleEvidence(overlay.appliesToSegmentKey)}
                      className="text-xs text-slate-500 hover:text-slate-400 flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      {overlay.evidence.length} evidence item{overlay.evidence.length !== 1 ? 's' : ''}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 pl-4 border-l border-slate-700">
                        {overlay.evidence.map((e, i) => (
                          <EvidenceItem key={i} evidence={e} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Note */}
      {!isCollapsed && (
        <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700 text-xs text-slate-500">
          Demographics are secondary to behavioral segments. Confirm overlays in the Review Queue before use.
        </div>
      )}
    </div>
  );
}
