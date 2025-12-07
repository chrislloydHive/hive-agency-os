// app/c/[companyId]/brain/library/page.tsx
// Legacy route - redirects to /brain/labs/runs
// Library has been moved into Labs as part of the Brain 4-tab IA

import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function BrainLibraryPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/brain/labs/runs`);
}
