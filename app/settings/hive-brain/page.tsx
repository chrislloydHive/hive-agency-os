// app/settings/hive-brain/page.tsx
// Hive Brain Admin Page
//
// Internal-only page for editing agency-wide default context values.
// These values are merged with company-specific context when building AI prompts.

import { getHiveGlobalContextGraph } from '@/lib/contextGraph/globalGraph';
import { HiveBrainEditorClient } from './HiveBrainEditorClient';

export default async function HiveBrainPage() {
  // Load the current Hive Brain
  const graph = await getHiveGlobalContextGraph();

  return (
    <div className="p-8 max-w-5xl">
      {/* Internal Banner */}
      <div className="mb-6 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">Internal: Hive Brain</span>
          <span className="text-amber-400/70">- Agency-wide context defaults</span>
        </div>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Hive Brain</h1>
        <p className="text-slate-400 mt-1">
          Set agency-wide default values that apply to all companies unless overridden.
        </p>
      </div>

      {/* Editor */}
      <HiveBrainEditorClient initialGraph={graph} />
    </div>
  );
}
