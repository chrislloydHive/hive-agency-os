// app/c/[companyId]/competition/page.tsx
// Legacy route - redirects to canonical /diagnostics/competition

import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function LegacyCompetitionRedirect({ params }: Props) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/diagnostics/competition`);
}
