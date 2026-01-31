// app/settings/integrations/page.tsx
// Post-OAuth landing page — shows success/error after Google OAuth redirect.

import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Integrations | Hive OS Settings',
  description: 'Manage third-party integrations for Hive Agency OS.',
};

export default function IntegrationsPage({
  searchParams,
}: {
  searchParams: { google?: string; google_error?: string; companyId?: string };
}) {
  const googleConnected = searchParams.google === 'connected';
  const googleError = searchParams.google_error;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-slate-400 mt-2">
          Manage connected services and third-party integrations.
        </p>
      </div>

      {/* Google OAuth notification */}
      {googleConnected && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 mb-6">
          <p className="text-emerald-400 font-medium">Google connected successfully</p>
          {searchParams.companyId && (
            <p className="text-emerald-400/70 text-sm mt-1">
              Company: {searchParams.companyId}
            </p>
          )}
        </div>
      )}

      {googleError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 mb-6">
          <p className="text-red-400 font-medium">Google connection failed</p>
          <p className="text-red-400/70 text-sm mt-1">{googleError}</p>
        </div>
      )}

      {/* Integration links */}
      <div className="space-y-4">
        <Link
          href="/settings/integrations/google-drive"
          className="block rounded-lg border border-slate-700 bg-slate-800/50 p-4 hover:border-slate-600 transition-colors"
        >
          <h2 className="text-white font-medium">Google Drive</h2>
          <p className="text-slate-400 text-sm mt-1">
            Template creation and artifact storage via Google Drive.
          </p>
        </Link>
      </div>
    </div>
  );
}
