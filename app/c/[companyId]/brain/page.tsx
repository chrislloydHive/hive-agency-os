// app/c/[companyId]/brain/page.tsx
// Brain default route - redirects to Context (context-first)
// Canonical Brain routes: /brain/context, /brain/insights, /brain/history

import { redirect } from 'next/navigation';

interface BrainPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function BrainPage({ params }: BrainPageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/brain/context`);
}
