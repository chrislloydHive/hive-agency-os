// app/c/[companyId]/qbr/scorecard/page.tsx
// Legacy route - redirects to consolidated /reports/qbr

import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function QbrScorecardPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/reports/qbr`);
}
