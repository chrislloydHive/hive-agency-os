// app/c/[companyId]/qbr/strategic-plan/page.tsx
// Legacy route - redirects to consolidated /reports/qbr

import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function StrategicPlanPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/reports/qbr`);
}
