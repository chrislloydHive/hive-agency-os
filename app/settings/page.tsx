/**
 * Settings Page
 *
 * Organized into sections:
 * - Workspace (name, logo, timezone)
 * - Integrations (GA4, GSC, Airtable)
 * - Scoring / Labels (placeholder)
 * - Users & Roles (placeholder)
 */

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
        {/* Workspace Settings */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-6">Workspace</h2>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  defaultValue="Hive Agency"
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Timezone
                </label>
                <select className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50">
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Workspace Logo
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm">
                  Upload Logo
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-6">
            Integrations
          </h2>
          <div className="space-y-4">
            {/* Airtable */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    Airtable
                  </div>
                  <div className="text-xs text-slate-500">
                    Database for companies, work items, and reports
                  </div>
                </div>
              </div>
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded font-medium">
                Connected
              </span>
            </div>

            {/* Google Analytics */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    Google Analytics 4
                  </div>
                  <div className="text-xs text-slate-500">
                    Traffic and conversion tracking for Growth Analytics
                  </div>
                </div>
              </div>
              <button className="text-sm text-amber-400 hover:text-amber-300 font-medium">
                Configure
              </button>
            </div>

            {/* Search Console */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    Google Search Console
                  </div>
                  <div className="text-xs text-slate-500">
                    SEO performance and search query data
                  </div>
                </div>
              </div>
              <button className="text-sm text-amber-400 hover:text-amber-300 font-medium">
                Configure
              </button>
            </div>

            {/* OpenAI */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    AI Provider (OpenAI/Anthropic)
                  </div>
                  <div className="text-xs text-slate-500">
                    Powers GAP assessments and AI briefings
                  </div>
                </div>
              </div>
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded font-medium">
                Connected
              </span>
            </div>
          </div>
        </section>

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
