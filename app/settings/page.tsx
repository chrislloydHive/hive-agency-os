/**
 * Settings Page
 *
 * Organized into sections:
 * - Workspace (name, logo, timezone)
 * - Integrations (GA4, GSC, Airtable)
 * - Scoring / Labels (placeholder)
 * - Users & Roles (placeholder)
 */

import { IntegrationsSection } from '@/components/settings/IntegrationsSection';
import { WorkspaceSection } from '@/components/settings/WorkspaceSection';
import { FirmBrainSection } from '@/components/settings/FirmBrainSection';

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-400 mt-1">
          Configure your Hive OS workspace
        </p>
      </div>

      <div className="space-y-8">
        {/* Workspace Settings - Client Component with Logo Upload */}
        <WorkspaceSection />

        {/* Firm Brain - Agency Knowledge Base */}
        <FirmBrainSection />

        {/* Integrations - Live Status */}
        <IntegrationsSection />

        {/* Scoring / Labels */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">
            Scoring & Labels
          </h2>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
            <svg
              className="w-12 h-12 mx-auto text-slate-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <h3 className="text-sm font-medium text-slate-300 mb-1">
              Custom Scoring & Labels
            </h3>
            <p className="text-xs text-slate-500">
              Configure scoring thresholds, tier definitions, and custom labels for your workflow.
            </p>
            <button className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm">
              Coming Soon
            </button>
          </div>
        </section>

        {/* Users & Roles */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">
            Users & Roles
          </h2>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
            <svg
              className="w-12 h-12 mx-auto text-slate-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <h3 className="text-sm font-medium text-slate-300 mb-1">
              Team Management
            </h3>
            <p className="text-xs text-slate-500">
              Invite team members, assign roles, and manage permissions.
            </p>
            <button className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm">
              Coming Soon
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-red-900/10 border border-red-900/30 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-4">
            Danger Zone
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-300">
                Reset Workspace
              </div>
              <div className="text-xs text-slate-500">
                This will delete all data. This action cannot be undone.
              </div>
            </div>
            <button className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors text-sm font-medium">
              Reset
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
