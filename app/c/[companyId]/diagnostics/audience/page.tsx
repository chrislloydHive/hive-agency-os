// app/c/[companyId]/diagnostics/audience/page.tsx
// Audience Lab Page - Server Component
//
// Loads audience signals, current model, personas, and renders the Audience Lab UI.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCurrentAudienceModel } from '@/lib/audience/storage';
import { loadAudienceSignalsForCompany, getSignalsSummary } from '@/lib/audience/signals';
import { getPersonaSet } from '@/lib/audience/personaStorage';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { AudienceLabClient } from './AudienceLabClient';
import { checkCriticalFieldsForFlow } from '@/lib/contextGraph/diagnostics';
import { LabGatingBanner } from '@/components/os/ContextHealthPanel';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function AudienceLabPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Check critical fields for Audience Lab
  const criticalCheck = await checkCriticalFieldsForFlow(companyId, 'AudienceLab');

  // Load data in parallel
  const [currentModel, signals, personaSet, contextGraph] = await Promise.all([
    getCurrentAudienceModel(companyId),
    loadAudienceSignalsForCompany(companyId),
    getPersonaSet(companyId),
    loadContextGraph(companyId),
  ]);

  const signalsSummary = getSignalsSummary(signals);

  // DEBUG: Log the loaded signals to help diagnose data flow issues
  console.log('[AudienceLab Page] Loaded signals for company:', companyId, {
    hasCanonicalICP: signals.canonicalICP.hasCanonicalICP,
    primaryAudience: signals.canonicalICP.primaryAudience?.substring(0, 100),
    coreSegments: signals.canonicalICP.coreSegments,
    demographics: signals.canonicalICP.demographics?.substring?.(0, 50),
    geos: signals.canonicalICP.geos?.substring?.(0, 50),
    painPoints: signals.canonicalICP.painPoints?.slice(0, 2),
    source: signals.canonicalICP.source,
    sourcesAvailable: signals.sourcesAvailable,
    existingAudienceFields: signals.existingAudienceFields ? {
      coreSegments: signals.existingAudienceFields.coreSegments?.slice(0, 2),
      demographics: typeof signals.existingAudienceFields.demographics,
      demographicsValue: signals.existingAudienceFields.demographics?.substring?.(0, 30),
    } : 'missing',
  });

  // Extract ICP status from signals for UI banner
  const icpStatus = {
    hasCanonicalICP: signals.canonicalICP.hasCanonicalICP,
    primaryAudience: signals.canonicalICP.primaryAudience,
    source: signals.canonicalICP.source,
    isHumanOverride: signals.canonicalICP.isHumanOverride,
  };

  // Check if ICP has been updated since the model was generated
  // This helps users know when their segments are out of sync with updated ICP
  //
  // IMPORTANT: Only show warning if the update came from Setup/Brain (user input),
  // NOT if it was updated by Audience Lab itself (that would be circular)
  let icpUpdatedSinceModel = false;
  if (currentModel && contextGraph?.audience) {
    const modelCreatedAt = new Date(currentModel.createdAt).getTime();

    // Sources that indicate user-entered ICP data (not from Audience Lab)
    const userInputSources = ['setup_wizard', 'user', 'manual', 'strategy', 'brain', 'import'];

    // Check provenance timestamps on key ICP fields
    const audienceFields = ['coreSegments', 'primaryAudience', 'demographics', 'geos', 'painPoints'] as const;
    for (const fieldName of audienceFields) {
      const field = contextGraph.audience[fieldName as keyof typeof contextGraph.audience];
      if (field && typeof field === 'object' && 'provenance' in field) {
        const provenance = (field as { provenance?: Array<{ updatedAt?: string; source?: string }> }).provenance;
        if (provenance && provenance.length > 0 && provenance[0].updatedAt) {
          const fieldUpdatedAt = new Date(provenance[0].updatedAt).getTime();
          const source = provenance[0].source || '';

          // Only trigger warning if:
          // 1. Field was updated after model was created
          // 2. Update came from a user-input source (not audience_lab)
          if (fieldUpdatedAt > modelCreatedAt && userInputSources.includes(source)) {
            icpUpdatedSinceModel = true;
            break;
          }
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link
            href={`/c/${companyId}/blueprint`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Blueprint
          </Link>
          <span className="text-xs font-medium text-slate-500">
            Audience Lab
          </span>
        </div>
      </div>

      {/* Gating Banner - soft gate only for Audience Lab */}
      {criticalCheck.gatingLevel === 'soft' && (
        <div className="mx-auto max-w-7xl px-6 py-4">
          <LabGatingBanner
            flowId="AudienceLab"
            gatingLevel={criticalCheck.gatingLevel}
            warningMessage={criticalCheck.warningMessage}
            missingFields={criticalCheck.missingFields.map(f => ({ label: f.label, path: f.path }))}
            companyId={companyId}
          />
        </div>
      )}

      {/* Main Content */}
      <AudienceLabClient
        companyId={companyId}
        companyName={company.name}
        initialModel={currentModel}
        initialPersonaSet={personaSet}
        signals={signals}
        signalsSummary={signalsSummary}
        icpStatus={icpStatus}
        icpUpdatedSinceModel={icpUpdatedSinceModel}
      />
    </div>
  );
}
