// app/tasks/command-center/page.tsx
// Chief of Staff AI — Daily Command Center
// Unified, ranked view across Airtable tasks, Google Calendar, and Drive.

import { CommandCenterClient } from './CommandCenterClient';

export const dynamic = 'force-dynamic';

// Production: set DMA_DEFAULT_COMPANY_ID to the Airtable Companies record id for the org whose
// Google tokens live in CompanyIntegrations (e.g. recxAF5zkklqY0vZa from /c/[companyId]/…).
// If unset, the legacy fallback below is used — wrong id ⇒ no Google / wrong integrations.
const DEFAULT_COMPANY_ID = process.env.DMA_DEFAULT_COMPANY_ID || 'recWofrWdHQOwDIBP';

export const metadata = {
  title: 'Command Center | Hive OS',
  description: 'Chief of Staff AI — what matters today, ranked and linked across systems',
};

export default function CommandCenterPage() {
  return <CommandCenterClient companyId={DEFAULT_COMPANY_ID} backUrl="/tasks" />;
}
