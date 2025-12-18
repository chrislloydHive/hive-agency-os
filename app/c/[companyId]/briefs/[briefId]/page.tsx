// app/c/[companyId]/briefs/[briefId]/page.tsx
// Brief detail page - displays BriefWorkspace for viewing and editing

import { getBriefById } from '@/lib/airtable/briefs';
import { BriefWorkspaceClient } from './BriefWorkspaceClient';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function BriefPage({
  params,
}: {
  params: Promise<{ companyId: string; briefId: string }>;
}) {
  const { companyId, briefId } = await params;

  // Load brief
  const brief = await getBriefById(briefId);

  if (!brief) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Brief Not Found</h1>
          <p className="text-slate-400 mb-6">
            The brief you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href={`/c/${companyId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  return <BriefWorkspaceClient companyId={companyId} initialBrief={brief} />;
}
