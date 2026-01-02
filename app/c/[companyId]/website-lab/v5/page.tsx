// app/c/[companyId]/website-lab/v5/page.tsx
// REDIRECT: This route is deprecated.
// Canonical Website Lab V5 results are at /c/[companyId]/diagnostics/website
//
// This file only exists to redirect legacy links.

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function WebsiteLabV5Redirect({ params }: PageProps) {
  const { companyId } = await params;

  // Redirect to canonical Website Lab page
  redirect(`/c/${companyId}/diagnostics/website`);
}
