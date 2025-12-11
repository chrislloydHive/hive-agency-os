// app/c/[companyId]/context-graph/page.tsx
// DEPRECATED: Redirects to the new Brain → Context page
// The Context Graph is now part of the Brain IA at /brain/context

import { redirect } from 'next/navigation';

interface ContextGraphPageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ snapshotId?: string }>;
}

export default async function ContextGraphPage({ params, searchParams }: ContextGraphPageProps) {
  const { companyId } = await params;
  const { snapshotId } = await searchParams;

  // Redirect to the new Brain → Context page
  // Preserve snapshot param if present
  const destination = snapshotId
    ? `/c/${companyId}/brain/context?snapshot=${snapshotId}`
    : `/c/${companyId}/brain/context`;

  redirect(destination);
}
