// app/c/[companyId]/brain/labs/audience/page.tsx
// Audience Lab - Redirect to diagnostics implementation
//
// The Audience Lab UI is fully implemented at /diagnostics/audience.
// This page redirects to that implementation.

import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function AudienceLabPage({ params }: Props) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/diagnostics/audience`);
}
