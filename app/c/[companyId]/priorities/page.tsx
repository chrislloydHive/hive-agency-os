// app/c/[companyId]/priorities/page.tsx
// DEPRECATED: Redirects to /work - priorities are now shown in the Work tab
//
// This route is kept for backwards compatibility.
// All priority/work functionality has been consolidated into /work.

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function PrioritiesPage({ params }: PageProps) {
  const { companyId } = await params;

  // Redirect to the canonical Work hub
  redirect(`/c/${companyId}/work`);
}
