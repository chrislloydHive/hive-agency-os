# Context Graph V4: Facts-First + Review Queue

## Overview

Context V4 introduces a **review-first workflow** for managing company context data. Instead of Labs/GAP directly writing to the Context Graph, they propose facts that users can review, confirm, edit, or reject.

## Architecture

```
                   Labs/GAP
                      │
                      ▼
            ┌─────────────────┐
            │  Propose Field  │  (status: proposed)
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  Review Queue   │  (UI: /context-v4/{companyId}/review)
            └────────┬────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
      Confirm     Reject       Edit
         │           │           │
         └─────┬─────┘           │
               ▼                 ▼
      ┌────────────────┐  ┌─────────────────┐
      │ Update V4 Store│  │ Update + Confirm │
      └───────┬────────┘  └────────┬────────┘
              │                    │
              └──────────┬─────────┘
                         ▼
            ┌─────────────────────┐
            │  Materialize to     │
            │  Context Graph      │  (backward compat)
            └─────────────────────┘
```

## Feature Flag

V4 is gated behind `CONTEXT_V4_ENABLED`:

```bash
# Enable V4
CONTEXT_V4_ENABLED=true
```

All V4 APIs and UI check this flag and return 404 when disabled.

## Data Model

### ContextFieldV4

First-class record for each fact:

```typescript
interface ContextFieldV4 {
  key: string;              // "identity.industry"
  domain: string;           // "identity"
  value: unknown;           // The fact value
  status: 'confirmed' | 'proposed' | 'rejected';
  source: 'user' | 'lab' | 'gap' | 'ai' | 'import' | 'crm';
  sourceId?: string;        // Run ID or user ID
  confidence: number;       // 0-1
  updatedAt: string;        // ISO timestamp
  evidence?: {
    runId?: string;
    snippet?: string;
    rawPath?: string;
  };
  lockedAt?: string;        // When user confirmed
  lockedBy?: string;        // Who confirmed
  rejectedAt?: string;
  rejectedReason?: string;
  rejectedSourceId?: string; // Blocks re-proposal from same source
}
```

### Storage

V4 fields are stored in Airtable table `ContextFieldsV4` as JSON blobs:

| Column | Type | Description |
|--------|------|-------------|
| Company ID | Text | Links to company |
| Fields JSON | Long Text | All fields as JSON |
| Updated At | Date | Last modification |
| Field Count | Number | Total fields |
| Proposed Count | Number | Pending review |
| Confirmed Count | Number | Approved facts |

## Merge Rules

When a new field is proposed, these rules determine if it can be written:

1. **No existing** → Allow (create new proposed field)
2. **Existing confirmed** → Block (confirmed facts are immutable by AI)
3. **Existing rejected, same source** → Block (user already rejected this evidence)
4. **Existing rejected, different source** → Allow (new evidence, user can re-review)
5. **Existing proposed, higher confidence** → Allow (better evidence wins)
6. **Existing proposed, same/lower confidence** → Block (keep existing)

## APIs

All APIs are under `/api/os/companies/[companyId]/context/v4/`

### GET /context/v4
Returns the Fact Sheet view model.

**Response:**
```json
{
  "ok": true,
  "companyId": "...",
  "companyName": "...",
  "domains": [
    {
      "domain": "identity",
      "label": "Company Identity",
      "confirmed": [...],
      "proposedCount": 3,
      "missingKeys": [...],
      "completeness": 75
    }
  ],
  "totalConfirmed": 42,
  "totalProposed": 8,
  "totalMissing": 15
}
```

### GET /context/v4/review
Returns proposed fields for the review queue.

**Query params:**
- `domain` - Filter by domain
- `source` - Filter by source
- `limit` - Max results (default 50)
- `offset` - Pagination offset

### POST /context/v4/confirm
Confirms one or more proposed fields.

**Request:**
```json
{
  "keys": ["identity.industry", "brand.tagline"]
}
```

**Response:**
```json
{
  "ok": true,
  "confirmed": ["identity.industry", "brand.tagline"],
  "failed": []
}
```

Confirmed fields are automatically materialized to the existing Context Graph.

### POST /context/v4/reject
Rejects one or more proposed fields.

**Request:**
```json
{
  "keys": ["identity.industry"],
  "reason": "Incorrect industry classification"
}
```

### POST /context/v4/update
User edit: creates or updates a field as confirmed + locked.

**Request:**
```json
{
  "key": "identity.industry",
  "value": "Financial Services"
}
```

## UI

### Fact Sheet
`/context-v4/{companyId}`

- Tabs by domain
- Shows confirmed facts
- Indicates proposed count per domain
- Links to review queue

### Review Queue
`/context-v4/{companyId}/review`

- Lists proposed facts
- Filters by domain and source
- Batch confirm/reject
- Evidence drawer for each fact

### Review CTA
The Strategic Map shows a "Review X facts" banner when `proposedCount > 0`.

## Backward Compatibility

### Materialization

When fields are confirmed, they're written to the existing Context Graph:

```typescript
// In materializeV4.ts
await materializeConfirmedToGraph(companyId);
```

This ensures:
- Strategy surfaces read from the existing graph
- Work surfaces continue to function
- No changes needed to downstream consumers

### Provenance

Materialized fields have:
- `source: 'user'` (treated as human source)
- `humanConfirmed: true` (locked from AI overwrites)
- `confirmedBy` with user ID
- `notes` indicating V4 origin

## Testing

### Manual Acceptance Test

1. Enable V4: `CONTEXT_V4_ENABLED=true`
2. Open `/context-v4/{companyId}`
3. POST a field via `/context/v4/update`:
   ```bash
   curl -X POST /api/os/companies/{id}/context/v4/update \
     -H "Content-Type: application/json" \
     -d '{"key": "identity.industry", "value": "Technology"}'
   ```
4. Verify field appears in Fact Sheet as confirmed
5. Verify field appears in existing Context Graph (via inspector)
6. Confirm 3 fields via review queue
7. Verify they materialize to Context Graph

### Unit Tests

- `tests/context/fieldStoreV4.test.ts` - Merge rules
- `tests/context/v4-api.test.ts` - API flow

## Phase 2: Ingestion Intercept

After Phase 1 is stable, labs can be wired to propose instead of direct write:

```typescript
// Instead of:
setFieldUntyped(graph, domain, field, value, provenance);

// Use:
await proposeFieldV4(companyId, {
  key: `${domain}.${field}`,
  value,
  source: 'lab',
  sourceId: runId,
  confidence: 0.8,
  evidence: { runId, snippet, rawPath },
});
```

This is opt-in per importer and can be rolled out gradually.
