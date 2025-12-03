// app/c/[companyId]/diagnostics/media/forecast/page.tsx
// Media Forecast Lab - Interactive budget forecasting tool
//
// Features:
// - Budget controls with channel allocation sliders
// - Real-time forecast calculations
// - Channel and store-level breakdowns
// - Seasonal adjustments

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getMediaAssumptionsWithDefaults } from '@/lib/airtable/mediaAssumptions';
import { ForecastLabClient } from './ForecastLabClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ForecastLabPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch media assumptions
  const assumptions = await getMediaAssumptionsWithDefaults(companyId);

  // Get stores - for now use placeholder stores
  // In production would fetch from MediaStores table
  const stores = [
    { id: 'store-1', name: 'Store 1', market: 'Default Market', marketType: 'suburban' as const, isActive: true },
    { id: 'store-2', name: 'Store 2', market: 'Default Market', marketType: 'suburban' as const, isActive: true },
    { id: 'store-3', name: 'Store 3', market: 'Default Market', marketType: 'urban' as const, isActive: true },
  ];

  return (
    <ForecastLabClient
      companyId={companyId}
      companyName={company.name}
      initialAssumptions={assumptions}
      stores={stores}
    />
  );
}
