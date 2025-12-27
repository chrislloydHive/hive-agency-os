// components/os/rfp/SubmissionReadinessModal.tsx
// Modal shown before RFP submission/export to ensure risk acknowledgement

import { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Shield,
  FileCheck,
  Wrench,
  Gauge,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react';
import type { BidReadiness, BidRisk } from '@/lib/os/rfp/computeBidReadiness';
import {
  getRecommendationLabel,
  getRecommendationBgClass,
  getBidReadinessSummary,
} from '@/lib/os/rfp/computeBidReadiness';
import type { RelevantInsight } from '@/hooks/useOutcomeInsights';

// ============================================================================
// Types
// ============================================================================

export interface SubmissionSnapshot {
  score: number;
  recommendation: 'go' | 'conditional' | 'no_go';
  summary: string;
  acknowledgedRisks: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  risksAcknowledged: boolean;
  submittedAt: string;
  submittedBy?: string | null;
}

interface SubmissionReadinessModalProps {
  /** The current bid readiness assessment */
  readiness: BidReadiness;
  /** Action being taken - affects button labels */
  action: 'submit' | 'export';
  /** Called when user proceeds with submission */
  onProceed: (snapshot: SubmissionSnapshot) => void;
  /** Called when user wants to go fix issues */
  onFixIssues: () => void;
  /** Called when modal is dismissed without action */
  onClose: () => void;
  /** Loading state for proceed action */
  isLoading?: boolean;
  /** Relevant outcome insights for submission context */
  submissionInsights?: RelevantInsight[];
}

// ============================================================================
// Sub-components
// ============================================================================

function RecommendationBadge({
  recommendation,
  score,
}: {
  recommendation: BidReadiness['recommendation'];
  score: number;
}) {
  const bgClass = getRecommendationBgClass(recommendation);
  const label = getRecommendationLabel(recommendation);

  const icon = {
    go: <CheckCircle2 className="w-5 h-5" />,
    conditional: <AlertCircle className="w-5 h-5" />,
    no_go: <XCircle className="w-5 h-5" />,
  }[recommendation];

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${bgClass}`}>
      {icon}
      <div>
        <span className="font-semibold text-lg">{label}</span>
        <span className="text-sm opacity-75 ml-2">({score}%)</span>
      </div>
    </div>
  );
}

function RiskItem({ risk }: { risk: BidRisk }) {
  const severityColors = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/30',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    low: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  };

  const severityLabels = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  return (
    <div className={`p-3 rounded-lg border ${severityColors[risk.severity]}`}>
      <div className="flex items-start gap-2">
        <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium uppercase">
              {severityLabels[risk.severity]}
            </span>
            <span className="text-xs opacity-75 capitalize">
              {risk.category.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm">{risk.description}</p>
        </div>
      </div>
    </div>
  );
}

function SubmissionInsightCallout({ insights }: { insights: RelevantInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-medium text-indigo-300">Firm Insights</span>
      </div>
      <div className="space-y-2">
        {insights.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            {item.insight.winRateDelta > 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm text-slate-300">
                <span className={item.insight.winRateDelta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {item.insight.winRateDelta > 0 ? '+' : ''}{item.insight.winRateDelta}% win rate
                </span>
                {' '}when <span className="text-slate-200">{item.insight.signal}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {item.relevanceReason} • {item.insight.sampleSize} RFPs analyzed
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SubmissionReadinessModal({
  readiness,
  action,
  onProceed,
  onFixIssues,
  onClose,
  isLoading = false,
  submissionInsights,
}: SubmissionReadinessModalProps) {
  const [risksAcknowledged, setRisksAcknowledged] = useState(false);

  const hasRisks = readiness.topRisks.length > 0;
  const hasCriticalRisks = readiness.topRisks.some(r => r.severity === 'critical');
  const summary = getBidReadinessSummary(readiness);

  // Determine if acknowledgement is required
  const requiresAcknowledgement = hasRisks && readiness.recommendation !== 'go';

  // Can proceed if:
  // - No risks require acknowledgement, OR
  // - Risks have been acknowledged
  const canProceed = !requiresAcknowledgement || risksAcknowledged;

  const actionLabel = action === 'submit' ? 'Submit' : 'Export';
  const actionVerb = action === 'submit' ? 'submission' : 'export';

  const handleProceed = () => {
    const snapshot: SubmissionSnapshot = {
      score: readiness.score,
      recommendation: readiness.recommendation,
      summary,
      acknowledgedRisks: readiness.topRisks.map(r => ({
        category: r.category,
        severity: r.severity,
        description: r.description,
      })),
      risksAcknowledged: requiresAcknowledgement ? risksAcknowledged : true,
      submittedAt: new Date().toISOString(),
    };
    onProceed(snapshot);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Gauge className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {action === 'submit' ? 'Submission' : 'Export'} Readiness Check
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Readiness Badge */}
          <RecommendationBadge
            recommendation={readiness.recommendation}
            score={readiness.score}
          />

          {/* Summary */}
          <p className="text-sm text-slate-300">{summary}</p>

          {/* Unreliable Assessment Warning */}
          {!readiness.isReliableAssessment && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-400">
                Limited data available for assessment. Consider completing more sections before {actionVerb}.
              </p>
            </div>
          )}

          {/* Risks */}
          {hasRisks && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">
                Outstanding Risks ({readiness.topRisks.length})
              </h3>
              <div className="space-y-2">
                {readiness.topRisks.map((risk, i) => (
                  <RiskItem key={i} risk={risk} />
                ))}
              </div>
            </div>
          )}

          {/* Critical Risk Warning */}
          {hasCriticalRisks && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">
                <strong>Critical risks detected.</strong> Proceeding may significantly impact win probability.
              </p>
            </div>
          )}

          {/* Submission Insights Callout */}
          {submissionInsights && submissionInsights.length > 0 && readiness.recommendation !== 'go' && (
            <SubmissionInsightCallout insights={submissionInsights} />
          )}

          {/* No Risks Message */}
          {!hasRisks && readiness.recommendation === 'go' && (
            <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-400">
                No significant risks identified. You're ready to proceed!
              </p>
            </div>
          )}

          {/* Acknowledgement Checkbox */}
          {requiresAcknowledgement && (
            <label className="flex items-start gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800/80 transition-colors">
              <input
                type="checkbox"
                checked={risksAcknowledged}
                onChange={(e) => setRisksAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
              />
              <span className="text-sm text-slate-300">
                I acknowledge the above risks and choose to proceed with {actionVerb}.
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={onFixIssues}
            className="flex items-center gap-2 px-4 py-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Wrench className="w-4 h-4" />
            Go fix issues
          </button>

          <button
            onClick={handleProceed}
            disabled={!canProceed || isLoading}
            className={`flex items-center gap-2 px-6 py-2 font-medium rounded-lg transition-colors ${
              canProceed && !isLoading
                ? 'bg-purple-500 hover:bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            {isLoading ? 'Processing...' : `Proceed with ${actionLabel.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Hook for managing modal state
// ============================================================================

export interface UseSubmissionGateOptions {
  readiness: BidReadiness | null;
  onSubmit: (snapshot: SubmissionSnapshot) => Promise<void>;
  onFixIssues?: () => void;
}

export interface UseSubmissionGateReturn {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Open the modal for submission action */
  openForSubmit: () => void;
  /** Open the modal for export action */
  openForExport: () => void;
  /** Close the modal */
  close: () => void;
  /** The modal component props */
  modalProps: Omit<SubmissionReadinessModalProps, 'readiness'> | null;
  /** Whether submission is in progress */
  isSubmitting: boolean;
}

export function useSubmissionGate({
  readiness,
  onSubmit,
  onFixIssues,
}: UseSubmissionGateOptions): UseSubmissionGateReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState<'submit' | 'export'>('submit');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openForSubmit = () => {
    setAction('submit');
    setIsOpen(true);
  };

  const openForExport = () => {
    setAction('export');
    setIsOpen(true);
  };

  const close = () => {
    if (!isSubmitting) {
      setIsOpen(false);
    }
  };

  const handleProceed = async (snapshot: SubmissionSnapshot) => {
    setIsSubmitting(true);
    try {
      await onSubmit(snapshot);
      setIsOpen(false);
    } catch (err) {
      console.error('Submission failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFixIssues = () => {
    setIsOpen(false);
    onFixIssues?.();
  };

  const modalProps = isOpen && readiness ? {
    action,
    onProceed: handleProceed,
    onFixIssues: handleFixIssues,
    onClose: close,
    isLoading: isSubmitting,
  } : null;

  return {
    isOpen,
    openForSubmit,
    openForExport,
    close,
    modalProps,
    isSubmitting,
  };
}
