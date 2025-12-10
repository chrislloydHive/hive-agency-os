// app/c/[companyId]/brain/labs/competition/page.tsx
// Legacy route - redirects to canonical /diagnostics/competition

import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function LegacyCompetitionLabPage({ params }: Props) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/diagnostics/competition`);
}
