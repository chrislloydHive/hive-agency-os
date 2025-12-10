// app/c/[companyId]/labs/competitor/page.tsx
// Legacy route - redirects to canonical /diagnostics/competitor

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function LegacyCompetitorLabRedirect({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/diagnostics/competitor`);
}
