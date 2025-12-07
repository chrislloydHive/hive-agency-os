// app/c/[companyId]/competition/page.tsx
// Legacy redirect to new location: Brain → Labs → Competition Lab

import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function LegacyCompetitionRedirect({ params }: Props) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/brain/labs/competition`);
}
