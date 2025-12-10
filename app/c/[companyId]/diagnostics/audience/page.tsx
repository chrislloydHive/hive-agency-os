// app/c/[companyId]/diagnostics/audience/page.tsx
// Redirect to Brain - Audience Lab is a modeling workspace, not a diagnostic
//
// The Audience Lab has been moved to Brain as it's an interactive workspace
// for managing audience segments, not a run-based diagnostic tool.

import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function AudienceLabRedirect({ params }: Props) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/brain/labs/audience`);
}
