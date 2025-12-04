// app/c/[companyId]/media/program/page.tsx
// Media Program Page - Setup, Review & Activate, and Dashboard for media programs
//
// Modes:
//   1. "review-activate" - Program was created from Media Lab plan (shows review UI)
//   2. "manual" - Direct setup without Media Lab (shows manual setup form)
//   3. "dashboard" - Program already exists and is active (shows dashboard)
//
// The mode is determined by:
//   - If ?programId or program.sourceMediaPlanId exists → review-activate
//   - If no program exists → manual setup
//   - If program exists and is active → dashboard

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getMediaProgram } from '@/lib/media/programs';
import { getMediaPlanById } from '@/lib/airtable/mediaLab';
import { MediaProgramClient } from './MediaProgramClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ programId?: string; mediaPlanId?: string }>;
}

export default async function MediaProgramPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { programId, mediaPlanId } = await searchParams;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Fetch media program
  const program = await getMediaProgram(companyId);

  // Determine if this is a review-activate flow from Media Lab
  const sourceMediaPlanId = program?.sourceMediaPlanId || mediaPlanId;

  // Fetch source plan if available (for review-activate mode)
  let sourcePlan = null;
  if (sourceMediaPlanId) {
    try {
      sourcePlan = await getMediaPlanById(sourceMediaPlanId);
    } catch (error) {
      console.error('[MediaProgram] Failed to fetch source plan:', error);
    }
  }

  // Determine mode
  const mode: 'review-activate' | 'manual' | 'dashboard' =
    program && program.status === 'active' ? 'dashboard' :
    sourceMediaPlanId ? 'review-activate' :
    'manual';

  return (
    <div className="space-y-6">
      {/* Header with back link */}
      <div className="flex items-center gap-3">
        <Link
          href={`/c/${companyId}/media`}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Media
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm text-slate-200">
          {mode === 'review-activate' ? 'Review & Activate' : 'Program'}
        </span>
      </div>

      {/* Main content */}
      <MediaProgramClient
        companyId={companyId}
        companyName={company.name}
        initialProgram={program}
        mode={mode}
        sourcePlan={sourcePlan}
      />
    </div>
  );
}
