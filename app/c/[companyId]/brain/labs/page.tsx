// app/c/[companyId]/brain/labs/page.tsx
// Legacy route - Labs have moved to Diagnostics (/blueprint)

import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function LabsHubPage({ params }: Props) {
  const { companyId } = await params;
  // Labs are now part of Diagnostics
  redirect(`/c/${companyId}/blueprint`);
}
