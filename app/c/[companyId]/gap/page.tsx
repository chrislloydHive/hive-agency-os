// app/c/[companyId]/gap/page.tsx
// REDIRECT: GAP page now redirects to Blueprint
// GAP tools and history are now accessible via Blueprint -> Tools section

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function CompanyGapPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/blueprint`);
}
