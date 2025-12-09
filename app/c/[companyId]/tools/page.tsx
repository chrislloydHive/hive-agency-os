// app/c/[companyId]/tools/page.tsx
// Redirects to /blueprint - the canonical Diagnostics hub
//
// Tools/Labs are now integrated into the Diagnostics hub.

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ToolsPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/blueprint`);
}
