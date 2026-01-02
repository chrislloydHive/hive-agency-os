// components/competition/v4/CompetitiveContextBanner.tsx
// Top-level competitive context banner for Competition Lab V4
//
// AUTHORITATIVE MODE:
// - NO user toggles or inputs for competitor inclusion/exclusion
// - System deterministically decides competitor placement
// - Transparency via declarative copy, not user delegation
//
// Product Principle: Hive OS explains competition — it does not ask users to define it.

'use client';

import type {
  CompetitionV4Result,
  CompetitiveModalityType,
} from '@/lib/competition-v4/types';

// ============================================================================
// Types
// ============================================================================

interface Props {
  data: CompetitionV4Result;
}

// ============================================================================
// Helper Components
// ============================================================================

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 80) return 'bg-emerald-500';
    if (confidence >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getLabel = () => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Moderate';
    return 'Low';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className="text-xs text-slate-400">{getLabel()} ({confidence}%)</span>
    </div>
  );
}

function ModalityBadge({ modality }: { modality: CompetitiveModalityType }) {
  const config: Record<CompetitiveModalityType, { label: string; color: string; description: string }> = {
    'InstallationOnly': {
      label: 'Installation-Focused',
      color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      description: 'Customers primarily compare you to other installers and service providers',
    },
    'Retail+Installation': {
      label: 'Retail + Installation',
      color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      description: 'Customers compare you to both retailers and installation specialists',
    },
    'RetailWithInstallAddon': {
      label: 'Retail with Install Add-on',
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      description: 'Primarily retail, with installation as an optional service',
    },
    'ProductOnly': {
      label: 'Product-Only',
      color: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      description: 'Customers compare you to other product sellers (no installation)',
    },
    'InternalAlternative': {
      label: 'Internal Alternative',
      color: 'bg-green-500/20 text-green-300 border-green-500/30',
      description: 'Customers may choose to do it themselves or use internal resources',
    },
  };

  const { label, color, description } = config[modality] || config['InstallationOnly'];

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold border ${color}`}>
        {label}
      </span>
      <span className="text-xs text-slate-500">{description}</span>
    </div>
  );
}

function SignalChip({ signal }: { signal: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 border border-slate-700">
      {signal}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompetitiveContextBanner({ data }: Props) {
  const modalityInference = data.modalityInference;

  // Default values if modality inference not available
  const modality = modalityInference?.modality || 'InstallationOnly';
  const confidence = modalityInference?.confidence || 50;
  const explanation = modalityInference?.explanation || 'Competitive modality inferred from business signals.';
  const signals = modalityInference?.signals || [];

  // Check if retail-hybrid competitors are included contextually
  const hasRetailHybridContextual = data.scoredCompetitors?.contextual?.some(
    c => c.isMajorRetailer && (c.hasInstallation || c.signalsUsed?.serviceOverlap)
  ) || data.scoredCompetitors?.primary?.some(
    c => c.isMajorRetailer && (c.hasInstallation || c.signalsUsed?.serviceOverlap)
  );

  return (
    <div className="border border-slate-700 rounded-lg bg-gradient-to-r from-slate-800/50 to-slate-900/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Competition Mode</h3>
              <p className="text-xs text-slate-400">How customers compare you to alternatives</p>
            </div>
          </div>
          <ConfidenceMeter confidence={confidence} />
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Modality Display */}
        <ModalityBadge modality={modality} />

        {/* Authoritative Explanation */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-sm text-slate-300 leading-relaxed">{explanation}</p>

          {/* Authoritative Mode Statement */}
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Competition mode is inferred from service vs retail signals.
            {hasRetailHybridContextual && ' Retail-hybrid competitors are included contextually when relevant.'}
          </p>
        </div>

        {/* Low Confidence Notice (informational only, no action) */}
        {confidence < 70 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-300">
                Some competitive dynamics are inferred with moderate confidence.
              </p>
            </div>
          </div>
        )}

        {/* Signals */}
        {signals.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 mr-1">Signals:</span>
            {signals.map((signal, idx) => (
              <SignalChip key={idx} signal={signal} />
            ))}
          </div>
        )}
      </div>

      {/* Service/Product Emphasis Bar */}
      {modalityInference && (
        <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-700/50">
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">Competitive Emphasis:</span>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs text-blue-400">Service</span>
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${(modalityInference.serviceEmphasis || 0.5) * 100}%` }}
                />
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{ width: `${(modalityInference.productEmphasis || 0.5) * 100}%` }}
                />
              </div>
              <span className="text-xs text-purple-400">Product</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
