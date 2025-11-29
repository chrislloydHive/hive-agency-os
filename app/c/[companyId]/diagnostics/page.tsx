// app/c/[companyId]/diagnostics/page.tsx
// DEPRECATED: Redirects to /tools - the canonical tools hub
//
// This route is kept for backwards compatibility.
// All diagnostic/tool functionality has been consolidated into /tools.

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function DiagnosticsHubPage({ params }: PageProps) {
  const { companyId } = await params;

  // Redirect to the canonical Tools hub
  redirect(`/c/${companyId}/tools`);
}
