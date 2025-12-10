// app/c/[companyId]/labs/creative/page.tsx
// Legacy route - redirects to canonical /diagnostics/creative

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function LegacyCreativeLabPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/diagnostics/creative`);
}
