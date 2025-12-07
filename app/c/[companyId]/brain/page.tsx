// app/c/[companyId]/brain/page.tsx
// Brain default route - redirects to Explorer (exploration-first)
// Canonical Brain routes: /brain/explorer, /brain/context, /brain/insights, /brain/labs

import { redirect } from 'next/navigation';

interface BrainPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function BrainPage({ params }: BrainPageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/brain/explorer`);
}
