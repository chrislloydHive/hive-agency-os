'use client';

// components/programs/WebsiteProgramGateBanner.tsx
// Banner displayed on planner pages when no active Website Program exists
//
// Usage: Add this component to any Website Planner page to enforce program-first workflow

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Layers } from 'lucide-react';
import Link from 'next/link';

interface WebsiteProgramGateBannerProps {
  companyId: string;
}

interface ProgramStatus {
  hasActiveProgram: boolean;
  hasDraftProgram: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Banner that checks for an active Website Program and shows a warning if none exists.
 * Add this to Website Planner pages to enforce the program-first workflow.
 */
export function WebsiteProgramGateBanner({ companyId }: WebsiteProgramGateBannerProps) {
  const [status, setStatus] = useState<ProgramStatus>({
    hasActiveProgram: false,
    hasDraftProgram: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function checkProgram() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/programs?type=website`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check program status');
        }

        const programs = data.programs || [];
        const activeProgram = programs.find((p: { status: string }) => p.status === 'active');
        const draftProgram = programs.find((p: { status: string }) => p.status === 'draft');

        setStatus({
          hasActiveProgram: !!activeProgram,
          hasDraftProgram: !!draftProgram,
          loading: false,
          error: null,
        });
      } catch (err) {
        setStatus({
          hasActiveProgram: false,
          hasDraftProgram: false,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to check program status',
        });
      }
    }

    checkProgram();
  }, [companyId]);

  // Don't show anything while loading
  if (status.loading) {
    return null;
  }

  // Don't show banner if there's an active program
  if (status.hasActiveProgram) {
    return null;
  }

  // Show banner when no active program exists
  return (
    <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-800/50 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-amber-200 font-medium mb-1">
            No Active Website Program
          </h3>
          <p className="text-amber-300/80 text-sm mb-3">
            {status.hasDraftProgram
              ? 'A draft Website Program exists but is not active. Activate it to set priorities before planning website work.'
              : 'Create and activate a Website Program to set priorities before planning website work.'}
          </p>
          <Link
            href={`/c/${companyId}/strategy/programs`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Layers className="w-4 h-4" />
            {status.hasDraftProgram ? 'Activate Program' : 'Create Website Program'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Server-side check for active website program
 * Use this in page.tsx to pre-check program status
 */
export async function checkWebsiteProgramStatus(companyId: string): Promise<{
  hasActiveProgram: boolean;
  hasDraftProgram: boolean;
}> {
  try {
    const { getActiveProgramForCompany, getProgramsForCompany } = await import(
      '@/lib/airtable/programs'
    );

    const [activeProgram, allPrograms] = await Promise.all([
      getActiveProgramForCompany(companyId, 'website'),
      getProgramsForCompany(companyId, 'website'),
    ]);

    return {
      hasActiveProgram: !!activeProgram,
      hasDraftProgram: allPrograms.some(p => p.status === 'draft'),
    };
  } catch {
    return {
      hasActiveProgram: false,
      hasDraftProgram: false,
    };
  }
}
