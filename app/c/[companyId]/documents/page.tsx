// app/c/[companyId]/documents/page.tsx
// Legacy redirect: Documents → Artifacts

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function DocumentsPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/artifacts`);
}
