// app/c/[companyId]/labs/competitor/page.tsx
// Legacy redirect to Competition Lab V3

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function LegacyCompetitorLabRedirect({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/brain/labs/competition`);
}
