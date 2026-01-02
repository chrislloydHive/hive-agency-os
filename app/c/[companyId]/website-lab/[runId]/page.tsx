// app/c/[companyId]/website-lab/[runId]/page.tsx
// REDIRECT: This route is deprecated.
// Canonical Website Lab results are at /c/[companyId]/diagnostics/website?runId=...
//
// This file only exists to redirect legacy links.

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string; runId: string }>;
};

export default async function WebsiteLabRunRedirect({ params }: PageProps) {
  const { companyId, runId } = await params;

  // Redirect to canonical Website Lab page with runId query param
  redirect(`/c/${companyId}/diagnostics/website?runId=${runId}`);
}
