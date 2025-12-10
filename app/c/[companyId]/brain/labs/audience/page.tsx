// app/c/[companyId]/brain/labs/audience/page.tsx
// Audience Lab Page - Server Component
//
// Interactive workspace for managing audience segments and personas.
// Lives under Brain (not Diagnostics) as it's a modeling workspace, not a run-based diagnostic.

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

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  return {
    title: `Audience Lab | ${company?.name || 'Company'} | Hive OS`,
    description: 'Define and manage audience segments for this company.',
  };
}

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

  // Extract ICP status from signals for UI banner
  const icpStatus = {
    hasCanonicalICP: signals.canonicalICP.hasCanonicalICP,
    primaryAudience: signals.canonicalICP.primaryAudience,
    source: signals.canonicalICP.source,
    isHumanOverride: signals.canonicalICP.isHumanOverride,
  };

  // Check if ICP has been updated since the model was generated
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
          {/* Breadcrumb: Brain → Audience Lab */}
          <nav className="flex items-center gap-2 text-sm text-slate-400">
            <Link
              href={`/c/${companyId}/brain`}
              className="hover:text-slate-300 transition-colors"
            >
              Brain
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300">Audience Lab</span>
          </nav>
          <span className="text-xs font-medium text-slate-500">
            Modeling Workspace
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
