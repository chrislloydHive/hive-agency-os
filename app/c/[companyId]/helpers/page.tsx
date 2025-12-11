// app/c/[companyId]/helpers/page.tsx
// AI Execution Helpers page - Guided wizards for common tasks

import { HelpersClient } from './HelpersClient';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function HelpersPage({ params }: PageProps) {
  const { companyId } = await params;

  return <HelpersClient companyId={companyId} />;
}

export const metadata = {
  title: 'AI Helpers | Hive OS',
  description: 'Guided wizards to help you complete common tasks',
};
