// app/c/[companyId]/diagnostics/page.tsx
// Redirects to /blueprint - the canonical Diagnostics hub
//
// The Diagnostics tab (formerly "Blueprint") is at /blueprint for URL stability.
// This route provides a semantic alias.

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function DiagnosticsHubPage({ params }: PageProps) {
  const { companyId } = await params;

  // Redirect to the Diagnostics hub (at /blueprint path for URL stability)
  redirect(`/c/${companyId}/blueprint`);
}
