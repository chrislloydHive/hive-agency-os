// app/c/[companyId]/strategy/page.tsx
// Strategy Workspace Page - Unified Surface
//
// Part of the Decide phase - wrapped in DecideShell for consistent sub-navigation.
//
// VIEW MODES (via ?view=...):
// - builder (default): Full authoring workspace
// - blueprint: Read-only visual summary
// - command: 3-column editable workflow
// - orchestration: AI-first Objectives → Strategy → Tactics
//
// LEGACY MODE (via ?mode=legacy):
// - Deprecated pill-tag pillars editor
//
// All views share:
// - Single view-model endpoint
// - Single hook (useUnifiedStrategyViewModel)
// - Shared component library (panels)
//
// View preference persists to localStorage (key: hive-strategy-view)

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { StrategySurface } from '@/components/os/strategy/StrategySurface';
import { StrategyWorkspaceClient } from './StrategyWorkspaceClient';
import { getActiveStrategy } from '@/lib/os/strategy';
import { getCompanyContext } from '@/lib/os/context';
import { Wrench } from 'lucide-react';
import Link from 'next/link';
import { DecideShell } from '@/components/os/decide/DecideShell';

export const dynamic = 'force-dynamic';

// Legacy view types (for redirects)
type LegacyStrategyView = 'builder' | 'command' | 'orchestration';
// New view types (2-page model)
type StrategyViewMode = 'workspace' | 'blueprint';

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ mode?: string; view?: string }>;
};

// Map legacy views to new views
function mapLegacyView(view?: string): StrategyViewMode {
  if (view === 'blueprint') return 'blueprint';
  // Legacy views (builder, command, orchestration) all map to workspace
  return 'workspace';
}

export default async function StrategyPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { mode, view } = await searchParams;

  // Explicit legacy opt-in only
  const forceLegacy = mode === 'legacy';

  // View mode: map legacy views to new 2-page model
  const requestedView = mapLegacyView(view);

  // Fetch company (required for all states)
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // ========================================================================
  // LEGACY MODE - Explicit opt-in only via ?mode=legacy
  // ========================================================================
  if (forceLegacy) {
    const [strategy, context] = await Promise.all([
      getActiveStrategy(companyId),
      getCompanyContext(companyId),
    ]);

    return (
      <DecideShell companyId={companyId} activeSubView="strategy">
        {/* Deprecation Banner */}
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wrench className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-amber-200 font-medium">Legacy Editor Mode</p>
                <p className="text-amber-200/60 text-sm">
                  This editor is deprecated. Switch to the modern workspace.
                </p>
              </div>
            </div>
            <Link
              href={`/c/${companyId}/strategy`}
              className="px-4 py-2 bg-amber-800/50 hover:bg-amber-700/50 text-amber-200 rounded-lg text-sm transition-colors"
            >
              Switch to Modern Workspace
            </Link>
          </div>
        </div>

        <StrategyWorkspaceClient
          companyId={companyId}
          companyName={company.name}
          initialStrategy={strategy}
          contextObjectives={context?.objectives || []}
        />
      </DecideShell>
    );
  }

  // ========================================================================
  // UNIFIED STRATEGY SURFACE - All views share the same surface
  // ========================================================================
  // Log render for debugging
  console.log('[STRATEGY_RENDER]', {
    companyId,
    surface: 'unified',
    initialView: requestedView,
  });

  return (
    <DecideShell companyId={companyId} activeSubView="strategy">
      <StrategySurface
        companyId={companyId}
        companyName={company.name}
        initialView={requestedView}
      />
    </DecideShell>
  );
}
