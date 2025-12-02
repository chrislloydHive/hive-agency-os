// app/c/[companyId]/experiments/page.tsx
// REDIRECT: Experiments page now redirects to Work
// Experiments are now a sub-tab under Work

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function CompanyExperimentsPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/work`);
}
