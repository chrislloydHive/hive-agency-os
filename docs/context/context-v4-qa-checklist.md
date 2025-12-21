# Context V4 Launch QA Checklist

Internal QA checklist for verifying end-to-end Context V4 flow before launch.

## Prerequisites

- [ ] Environment variables set:
  - `CONTEXT_V4_ENABLED=true`
  - `CONTEXT_V4_INGEST_WEBSITELAB=true`
- [ ] Test company with completed WebsiteLab run

---

## 1. Proposal Cooldown

**Test: Verify 45-second cooldown after generating proposals**

1. Navigate to `/context-v4/[companyId]`
2. Click "Generate Proposals" button
3. Wait for proposals to complete
4. Attempt to click "Generate Proposals" again immediately
5. **Expected**: Button shows "Recently generated (Xs)" countdown
6. Wait 45 seconds
7. **Expected**: Button becomes active again

**API Test:**
```bash
# First call should succeed
curl -X POST /api/os/companies/[companyId]/context/v4/propose-baseline

# Second call within 45s should return 429
curl -X POST /api/os/companies/[companyId]/context/v4/propose-baseline
# Expected: 429 Too Many Requests with Retry-After header
```

---

## 2. Alternatives Cap

**Test: Verify max 5 alternatives per field**

1. Run multiple proposal sources for the same field
2. Check the review queue
3. **Expected**: Each field shows max 5 alternatives ("+N alt" badge)
4. Alternatives should be ordered by: priority > confidence > recency

---

## 3. Confirmed Snapshot

**Test: Verify snapshot endpoint returns confirmed-only fields**

1. Confirm at least 3 fields in the review queue
2. Call the snapshot endpoint:
```bash
curl /api/os/companies/[companyId]/context/v4/snapshot
```
3. **Expected Response**:
   - `snapshotId` starts with "snap_"
   - `fieldCount` matches confirmed count
   - `confirmedFieldsOnly` array contains only confirmed fields
   - No proposed fields included

---

## 4. Readiness Gate

**Test: Verify Strategy is blocked when readiness < 60%**

1. Clear/reset V4 store for test company
2. Navigate to Strategy generation page
3. **Expected**: "Context Not Ready" warning with missing fields list
4. Click on a missing field link
5. **Expected**: Navigates to Review Queue with domain filter
6. Confirm enough fields to reach 60% readiness
7. **Expected**: Generate button becomes active

**Override Test:**
1. With readiness < 60%, click locked generate button
2. Click "Generate Anyway" in confirmation dialog
3. **Expected**: Generation proceeds with warning

**API Test:**
```bash
curl /api/os/companies/[companyId]/context/v4/readiness?threshold=60
```
**Expected fields:**
- `readinessScore`: 0-100
- `ready`: boolean
- `requiredKeysMissing`: array of field keys
- `requiredKeysProposed`: array of field keys awaiting review

---

## 5. Navigation Consistency

**Test: Verify sub-nav appears on all Context V4 pages**

1. Navigate to `/context-v4/[companyId]` (Fact Sheet)
   - [ ] Sub-nav visible with tabs: Fact Sheet | Review | Fields
   - [ ] Badge counts display correctly

2. Navigate to `/context-v4/[companyId]/review` (Review Queue)
   - [ ] Same sub-nav visible
   - [ ] Active tab highlighted

3. Test breadcrumb "Back to Context"
   - [ ] Returns to last-used view

**Filter Persistence Test:**
1. In Review Queue, filter by domain (e.g., "website")
2. Navigate away and back
3. **Expected**: Filter maintained via URL params

---

## 6. End-to-End Flow

**Full integration test:**

1. Start with empty V4 store
2. Complete WebsiteLab run for test company
3. Navigate to `/context-v4/[companyId]`
4. Check nextAction banner shows "Ready to Generate"
5. Click "Generate Proposals"
6. Verify cooldown activates
7. Navigate to Review Queue
8. Verify proposals appear with trust badges
9. Confirm 3-5 key fields
10. Check readiness score increases
11. Generate snapshot via API
12. Verify snapshot contains confirmed fields only

---

## Known Limitations

- Cooldown is in-memory (resets on server restart in dev)
- Snapshot does not persist (generated on-demand)
- Alternatives eviction happens silently (no user notification)

---

## Smoke Test Commands

```bash
# Check V4 is enabled
curl /api/os/companies/[companyId]/context/v4/inspect

# Check readiness
curl /api/os/companies/[companyId]/context/v4/readiness

# Get snapshot
curl /api/os/companies/[companyId]/context/v4/snapshot

# Get review queue
curl /api/os/companies/[companyId]/context/v4/review
```

---

**Last Updated**: December 2024
**Owner**: Platform Team
