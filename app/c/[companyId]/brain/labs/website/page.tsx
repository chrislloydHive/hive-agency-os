// app/c/[companyId]/brain/labs/website/page.tsx
// Website Lab - Redirect to diagnostics implementation
//
// The Website Lab UI is fully implemented at /diagnostics/website.
// This page redirects to that implementation.

import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function WebsiteLabPage({ params }: Props) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/diagnostics/website`);
}
