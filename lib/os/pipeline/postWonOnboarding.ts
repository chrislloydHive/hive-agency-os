/**
 * Post-Won Onboarding - Automatic Work Item Seeding
 *
 * When an Opportunity becomes "Won" and an Engagement is linked,
 * this module seeds initial onboarding Work items to kickstart the engagement.
 *
 * Idempotency: Uses engagementId in SOURCE_JSON to prevent duplicate creation.
 */

import { createWorkItem, getWorkItemsForCompany } from '@/lib/airtable/workItems';
import type { WorkSourcePostWonOnboarding } from '@/lib/types/work';

/**
 * Onboarding work item template
 */
interface OnboardingTemplate {
  /** Unique template key for idempotency */
  templateKey: string;
  /** Work item title */
  title: string;
  /** Work item notes/description */
  notes: string;
  /** Days from engagement start to set as due date */
  dueDaysOffset: number;
  /** Work area category */
  area: 'Operations' | 'Strategy' | 'Analytics' | 'Other';
}

/**
 * Standard onboarding work item templates
 * These are seeded when a Won opportunity gets an Engagement linked
 */
const ONBOARDING_TEMPLATES: OnboardingTemplate[] = [
  {
    templateKey: 'kickoff',
    title: '[Onboarding] Kickoff scheduling + agenda',
    notes:
      'Schedule the kickoff meeting with the client. Prepare agenda covering:\n' +
      '- Introductions and team roles\n' +
      '- Project scope and timeline review\n' +
      '- Communication cadence and tools\n' +
      '- Immediate next steps and access requirements',
    dueDaysOffset: 3,
    area: 'Operations',
  },
  {
    templateKey: 'access',
    title: '[Onboarding] Access & accounts request list',
    notes:
      'Compile and request access to all necessary platforms:\n' +
      '- Analytics (GA4, GSC, etc.)\n' +
      '- CMS and website admin\n' +
      '- Ad platforms (if applicable)\n' +
      '- CRM access (if applicable)\n' +
      '- Shared drives / documentation',
    dueDaysOffset: 5,
    area: 'Operations',
  },
  {
    templateKey: 'scope',
    title: '[Onboarding] Confirm scope + success metrics',
    notes:
      'Document and confirm with the client:\n' +
      '- Primary objectives and KPIs\n' +
      '- Success metrics and targets\n' +
      '- Deliverable expectations\n' +
      '- Out-of-scope items\n' +
      '- Escalation paths',
    dueDaysOffset: 7,
    area: 'Strategy',
  },
  {
    templateKey: 'baseline',
    title: '[Onboarding] Baseline capture (snapshot / metrics)',
    notes:
      'Capture current state metrics as baseline:\n' +
      '- Traffic and engagement metrics\n' +
      '- SEO rankings and visibility\n' +
      '- Conversion rates\n' +
      '- Current brand perception (if measurable)\n' +
      '- Document in client context',
    dueDaysOffset: 10,
    area: 'Analytics',
  },
  {
    templateKey: 'labs',
    title: '[Onboarding] Run GAP / required labs (if applicable)',
    notes:
      'Run diagnostic labs to establish strategic foundation:\n' +
      '- Brand Lab (if brand work in scope)\n' +
      '- Website Lab (if website in scope)\n' +
      '- Competition Lab (understand competitive landscape)\n' +
      '- Review outputs and incorporate into strategy',
    dueDaysOffset: 14,
    area: 'Strategy',
  },
  {
    templateKey: 'plan30',
    title: '[Onboarding] First 30-day plan draft',
    notes:
      'Create the first 30-day action plan:\n' +
      '- Prioritized initiatives based on labs and scope\n' +
      '- Week-by-week breakdown\n' +
      '- Quick wins to demonstrate value\n' +
      '- Dependencies and risks\n' +
      '- Review with client for alignment',
    dueDaysOffset: 21,
    area: 'Strategy',
  },
];

/**
 * Input for seeding post-won onboarding work items
 */
export interface SeedPostWonWorkInput {
  companyId: string;
  opportunityId: string;
  engagementId: string;
  /** ISO datetime when the opportunity was marked Won. Used as baseline for due dates. Defaults to today if not provided. */
  wonAt?: string | null;
}

