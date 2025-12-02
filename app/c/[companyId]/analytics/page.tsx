// app/c/[companyId]/analytics/page.tsx
// REDIRECT: Analytics page now redirects to Analytics Deep Dive
// Analytics is now accessible via Blueprint -> Analytics Deep Dive

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function CompanyAnalyticsPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/analytics/deep-dive`);
}
