# Creative Review Hub: Bulk Approve (Approve Displayed)

The **Approve Displayed** button in the client-facing Creative Review Hub sets **Asset Approved (Client)** = true on each asset currently shown in the active variant (Prospecting or Retargeting). It does not approve future assets; only the visible list is updated.

## Airtable

- **Table:** Creative Review Asset Status (`AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS`)
- **Field updated by the app:** **Asset Approved (Client)** (checkbox). The app only sets this to `true`. Airtable automation can set **Approved At**, **Needs Delivery**, etc.

### If your base uses a different field name

Change the constant in code so the app writes to the correct column:

- **File:** `lib/airtable/reviewAssetStatus.ts`
- **Constant:** `ASSET_APPROVED_CLIENT_FIELD` (default: `'Asset Approved (Client)'`)

Update it to match your table’s field name, e.g. `'Client Approved'`.

## Environment

No new env vars are required. The app uses the same Airtable base as other review features (`AIRTABLE_OS_BASE_ID` / `AIRTABLE_BASE_ID` and `AIRTABLE_API_KEY`).

## Flow

1. User clicks **Approve Displayed** (only shown when there are assets in the current view).
2. Client sends `POST /api/review/assets/bulk-approve` with `{ token, fileIds }` (fileIds = all assets in the active variant).
3. Server resolves token, gets Airtable record IDs for those fileIds that are not already approved, then updates in chunks of 10 (Airtable limit).
4. On success: toast “Approved X assets (Y already approved)”, then assets list is refreshed.
5. On partial or full failure: toast shows error and, if partial, how many were approved before failure.

## Code reference

- **API:** `app/api/review/assets/bulk-approve/route.ts`
- **Airtable helpers:** `lib/airtable/reviewAssetStatus.ts` — `getRecordIdsForBulkApprove`, `batchSetAssetApprovedClient`, `ASSET_APPROVED_CLIENT_FIELD`
- **UI:** `app/(public)/review/[token]/ReviewPortalClient.tsx` — “Approve Displayed” button, `handleBulkApprove`, toast state