/**
 * Result of seeding operation
 */
export interface SeedPostWonWorkResult {
  success: boolean;
  created: number;
  skipped: number;
  error?: string;
}

/**
 * Add days to a date and return ISO date string (YYYY-MM-DD)
 */
function addDays(baseDate: Date, days: number): string {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
}

/**
 * Seed onboarding work items for a won opportunity with engagement
 *
 * Idempotent: Checks existing work items by SOURCE_JSON to avoid duplicates.
 * Each template is uniquely identified by `postwon:${engagementId}:${templateKey}`.
 *
 * Due dates are calculated from wonAt (if provided) or today as baseline.
 *
 * @param input - Company, Opportunity, Engagement IDs, and optional wonAt timestamp
 * @returns Result with counts of created and skipped items
 */
export async function seedPostWonWork(
  input: SeedPostWonWorkInput
): Promise<SeedPostWonWorkResult> {
  const { companyId, opportunityId, engagementId, wonAt } = input;

  // Use wonAt as baseline for due dates, fallback to today
  const baselineDate = wonAt ? new Date(wonAt) : new Date();

  console.log('[PostWonOnboarding] Starting seed for engagement:', {
    companyId,
    opportunityId,
    engagementId,
    wonAt: wonAt || '(using today)',
    baselineDate: baselineDate.toISOString(),
  });

  try {
    // Fetch existing work items for company to check for duplicates
    const existingItems = await getWorkItemsForCompany(companyId);

    // Build set of existing onboarding keys from SOURCE_JSON
    const existingKeys = new Set<string>();
    for (const item of existingItems) {
      if (item.source?.sourceType === 'postwon_onboarding') {
        const source = item.source as WorkSourcePostWonOnboarding;
        // Key format: engagementId:templateKey
        if (source.engagementId === engagementId) {
          existingKeys.add(source.templateKey);
        }
      }
    }

    console.log('[PostWonOnboarding] Found existing onboarding items:', existingKeys.size);

    const seededAt = new Date().toISOString();
    let created = 0;
    let skipped = 0;

    // Create work items for each template
    for (const template of ONBOARDING_TEMPLATES) {
      // Check if already exists
      if (existingKeys.has(template.templateKey)) {
        console.log(`[PostWonOnboarding] Skipping existing: ${template.templateKey}`);
        skipped++;
        continue;
      }

      // Build source metadata
      const source: WorkSourcePostWonOnboarding = {
        sourceType: 'postwon_onboarding',
        engagementId,
        opportunityId,
        companyId,
        templateKey: template.templateKey,
        seededAt,
      };

      // Calculate due date from wonAt baseline (or today if not provided)
      const dueDate = addDays(baselineDate, template.dueDaysOffset);

      // Create the work item
      const result = await createWorkItem({
        title: template.title,
        companyId,
        notes: template.notes,
        area: template.area,
        severity: 'Medium',
        status: 'Backlog',
        source,
        dueDate,
      });

      if (result) {
        console.log(`[PostWonOnboarding] Created: ${template.title}`);
        created++;
      } else {
        console.error(`[PostWonOnboarding] Failed to create: ${template.title}`);
      }
    }

    console.log('[PostWonOnboarding] Seed complete:', { created, skipped });

    return {
      success: true,
      created,
      skipped,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PostWonOnboarding] Seed failed:', errorMessage);

    return {
      success: false,
      created: 0,
      skipped: 0,
      error: errorMessage,
    };
  }
}

/**
 * Check if onboarding has already been seeded for an engagement
 *
 * @param companyId - Company record ID
 * @param engagementId - Engagement record ID
 * @returns True if any onboarding items exist for this engagement
 */
export async function hasOnboardingBeenSeeded(
  companyId: string,
  engagementId: string
): Promise<boolean> {
  try {
    const existingItems = await getWorkItemsForCompany(companyId);

    for (const item of existingItems) {
      if (item.source?.sourceType === 'postwon_onboarding') {
        const source = item.source as WorkSourcePostWonOnboarding;
        if (source.engagementId === engagementId) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('[PostWonOnboarding] Error checking seeded status:', error);
    return false;
  }
}
