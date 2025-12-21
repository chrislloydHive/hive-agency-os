// app/c/[companyId]/blueprint/page.tsx
// Redirects to /diagnostics - the canonical Diagnostics hub
//
// The Diagnostics tab is now at /diagnostics for URL clarity.
// This route provides backwards compatibility.

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function BlueprintPage({ params }: PageProps) {
  const { companyId } = await params;

  // Redirect to the canonical Diagnostics hub
  redirect(`/c/${companyId}/diagnostics`);
}
