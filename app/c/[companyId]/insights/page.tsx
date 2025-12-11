// app/c/[companyId]/insights/page.tsx
// AI Insights page - Weekly digest and full insights view

import { InsightsClient } from './InsightsClient';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function InsightsPage({ params }: PageProps) {
  const { companyId } = await params;

  return <InsightsClient companyId={companyId} />;
}

export const metadata = {
  title: 'AI Insights | Hive OS',
  description: 'Proactive intelligence about your digital health',
};
