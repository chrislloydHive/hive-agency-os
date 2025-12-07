// app/c/[companyId]/qbr/page.tsx
// QBR default route - redirects to new Reports location
// Legacy route - preserved for backwards compatibility

import { redirect } from 'next/navigation';

interface QBRPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function QBRPage({ params }: QBRPageProps) {
  const { companyId } = await params;
  // Redirect to new Reports location
  redirect(`/c/${companyId}/reports/qbr`);
}
