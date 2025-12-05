# AI Gateway (aiForCompany)

The AI Gateway is the central entry point for all AI operations in Hive OS that are bound to a specific company.

## What it Does

The `aiForCompany()` function:

1. **Loads Company Memory** - Automatically fetches historical context (Client Brain) for the company
2. **Injects Context** - Adds relevant memory to the AI prompt for smarter, personalized responses
3. **Calls OpenAI** - Makes the API call with your system/task prompts
4. **Saves to Memory** - Writes a summary of the response back to the company's AI memory

## When to Use It

**Use `aiForCompany()` when:**
- The AI operation is tied to a specific company
- You want the AI to have context about previous interactions
- You want the response saved to the company's Client Brain

**Use `aiSimple()` when:**
- The operation is NOT tied to a specific company
- No company context is needed or available
- You don't want to save the response to memory

## Import

```typescript
import { aiForCompany, aiSimple } from '@/lib/ai';
```

## Basic Usage

```typescript
const { content, memorySaved } = await aiForCompany(companyId, {
  type: 'Work Item',              // Type of memory entry to create
  tags: ['SEO', 'Website'],       // Tags for categorization
  relatedEntityId: workItemId,    // Link to related entity (optional)
  systemPrompt: 'You are...',     // System instructions
  taskPrompt: 'Generate...',      // The specific task
  createdBy: 'Hive OS - Feature', // Attribution
});
```

## Example: Work Item Guide

```typescript
import { aiForCompany, suggestTagsFromContent } from '@/lib/ai';

const tags = suggestTagsFromContent(workItem.title, workItem.area);

const { content } = await aiForCompany(workItem.companyId, {
  type: 'Work Item',
  tags,
  relatedEntityId: workItemId,
  systemPrompt: `You are a senior digital marketing specialist...`,
  taskPrompt: `Generate an implementation guide for: ${workItem.title}`,
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 2000,
  memoryOptions: {
    limit: 15,  // Fetch up to 15 memory entries
  },
  summarizer: (content) => extractSummary(content),
  createdBy: 'Hive OS - Work Item Guide',
});
```

## Example: Analytics Insights

```typescript
import { aiForCompany } from '@/lib/ai';

const { content } = await aiForCompany(companyId, {
  type: 'Analytics Insight',
  tags: ['Analytics', 'SEO'],
  systemPrompt: ANALYTICS_SYSTEM_PROMPT,
  taskPrompt: `Analyze this data: ${JSON.stringify(analyticsData)}`,
  jsonMode: true,  // Request JSON response
  memoryOptions: {
    limit: 10,
    types: ['GAP IA', 'GAP Full', 'Analytics Insight'],
  },
  createdBy: 'Hive OS - Analytics AI',
});

const insights = JSON.parse(content);
```

## Example: GAP Assessment

```typescript
import { aiForCompany } from '@/lib/ai';

const { content } = await aiForCompany(companyId, {
  type: 'GAP IA',
  tags: deriveGapTags(result),
  relatedEntityId: runId,
  systemPrompt: GAP_SYSTEM_PROMPT,
  taskPrompt: `Assess this website: ${websiteUrl}`,
  summarizer: (content) => extractGapSummary(content),
  createdBy: 'Hive OS - GAP IA',
});
```

## Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | `CompanyAiContextType` | required | Type of memory entry (e.g., 'Work Item', 'GAP IA') |
| `tags` | `string[]` | `[]` | Tags for categorization |
| `relatedEntityId` | `string \| null` | `null` | Link to related entity |
| `systemPrompt` | `string` | `''` | System instructions for the AI |
| `taskPrompt` | `string` | required | The specific task/question |
| `model` | `string` | `'gpt-4o-mini'` | OpenAI model to use |
| `temperature` | `number` | `0.4` | Response randomness (0-1) |
| `maxTokens` | `number` | undefined | Max tokens for response |
| `jsonMode` | `boolean` | `false` | Request JSON response format |
| `memoryOptions.limit` | `number` | `20` | Max memory entries to fetch |
| `memoryOptions.types` | `CompanyAiContextType[]` | undefined | Filter memory by type |
| `memoryOptions.tags` | `string[]` | undefined | Filter memory by tags |
| `memoryOptions.sinceDate` | `string` | undefined | Only fetch memory after date |
| `skipMemorySave` | `boolean` | `false` | Don't save response to memory |
| `summarizer` | `(content: string) => string` | truncate to 500 chars | Custom summary extractor |
| `createdBy` | `string` | `'Hive OS'` | Attribution for memory entry |

## Memory Types

Valid values for `type`:

- `'GAP IA'` - Initial GAP assessment results
- `'GAP Full'` - Full Growth Acceleration Plan results
- `'Work Item'` - Work item implementation guides
- `'Analytics Insight'` - Analytics AI insights
- `'Manual Note'` - User-entered notes
- `'Strategy'` - Strategic summaries
- `'Other'` - Miscellaneous

## Important Notes

1. **All new AI features must use `aiForCompany()`** when bound to a company
2. Memory saves are non-blocking - if save fails, the AI response still returns
3. The summarizer function controls what gets saved to memory (keep it concise)
4. Memory is automatically injected into prompts with context header
5. Use `skipMemorySave: true` if you don't want to create a memory entry

## Migration Guide

For existing direct OpenAI calls:

1. Find files with `getOpenAI()` or `openai.chat.completions.create`
2. Check if `companyId` is available
3. If yes: refactor to use `aiForCompany()`
4. If no: add TODO comment and use `aiSimple()` or leave as-is

```typescript
// Before
const openai = getOpenAI();
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
});
const content = completion.choices[0]?.message?.content;

// After
const { content } = await aiForCompany(companyId, {
  type: 'Work Item',
  systemPrompt,
  taskPrompt: userPrompt,
  createdBy: 'Feature Name',
});
```

## Files Using the Gateway

- `app/api/work/additional-info/route.ts` - Work item guides
- `lib/os/companies/analyticsAi.ts` - Company analytics insights

## Files with TODO (pending migration)

- `app/api/os/briefing/route.ts` - Global dashboard briefing (no company context)
- `lib/growth-plan/*.ts` - GAP engine (works with URLs, not company IDs)
