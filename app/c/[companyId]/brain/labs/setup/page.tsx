// app/c/[companyId]/brain/labs/setup/page.tsx
// Redirect to existing Setup implementation at /brain/setup
//
// The Setup wizard is accessible from Labs but lives at /brain/setup
// for now. This route redirects to maintain consistency with the
// 4-tab Brain IA where Setup is part of Labs.

import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ step?: string }>;
}

export default async function LabsSetupPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { step } = await searchParams;

  // Redirect to existing setup, preserving step param
  const targetUrl = step
    ? `/c/${companyId}/brain/setup?step=${step}`
    : `/c/${companyId}/brain/setup`;

  redirect(targetUrl);
}
