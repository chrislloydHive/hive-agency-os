// app/context-v4/[companyId]/layout.tsx
// Context V4 Layout
//
// Provides shared header, breadcrumb, and sub-navigation for all Context V4 views.
// Child views (Fact Sheet, Review, Fields) share this layout.

import { redirect, notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { isContextV4Enabled } from '@/lib/types/contextField';
import { ContextV4LayoutClient } from './ContextV4LayoutClient';

export const dynamic = 'force-dynamic';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}

export default async function ContextV4Layout({ children, params }: LayoutProps) {
  // Feature flag check
  if (!isContextV4Enabled()) {
    redirect('/');
  }

  const { companyId } = await params;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <ContextV4LayoutClient companyId={companyId} companyName={company.name}>
        {children}
      </ContextV4LayoutClient>
    </div>
  );
}
