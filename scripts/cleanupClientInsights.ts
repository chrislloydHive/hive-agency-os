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
 *   --limit N    Process at most N insights (default: 100)
 */

import Anthropic from '@anthropic-ai/sdk';

// Import Airtable helpers - these paths assume running from project root
// You may need to adjust based on your tsconfig paths
const BASE_PATH = process.cwd();

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
];

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

  // Check for imperative patterns
  if (/^[a-z]+ (the|a|an|your|their) /.test(lowerTitle)) {
    return true;
  }

  return false;
}

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

Example:
- Task: "Create a pricing page with clear tiers"
- Condition: "The website does not have a pricing page, making pricing unclear to visitors"

Example:
- Task: "Improve homepage CTAs"
- Condition: "Homepage CTAs are weak, inconsistent, or hard to see"

Return JSON: { "title": "...", "body": "..." }`,
    messages: [
      {
        role: 'user',
        content: `Rephrase this task as a condition-based observation:\n\nTitle: ${taskTitle}\n\nBody: ${taskBody}\n\nReturn valid JSON.`,
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

/**
 * Main migration function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

  console.log('='.repeat(60));
  console.log('Client Insights Cleanup Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : 'EXECUTE (will update Airtable)'}`);
  console.log(`Limit: ${limit} insights`);
  console.log('');

  // Initialize Anthropic client
  const anthropic = new Anthropic();

  // NOTE: This script is a stub. To make it fully functional:
  // 1. Import the actual Airtable helpers
  // 2. Fetch all insights from the Client Insights table
  // 3. Filter to task-like ones using isTaskLikeTitle()
  // 4. Rephrase each using rephraseAsCondition()
  // 5. Update in Airtable if not dry-run

  console.log('This is a stub script. To use it:');
  console.log('');
  console.log('1. Ensure ANTHROPIC_API_KEY is set in your environment');
  console.log('2. Ensure AIRTABLE_API_KEY and AIRTABLE_BASE_ID are set');
  console.log('3. Uncomment the actual implementation below');
  console.log('');
  console.log('Example implementation flow:');
  console.log('');

  // Simulated example of what the script would do:
  const exampleInsights = [
    { id: 'rec123', title: 'Create a pricing page with clear tiers', body: 'The pricing should be transparent.' },
    { id: 'rec456', title: 'Develop a blog content strategy', body: 'Need regular content publishing.' },
    { id: 'rec789', title: 'The homepage lacks clear CTAs', body: 'Users are not guided to next steps.' }, // Already condition-based
  ];

  console.log('Scanning insights for task-like language...');
  console.log('');

  for (const insight of exampleInsights) {
    const isTask = isTaskLikeTitle(insight.title);
    console.log(`[${isTask ? 'TASK' : 'OK  '}] ${insight.title}`);

    if (isTask) {
      if (dryRun) {
        console.log('       Would rephrase with AI...');
        console.log('');

        // Actually call AI to show what the rephrasing would be
        try {
          const rephrased = await rephraseAsCondition(anthropic, insight.title, insight.body);
          console.log(`       New title: "${rephrased.title}"`);
          console.log(`       New body: "${rephrased.body}"`);
        } catch (error) {
          console.log(`       Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        console.log('');
      } else {
        console.log('       Rephrasing and updating...');
        // In execute mode, would actually update Airtable
      }
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  const taskCount = exampleInsights.filter((i) => isTaskLikeTitle(i.title)).length;
  console.log(`  Total insights scanned: ${exampleInsights.length}`);
  console.log(`  Task-like insights found: ${taskCount}`);
  console.log(`  Condition-based insights: ${exampleInsights.length - taskCount}`);

  if (dryRun) {
    console.log('');
    console.log('Run with --execute to apply changes.');
  }
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
