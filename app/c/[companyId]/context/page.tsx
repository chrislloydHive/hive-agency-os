// app/c/[companyId]/context/page.tsx
// Redirect to new location under Brain workspace

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function ContextRedirectPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { view } = await searchParams;

  // Preserve the view parameter if present
  const queryString = view ? `?view=${view}` : '';
  redirect(`/c/${companyId}/brain/context${queryString}`);
}
