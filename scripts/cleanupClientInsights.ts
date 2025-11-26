#!/usr/bin/env npx tsx
/**
 * cleanupClientInsights.ts
 *
 * Migration script to convert task-like insights to condition-based insights.
 *
 * This script identifies Client Brain insights that are phrased as tasks
 * (imperative language like "Create", "Add", "Develop") and uses AI to
 * rephrase them as condition-based observations.
 *
 * Usage:
 *   npx tsx scripts/cleanupClientInsights.ts --dry-run
 *   npx tsx scripts/cleanupClientInsights.ts --execute
 *
 * Options:
 *   --dry-run    Preview changes without updating (default)
 *   --execute    Actually update the insights in Airtable
 *   --limit=N    Process at most N insights (default: 100)
 *   --company=X  Only process insights for a specific company ID
 *
 * Environment Variables Required:
 *   ANTHROPIC_API_KEY - API key for Claude
 *   AIRTABLE_API_KEY or AIRTABLE_ACCESS_TOKEN - Airtable credentials
 *   AIRTABLE_BASE_ID - Airtable base ID
 */

import Anthropic from '@anthropic-ai/sdk';
import Airtable from 'airtable';

// ============================================================================
// Configuration
// ============================================================================

const CLIENT_INSIGHTS_TABLE =
  process.env.AIRTABLE_CLIENT_INSIGHTS_TABLE || 'Client Insights';

// Task-like verbs that indicate an insight is actually a task
const TASK_VERBS = [
  'create',
  'add',
  'develop',
  'implement',
  'improve',
  'enhance',
  'build',
  'establish',
  'design',
  'optimize',
  'set up',
  'setup',
  'launch',
  'introduce',
  'deploy',
  'integrate',
  'configure',
  'enable',
  'make',
  'update',
  'fix',
  'revise',
  'rewrite',
  'redesign',
  'expand',
  'strengthen',
  'leverage',
  'utilize',
  'focus',
  'prioritize',
  'invest',
  'consider',
  'explore',
];

// ============================================================================
// Airtable Setup
// ============================================================================

interface AirtableInsight {
  id: string;
  title: string;
  body: string;
  companyId: string;
  category: string;
  severity: string;
}

function getBase(): Airtable.Base {
  const apiKey =
    process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error(
      'Airtable credentials not configured. Please set AIRTABLE_API_KEY (or AIRTABLE_ACCESS_TOKEN) and AIRTABLE_BASE_ID environment variables.'
    );
  }

  return new Airtable({ apiKey }).base(baseId);
}

/**
 * Fetch all insights from Airtable
 */
async function fetchAllInsights(
  companyId?: string,
  limit: number = 100
): Promise<AirtableInsight[]> {
  const base = getBase();
  const insights: AirtableInsight[] = [];

  const selectOptions: Airtable.SelectOptions<any> = {
    maxRecords: limit,
    sort: [{ field: 'Created At', direction: 'desc' }],
  };

  // Add company filter if specified
  if (companyId) {
    selectOptions.filterByFormula = `{Company ID} = "${companyId}"`;
  }

  const records = await base(CLIENT_INSIGHTS_TABLE).select(selectOptions).all();

  for (const record of records) {
    const fields = record.fields;
    const companyIds = fields['Company'] as string[] | undefined;

    insights.push({
      id: record.id,
      title: (fields['Title'] as string) || '',
      body: (fields['Body'] as string) || '',
      companyId: companyIds?.[0] || (fields['Company ID'] as string) || '',
      category: (fields['Category'] as string) || 'other',
      severity: (fields['Severity'] as string) || 'medium',
    });
  }

  return insights;
}

/**
 * Update an insight in Airtable
 */
async function updateInsight(
  id: string,
  title: string,
  body: string
): Promise<void> {
  const base = getBase();

  await base(CLIENT_INSIGHTS_TABLE).update([
    {
      id,
      fields: {
        Title: title,
        Body: body,
      } as any,
    },
  ]);
}

// ============================================================================
// Task Detection
// ============================================================================

/**
 * Check if an insight title looks like a task
 */
function isTaskLikeTitle(title: string): boolean {
  const lowerTitle = title.toLowerCase().trim();

  // Check if starts with a task verb
  for (const verb of TASK_VERBS) {
    if (lowerTitle.startsWith(verb + ' ')) {
      return true;
    }
  }

  // Check for imperative patterns like "Do the thing"
  if (/^[a-z]+ (the|a|an|your|their|more|better|new) /.test(lowerTitle)) {
    return true;
  }

  return false;
}

// ============================================================================
// AI Rephrasing
// ============================================================================

/**
 * Use AI to rephrase a task-like insight as a condition
 */
