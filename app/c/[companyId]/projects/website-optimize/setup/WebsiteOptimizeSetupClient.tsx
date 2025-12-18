'use client';

// app/c/[companyId]/projects/website-optimize/setup/WebsiteOptimizeSetupClient.tsx
// Website Optimization Setup Client Component
//
// Shows:
// 1. Domain coverage status for website optimization (informational)
// 2. Two execution paths:
//    - Generate Recommendations (AI discovery)
//    - Prescribe Work (skip AI, create work directly)

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Loader2,
  ClipboardEdit,
  Sparkles,
} from 'lucide-react';
import type { FlowReadiness } from '@/lib/os/flow/readiness.shared';
import { ReadinessGateModal } from '@/components/flows/ReadinessGateModal';
import { LowConfidenceBadge } from '@/components/flows/LowConfidenceBadge';
import {
  PrescribeWorkModal,
  type PrescribedWorkData,
} from '@/components/flows/PrescribeWorkModal';

interface WebsiteOptimizeSetupClientProps {
  companyId: string;
  companyName: string;
  hasContextGraph: boolean;
  readiness: FlowReadiness | null;
}

export function WebsiteOptimizeSetupClient({
  companyId,
  companyName,
  hasContextGraph,
  readiness,
}: WebsiteOptimizeSetupClientProps) {
  const router = useRouter();
  const [showGateModal, setShowGateModal] = useState(false);
  const [showPrescribeModal, setShowPrescribeModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);

  // If we proceeded with missing domains, track them
  const [proceededMissingDomains, setProceededMissingDomains] = useState<string[]>([]);

  const isReady = readiness?.isReady ?? false;
  const canProceedAnyway = readiness?.canProceedAnyway ?? false;
  const missingCritical = readiness?.missingCritical ?? [];
  const missingRecommended = readiness?.missingRecommended ?? [];

  const handleStartGeneration = useCallback(async () => {
    // If not ready, show gate modal
    if (!isReady && !acknowledgedRisks) {
      setShowGateModal(true);
      return;
    }

    // Track what was missing when we proceeded
    if (!isReady) {
      setProceededMissingDomains(missingCritical.map(r => r.domain));
    }

    setGenerating(true);
    try {
      // Navigate to the generation page with context
      router.push(`/c/${companyId}/projects/website-optimize/generate`);
    } catch (error) {
      console.error('[WebsiteOptimizeSetup] Generation error:', error);
      setGenerating(false);
    }
  }, [companyId, router, isReady, acknowledgedRisks, missingCritical]);

  const handleProceedAnyway = useCallback(() => {
    setAcknowledgedRisks(true);
    setShowGateModal(false);
    // Auto-start generation after acknowledging
    setProceededMissingDomains(missingCritical.map(r => r.domain));
    setGenerating(true);
    router.push(`/c/${companyId}/projects/website-optimize/generate`);
  }, [companyId, router, missingCritical]);

  const handleRunLab = useCallback((labKey: string) => {
    setShowGateModal(false);
    const labPath = labKey.replace('_lab', '');
    router.push(`/c/${companyId}/diagnostics/${labPath}`);
  }, [companyId, router]);

  const handlePrescribeWork = useCallback(async (data: PrescribedWorkData) => {
    // Call the API to create work items
    const response = await fetch(`/api/os/companies/${companyId}/work/prescribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        projectContext: 'website_optimization',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create work items');
    }

    const result = await response.json();
    return { workItemId: result.workItem.id };
  }, [companyId]);

  const handlePrescribeComplete = useCallback(() => {
    // Navigate to work tab after creation
    router.push(`/c/${companyId}/work`);
  }, [companyId, router]);

  // No context graph at all
  if (!hasContextGraph) {
    return (
      <div className="space-y-6">
        <BackButton companyId={companyId} />

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            No Context Data Found
          </h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            To use Website Optimization, you need existing company context data.
            Run initial diagnostics first or choose "New Website / Major Redesign" to start fresh.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={`/c/${companyId}/diagnostics`}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-medium transition-all"
            >
              Run Diagnostics
            </Link>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton companyId={companyId} />

      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
              <Globe className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                Website Optimization
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {companyName} - Using existing context
              </p>
            </div>
          </div>
        </div>

        {/* Context Coverage (informational) */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Context Coverage
            </h3>
            <DomainCoverageGrid readiness={readiness} companyId={companyId} />
          </div>

          {/* Readiness Status (informational for both paths) */}
          <div className="pt-4 border-t border-slate-800">
            {isReady ? (
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">
                  All required context is available.
                </span>
              </div>
            ) : canProceedAnyway ? (
              <div className="flex items-center gap-3 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Some context is missing. AI recommendations may be less accurate.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Context is incomplete. You can still prescribe work directly.
                </span>
              </div>
            )}
          </div>

          {/* Low confidence warning if we proceeded with missing data */}
          {proceededMissingDomains.length > 0 && (
            <LowConfidenceBadge
              missingDomains={proceededMissingDomains}
              variant="block"
            />
          )}
        </div>

        {/* Execution Mode Selection */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/30">
          <h3 className="text-sm font-medium text-slate-300 mb-4">
            Choose Your Path
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Generate Recommendations (AI Discovery) */}
            <button
              onClick={handleStartGeneration}
              disabled={generating}
              className={`
                relative p-5 text-left rounded-xl border transition-all group
                ${generating
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:border-purple-500/50 hover:bg-purple-500/5'
                }
              `}
            >
              <div className="flex items-start gap-4">
                <div className={`
                  w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
                  ${generating
                    ? 'bg-purple-500/20'
                    : 'bg-gradient-to-br from-purple-500/20 to-cyan-500/20 group-hover:from-purple-500/30 group-hover:to-cyan-500/30'
                  }
                `}>
                  {generating ? (
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  ) : (
                    <Sparkles className="w-6 h-6 text-purple-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white mb-1">
                    {generating ? 'Generating...' : 'Generate Recommendations'}
                  </div>
                  <p className="text-sm text-slate-400">
                    AI analyzes your website and context to discover optimization opportunities
                  </p>
                  {!isReady && (
                    <p className="text-xs text-amber-400 mt-2">
                      {canProceedAnyway
                        ? 'Will proceed with reduced accuracy'
                        : 'Run Labs first for best results'
                      }
                    </p>
                  )}
                </div>
                <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-transform ${generating ? 'text-purple-400' : 'text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1'}`} />
              </div>

              {/* Primary indicator */}
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300">
                AI Discovery
              </div>
            </button>

            {/* Prescribe Work (Direct) */}
            <button
              onClick={() => setShowPrescribeModal(true)}
              disabled={generating}
              className="relative p-5 text-left rounded-xl border border-slate-700 bg-slate-800/50 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group disabled:opacity-50"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20">
                  <ClipboardEdit className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white mb-1">
                    Prescribe Work
                  </div>
                  <p className="text-sm text-slate-400">
                    Skip AI discovery and directly create work items for known tasks
                  </p>
                  <p className="text-xs text-emerald-400 mt-2">
                    No Labs required · Immediate execution
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0 group-hover:text-emerald-400 group-hover:translate-x-1 transition-transform" />
              </div>

              {/* Secondary indicator */}
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                Direct
              </div>
            </button>
          </div>

          {/* Completeness info */}
          <div className="mt-4 text-xs text-slate-500">
            {readiness && (
              <>
                Context: {readiness.completenessPercent}% complete
                {missingCritical.length > 0 && (
                  <> · {missingCritical.length} critical missing</>
                )}
                {missingRecommended.length > 0 && (
                  <> · {missingRecommended.length} recommended missing</>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Readiness Gate Modal */}
      {readiness && (
        <ReadinessGateModal
          isOpen={showGateModal}
          onClose={() => setShowGateModal(false)}
          onProceed={handleProceedAnyway}
          onRunLab={handleRunLab}
          readiness={readiness}
          companyId={companyId}
        />
      )}

      {/* Prescribe Work Modal */}
      <PrescribeWorkModal
        isOpen={showPrescribeModal}
        onClose={() => setShowPrescribeModal(false)}
        onSubmit={handlePrescribeWork}
        onComplete={handlePrescribeComplete}
        companyId={companyId}
        companyName={companyName}
      />
    </div>
  );
}

// Back button component
function BackButton({ companyId }: { companyId: string }) {
  return (
    <Link
      href={`/c/${companyId}`}
      className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Overview
    </Link>
  );
}

// Domain coverage grid
function DomainCoverageGrid({
  readiness,
  companyId,
}: {
  readiness: FlowReadiness | null;
  companyId: string;
}) {
  if (!readiness) {
    return (
      <div className="text-sm text-slate-500">
        Unable to check context coverage.
      </div>
    );
  }

  const requirements = readiness.requirements;
  const missingCriticalDomains = new Set(readiness.missingCritical.map(r => r.domain));
  const missingRecommendedDomains = new Set(readiness.missingRecommended.map(r => r.domain));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {requirements.map((req) => {
        const isCriticalMissing = missingCriticalDomains.has(req.domain);
        const isRecommendedMissing = missingRecommendedDomains.has(req.domain);
        const isPresent = req.present;

        const labCta = readiness.labCTAs.find(cta => cta.domain === req.domain);

        const statusConfig = isCriticalMissing
          ? { icon: XCircle, bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' }
          : isRecommendedMissing
          ? { icon: AlertTriangle, bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' }
          : { icon: CheckCircle2, bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };

        const Icon = statusConfig.icon;

        const content = (
          <div
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg border
              ${statusConfig.bg} ${statusConfig.border}
              ${labCta && !isPresent ? 'hover:opacity-80 cursor-pointer' : ''}
              transition-opacity
            `}
          >
            <Icon className={`w-4 h-4 ${statusConfig.text}`} />
            <span className={`text-sm ${isPresent ? 'text-slate-300' : statusConfig.text}`}>
              {req.label}
            </span>
          </div>
        );

        if (labCta && !isPresent) {
          return (
            <Link key={req.domain} href={labCta.href}>
              {content}
            </Link>
          );
        }

        return <div key={req.domain}>{content}</div>;
      })}
    </div>
  );
}
