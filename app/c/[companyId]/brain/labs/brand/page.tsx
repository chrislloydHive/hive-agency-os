// app/c/[companyId]/brain/labs/brand/page.tsx
// Brand Lab - Redirect to diagnostics implementation
//
// The Brand Lab UI is fully implemented at /diagnostics/brand.
// This page redirects to that implementation.

import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function BrandLabPage({ params }: Props) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/diagnostics/brand`);
}
