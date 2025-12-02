// app/c/[companyId]/reports/page.tsx
// REDIRECT: Reports page now redirects to Blueprint
// Reports/diagnostics are now accessible via Blueprint -> Tools section

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ReportsHubPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/blueprint`);
}
