// app/c/[companyId]/labs/media/page.tsx
// Media Lab V1 - Page

import { getCompanyById } from '@/lib/airtable/companies';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import { MediaLabClient } from './MediaLabClient';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function MediaLabPage({ params }: PageProps) {
  // Feature gate: Labs must be explicitly enabled
  if (!FEATURE_FLAGS.LABS_ENABLED) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-6 text-slate-400">
          Labs are not enabled. Set NEXT_PUBLIC_FEATURE_LABS=true to enable.
        </div>
      </div>
    );
  }

  const { companyId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-6 text-red-400">
          Company not found
        </div>
      </div>
    );
  }

  return (
    <MediaLabClient
      companyId={companyId}
      companyName={company.name || 'Unknown Company'}
    />
  );
}
