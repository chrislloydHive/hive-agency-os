// app/c/[companyId]/diagnostics/website-lab/page.tsx
// REDIRECT: This route is deprecated.
// Canonical Website Lab is at /c/[companyId]/diagnostics/website
//
// This file only exists to redirect legacy links.

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function WebsiteLabHubRedirect({ params }: PageProps) {
  const { companyId } = await params;

  // Redirect to canonical Website Lab page
  redirect(`/c/${companyId}/diagnostics/website`);
}
