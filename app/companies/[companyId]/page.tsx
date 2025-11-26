/**
 * Company Detail Page - REDIRECT
 *
 * This route has been consolidated into /c/[companyId]
 * Redirects all traffic to the new route structure.
 */

import { redirect } from 'next/navigation';

interface CompanyDetailPageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

// Map old tab query params to new sub-routes
const TAB_TO_ROUTE: Record<string, string> = {
  'overview': '',
  'opportunities': '/opportunities',
  'diagnostics': '/diagnostics',
  'gap': '/gap',
  'work': '/work',
  'analytics': '/analytics',
  'ai-memory': '/brain',
  'notes': '/notes',
};

export default async function CompanyDetailPage({
  params,
  searchParams,
}: CompanyDetailPageProps) {
  const { companyId } = await params;
  const { tab = 'overview' } = await searchParams;

  // Map old tab to new route
  const subRoute = TAB_TO_ROUTE[tab] ?? '';

  // Redirect to new /c/ route
  redirect(`/c/${companyId}${subRoute}`);
}
