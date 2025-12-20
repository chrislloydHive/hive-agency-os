/**
 * Opportunity Workspace Page
 *
 * Server component that fetches opportunity data and renders the workspace client.
 * The workspace UI is optimized for managing long-cycle, RFP-heavy deals with:
 * - Momentum tracking (Next Step + Due Date)
 * - Deal Details and Buying Process cards
 * - RFP section (conditional on opportunityType)
 * - Engagement section for Won deals
 */

import { notFound } from 'next/navigation';
import { getOpportunityById } from '@/lib/airtable/opportunities';
import { getCompanyById } from '@/lib/airtable/companies';
import { getActivitiesForOpportunity } from '@/lib/airtable/activities';
import { OpportunityWorkspaceClient } from './OpportunityWorkspaceClient';
import type { ActivityDTO } from '@/lib/types/activity';

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch opportunity
  const opportunity = await getOpportunityById(id);

  if (!opportunity) {
    notFound();
  }

  // Fetch linked company and activities in parallel
  const [company, activitiesRaw] = await Promise.all([
    opportunity.companyId ? getCompanyById(opportunity.companyId) : Promise.resolve(null),
    getActivitiesForOpportunity(id, 20), // Limit to 20 most recent
  ]);

  // Map ActivityRecord to lightweight ActivityDTO for client
  const activities: ActivityDTO[] = activitiesRaw.map((a) => ({
    id: a.id,
    receivedAt: a.receivedAt || new Date().toISOString(),
    type: a.type,
    direction: a.direction,
    subject: a.subject,
    fromName: a.fromName,
    fromEmail: a.fromEmail,
    snippet: a.snippet,
    externalUrl: a.externalUrl,
    threadId: a.externalThreadId,
  }));

  return (
    <div className="p-8">
      <OpportunityWorkspaceClient
        opportunity={opportunity}
        companyName={company?.name || null}
        companyId={company?.id || null}
        companyDomain={company?.domain || company?.website || null}
        activities={activities}
      />
    </div>
  );
}
