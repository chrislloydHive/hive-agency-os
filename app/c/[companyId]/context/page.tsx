// app/c/[companyId]/context/page.tsx
// Context Workspace Page
//
// Editable, structured context for a company using the Draftable Resource framework.
//
// Three states handled by useDraftableResource hook:
// A) No prereqs + no saved → shows "Run Diagnostics" button
// B) Prereqs ready + no saved → auto-generates draft, shows form
// C) Saved exists → shows form with "Regenerate from diagnostics" link

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getCompanyContext,
  getBaselineSignalsForCompany,
  getContextDraft,
} from '@/lib/os/context';
import { getDiagnosticsDebugInfo } from '@/lib/os/diagnostics/debugInfo';
import type { CompanyContext } from '@/lib/types/context';
import type { DraftableState, DraftSource } from '@/lib/os/draft/types';
import { ContextWorkspaceClient } from './ContextWorkspaceClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ContextPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company, context, baseline signals, draft, and debug info in parallel
  const [company, savedContext, baselineSignals, contextDraft, debugInfo] = await Promise.all([
    getCompanyById(companyId),
    getCompanyContext(companyId),
    getBaselineSignalsForCompany(companyId),
    getContextDraft(companyId),
    getDiagnosticsDebugInfo(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  // Determine if we have meaningful saved context (more than just companyId)
  const hasSavedContext = savedContext && (
    savedContext.businessModel ||
    savedContext.primaryAudience ||
    (savedContext.objectives && savedContext.objectives.length > 0)
  );

  // Determine if we have baseline data
  const hasBaseline = baselineSignals && (
    baselineSignals.hasLabRuns ||
    baselineSignals.hasFullGap ||
    baselineSignals.hasCompetition ||
    baselineSignals.hasWebsiteMetadata
  );

  // Build DraftableState for the hook
  const draftSource: DraftSource = hasSavedContext ? 'user_saved' :
    contextDraft ? 'ai_draft' : 'system_default';

  const initialState: DraftableState<CompanyContext> = {
    saved: hasSavedContext ? savedContext : null,
    draft: contextDraft?.context ?? null,
    source: draftSource,
    prereqsReady: !!hasBaseline,
  };

  return (
    <div className="space-y-6">
      <ContextWorkspaceClient
        companyId={companyId}
        companyName={company.name}
        initialState={initialState}
        debugInfo={debugInfo}
      />
    </div>
  );
}
