// lib/inngest/functions/engagement-context-gathering.ts
// Background job for running context gathering (labs) for an engagement
//
// Triggered when user starts context gathering from the engagement flow.
// Runs the Full GAP orchestrator and updates engagement status when complete.

import { inngest } from '../client';
import { runFullGAPOrchestrator } from '@/lib/gap/orchestrator';
import { updateEngagement } from '@/lib/airtable/engagements';
import { getCompanyById } from '@/lib/airtable/companies';
import type { LabId } from '@/lib/contextGraph/labContext';

// ============================================================================
// Types
// ============================================================================

interface EngagementContextGatheringEvent {
  name: 'engagement/start-context-gathering';
  data: {
    engagementId: string;
    companyId: string;
    selectedLabs: LabId[];
  };
}

// ============================================================================
// Inngest Function
// ============================================================================

export const engagementContextGathering = inngest.createFunction(
  {
    id: 'engagement-context-gathering',
    name: 'Engagement Context Gathering',
    retries: 1,
  },
  { event: 'engagement/start-context-gathering' },
  async ({ event, step }) => {
    const { engagementId, companyId, selectedLabs } = event.data;

    console.log('[inngest:engagement-context-gathering] Starting for:', {
      engagementId,
      companyId,
      selectedLabs,
    });

    // Step 1: Validate company exists
    const company = await step.run('validate-company', async () => {
      const company = await getCompanyById(companyId);
      if (!company) {
        throw new Error(`Company not found: ${companyId}`);
      }
      return company;
    });

    // Step 2: Run the Full GAP Orchestrator
    // Force run the selected labs regardless of context completeness
    const orchestratorOutput = await step.run('run-orchestrator', async () => {
      console.log('[inngest:engagement-context-gathering] Running orchestrator with forced labs:', selectedLabs);

      try {
        const output = await runFullGAPOrchestrator({
          companyId,
          gapIaRun: {}, // Fresh run - orchestrator will gather context
          forceLabs: selectedLabs, // Force run the user-selected labs
        });

        console.log('[inngest:engagement-context-gathering] Orchestrator complete:', {
          success: output.success,
          labsRun: output.labsRun.length,
          insights: output.insights.length,
          forcedLabs: selectedLabs,
        });

        return output;
      } catch (error) {
        console.error('[inngest:engagement-context-gathering] Orchestrator failed:', error);
        throw error;
      }
    });

    // Step 3: Update engagement with completion timestamp
    // User must manually approve context after reviewing
    await step.run('update-completion', async () => {
      console.log('[inngest:engagement-context-gathering] Context gathering complete:', {
        success: orchestratorOutput.success,
        labsRun: orchestratorOutput.labsRun.length,
        insights: orchestratorOutput.insights.length,
      });

      // Update engagement with labs completion timestamp
      // Status stays 'context_gathering' until user approves
      await updateEngagement(engagementId, {
        labsCompletedAt: new Date().toISOString(),
      });

      console.log('[inngest:engagement-context-gathering] Updated engagement with labsCompletedAt');
    });

    console.log('[inngest:engagement-context-gathering] Complete:', {
      engagementId,
      success: orchestratorOutput.success,
    });

    return {
      success: orchestratorOutput.success,
      engagementId,
      companyId,
      labsRun: orchestratorOutput.labsRun,
      insightCount: orchestratorOutput.insights.length,
      error: orchestratorOutput.error,
    };
  }
);
