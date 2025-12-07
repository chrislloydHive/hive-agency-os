// app/c/[companyId]/brain/map/page.tsx
// Legacy route - redirects to /brain/explorer
// The Strategic Map is now at /brain/explorer as part of the 4-tab Brain IA

import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ focus?: string }>;
}

export default async function StrategicMapPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { focus } = await searchParams;

  // Preserve focus param if present
  const targetUrl = focus
    ? `/c/${companyId}/brain/explorer?focus=${focus}`
    : `/c/${companyId}/brain/explorer`;

  redirect(targetUrl);
}