async function rephraseAsCondition(
  anthropic: Anthropic,
  taskTitle: string,
  taskBody: string
): Promise<{ title: string; body: string }> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: `You rephrase tasks as observations/conditions.

Given a task-like statement, rephrase it as a factual observation about what IS true or IS missing.
The insight should describe the current state or gap, NOT what someone should do.

RULES:
- DO NOT use imperative verbs like "Create", "Add", "Develop", "Improve"
- DO NOT phrase as recommendations or suggestions
- DO describe what IS true or IS missing
- Keep the title concise (under 80 characters ideally)
- The body should explain the observation with supporting detail

Examples:
- Task: "Create a pricing page with clear tiers"
- Condition: { "title": "Website lacks a pricing page", "body": "The website does not have a dedicated pricing page, making it difficult for visitors to understand service costs and compare options." }

- Task: "Improve homepage CTAs"
- Condition: { "title": "Homepage CTAs are weak or unclear", "body": "The current homepage call-to-action buttons lack visual prominence and compelling copy, reducing conversion potential." }

- Task: "Develop a blog content strategy"
- Condition: { "title": "No consistent blog content strategy exists", "body": "The company lacks a defined content publishing schedule and topical focus, resulting in sporadic or missing blog content." }

Return ONLY valid JSON: { "title": "...", "body": "..." }`,
    messages: [
      {
        role: 'user',
        content: `Rephrase this task as a condition-based observation:

Title: ${taskTitle}

Body: ${taskBody}

Return valid JSON only.`,
      },
    ],
  });

  const textContent = response.content.find((b) => b.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from response');
  }

  return JSON.parse(jsonMatch[0]);
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;
  const companyArg = args.find((a) => a.startsWith('--company='));
  const companyId = companyArg ? companyArg.split('=')[1] : undefined;

  console.log('='.repeat(60));
  console.log('Client Insights Cleanup Script');
  console.log('='.repeat(60));
  console.log(
    `Mode: ${dryRun ? 'DRY RUN (preview only)' : 'EXECUTE (will update Airtable)'}`
  );
  console.log(`Limit: ${limit} insights`);
  if (companyId) {
    console.log(`Company filter: ${companyId}`);
  }
  console.log('');

  // Check environment variables
  const apiKey =
    process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || !baseId) {
    console.error('❌ Missing Airtable credentials!');
    console.error('   Please set AIRTABLE_API_KEY and AIRTABLE_BASE_ID');
    process.exit(1);
  }

  if (!anthropicKey) {
    console.error('❌ Missing ANTHROPIC_API_KEY!');
    console.error('   Please set ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  // Initialize Anthropic client
  const anthropic = new Anthropic();

  // Fetch insights from Airtable
  console.log('Fetching insights from Airtable...');
  let insights: AirtableInsight[];

  try {
    insights = await fetchAllInsights(companyId, limit);
    console.log(`✅ Fetched ${insights.length} insights`);
  } catch (error) {
    console.error('❌ Failed to fetch insights:', error);
    process.exit(1);
  }

  if (insights.length === 0) {
    console.log('No insights found to process.');
    return;
  }

  console.log('');
  console.log('Scanning insights for task-like language...');
  console.log('');

  let taskCount = 0;
  let processedCount = 0;
  let errorCount = 0;

  for (const insight of insights) {
    const isTask = isTaskLikeTitle(insight.title);

    if (isTask) {
      taskCount++;
      console.log(`[TASK] ${insight.title}`);
      console.log(`       ID: ${insight.id}`);

      try {
        const rephrased = await rephraseAsCondition(
          anthropic,
          insight.title,
          insight.body
        );
        console.log(`       → New title: "${rephrased.title}"`);
        console.log(
          `       → New body: "${rephrased.body.substring(0, 100)}..."`
        );

        if (!dryRun) {
          await updateInsight(insight.id, rephrased.title, rephrased.body);
          console.log('       ✅ Updated in Airtable');
          processedCount++;
        } else {
          console.log('       (dry run - not updated)');
        }
      } catch (error) {
        console.log(
          `       ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        errorCount++;
      }
      console.log('');

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      // Uncomment below to see all insights being checked
      // console.log(`[OK  ] ${insight.title}`);
    }
  }

  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Total insights scanned: ${insights.length}`);
  console.log(`  Task-like insights found: ${taskCount}`);
  console.log(`  Condition-based insights: ${insights.length - taskCount}`);

  if (!dryRun) {
    console.log(`  Successfully updated: ${processedCount}`);
    console.log(`  Errors: ${errorCount}`);
  }

  if (dryRun && taskCount > 0) {
    console.log('');
    console.log('Run with --execute to apply these changes.');
  }

  console.log('='.repeat(60));
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
