// app/settings/integrations/google-drive/page.tsx
// Google Drive Integration Settings Page
//
// Shows current configuration, health status, and setup instructions.
// This is read-only since configuration comes from environment variables.

import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { DriveIntegrationSettings } from './DriveIntegrationSettings';

export const metadata: Metadata = {
  title: 'Google Drive Integration | Hive OS Settings',
  description: 'Configure Google Drive integration for template creation and artifact storage.',
};

export default function GoogleDriveSettingsPage() {
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
        <h1 className="text-2xl font-bold text-white">Google Drive Integration</h1>
        <p className="text-slate-400 mt-2">
          Connect to Google Drive to enable template creation and artifact storage.
          This integration uses Application Default Credentials (ADC) - no API keys required.
        </p>
      </div>

      {/* Settings content */}
      <DriveIntegrationSettings />
    </div>
  );
}
