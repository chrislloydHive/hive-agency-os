// app/c/[companyId]/setup/page.tsx
// Redirect to the new location under Brain
//
// Setup has been moved to /brain/setup to be part of the Brain workspace.

import { redirect } from 'next/navigation';

export default async function SetupRedirectPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/brain/setup`);
}
