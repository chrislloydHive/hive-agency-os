# Media Releases table setup (Client PM OS base)

Create the **Media Releases** table in the Client PM OS Airtable base with the following schema. Use the same base as other OS tables (e.g. Projects, Jobs) — `AIRTABLE_OS_BASE_ID` / `AIRTABLE_BASE_ID`.

## Prerequisites

- **Projects** table exists (for Job # / Project link).
- **Creative Assets** table exists. For the “# Approved Assets” rollup to work, Creative Assets must have:
  - An **Approval Status** field (Single select), e.g. options: `Approved`, `Pending`, `Rejected`.
  - A **formula** field (e.g. named **Approved**) with formula:  
    `IF({Approval Status} = "Approved", 1, 0)`  
    so the rollup can SUM this value.

## 1. Create the table

- In the Client PM OS base, create a new table named **Media Releases**.
- Set the primary field name to **Release Name** (or create a first field with that name and make it the primary).

## 2. Add fields (in order)

| Field name             | Type          | Options / notes |
|------------------------|---------------|------------------|
| **Release Name**       | Single line text | Primary field. |
| **Job # / Project**     | Link to another record | Link to **Projects**; allow linking to multiple records = **No** (single project). |
| **Media Partner**      | Single select | Options as needed (e.g. partner names). |
| **Channels**           | Multiple select | Options as needed (e.g. Display, Social, Video). |
| **Release Type**       | Single select | Options: **Initial**, **Optimization**, **Replacement**, **Test**, **Reporting**. |
| **Release Date**      | Date          | Date only. |
| **Status**             | Single select | Options: **Draft**, **Ready to Send**, **Sent**, **Confirmed Live**, **Archived**. |
| **Release Assets**     | Link to another record | Link to **Creative Assets**; allow linking to **multiple** records. |
| **Release Folder URL** | URL           | — |
| **Release Sheet URL**  | URL           | — |
| **Instructions / Notes** | Long text   | — |
| **Traffic Instructions** | Long text   | — |

## 3. Rollups (on Release Assets link)

Add two rollup fields that use the **Release Assets** link to **Creative Assets**:

### # Assets Linked

- **Field name:** `# Assets Linked`
- **Type:** Rollup
- **Link field:** Release Assets
- **Field from Creative Assets:** any field (e.g. primary or **Approved**)
- **Rollup type:** **COUNT ALL** (count of linked records)

### # Approved Assets

- **Field name:** `# Approved Assets`
- **Type:** Rollup
- **Link field:** Release Assets
- **Field from Creative Assets:** the numeric **Approved** formula field (1 when Approved, 0 otherwise)
- **Rollup type:** **SUM VALUES**

## 4. Formula: Delivery Readiness

Add a formula field that blocks “send” unless at least one asset is linked and all linked assets are approved:

- **Field name:** `Delivery Readiness`
- **Type:** Formula
- **Formula:**

```text
IF(
  AND(
    {# Assets Linked} >= 1,
    {# Approved Assets} = {# Assets Linked}
  ),
  "Ready",
  "Blocked"
)
```

So:
- **Ready** — at least one asset linked and every linked asset is approved.
- **Blocked** — no assets linked, or at least one linked asset is not approved.

Use **Delivery Readiness** in views or automations to gate “Ready to Send” or sending (e.g. only allow when value is `Ready`).

## 5. Code reference

- Table constant: `AIRTABLE_TABLES.MEDIA_RELEASES` → `"Media Releases"`.
- Creative Assets table: `AIRTABLE_TABLES.CREATIVE_ASSETS` → `"Creative Assets"`.
- CRUD and types: `lib/airtable/mediaReleases.ts` (`getMediaReleasesByProject`, `getMediaReleaseById`, `createMediaRelease`, `updateMediaRelease`, `deleteMediaRelease`).

---

# Creative Assets table (Client PM OS base)

Ensure the **Creative Assets** table exists in the same base and has the following. Keep the existing **Approval Status** field; it is used in Media Releases rollups.

## Existing fields (keep)

| Field name        | Type          | Notes |
|-------------------|---------------|--------|
| **Name**          | Single line text | Primary (or your existing primary). |
| **Approval Status** | Single select | e.g. **Approved**, **Pending**, **Rejected**. Used by Media Releases "# Approved Assets" rollup. |
| **Approved**      | Formula       | `IF({Approval Status} = "Approved", 1, 0)` — used by Media Releases rollup SUM. |

## New fields to add

| Field name            | Type          | Options / notes |
|-----------------------|---------------|------------------|
| **Media Releases**    | Link to another record | Link to **Media Releases**; allow linking to **multiple** records. (Inverse of Media Releases’ “Release Assets”.) |
| **Delivered?**        | Formula       | `IF(COUNTA({Media Releases})>0,"Yes","No")` |
| **Delivery Count**    | Rollup       | **Link field:** Media Releases. **Field from Media Releases:** any (e.g. Release Name). **Rollup type:** **COUNT ALL** (count of linked Media Releases). |
| **Replaces Asset**    | Link to another record | Link to **Creative Assets**; allow linking to **one** record. |
| **Channel**           | Single select | Options as needed (e.g. Display, Social, Video). |
| **Format / Size**     | Single line text or Single select | As needed. |
| **Clickthrough URL**  | URL          | — |
| **Landing Page Override** | URL       | — |

## Formula: Delivered?

- **Field name:** `Delivered?`
- **Type:** Formula
- **Formula:**

```text
IF(COUNTA({Media Releases})>0,"Yes","No")
```

## Rollup: Delivery Count

- **Field name:** `Delivery Count`
- **Type:** Rollup
- **Link field:** Media Releases
- **Field from Media Releases:** any field (e.g. Release Name)
- **Rollup type:** **COUNT ALL**

## Optional: Clickthrough URL (or Override) for export

For the Release Export view, add a formula that shows Landing Page Override when present, otherwise Clickthrough URL:

- **Field name:** `Clickthrough URL (or Override)`
- **Type:** Formula
- **Formula:** `IF({Landing Page Override}, {Landing Page Override}, {Clickthrough URL})`

(If you prefer two columns, use **Clickthrough URL** and **Landing Page Override** separately.)

## Optional: Notes field

If you want a **Notes** column in the export view, add a **Long text** field named **Notes** to Creative Assets.

---

## View: Release Export – Current

Create this view in the **Creative Assets** table so you can filter by a specific Media Release and see only Approved assets in export order.

### 1. Create the view

- In the Creative Assets table, click **+ Add view**.
- Name it: **Release Export – Current**.

### 2. Filters

Add two filters (both must match):

| Filter | Condition |
|--------|-----------|
| **Media Releases** | contains → *[choose the release when using the view]* |
| **Approval Status** | is → **Approved** |

To use the view: open it and set the **Media Releases** filter to the current release (or leave it empty to see all releases, then narrow by changing the filter).

### 3. Field order (visible columns, left to right)

Show only these fields in this order:

1. **Name** (asset name)
2. **Channel**
3. **Format / Size**
4. **Clickthrough URL (or Override)** — or **Clickthrough URL** then **Landing Page Override** if you didn’t add the formula
5. **Notes** (add a Notes field if you don’t have one)
6. **Replaces Asset**

Hide all other fields in this view (or remove them from the view) so the export is clean.

### 4. Optional view settings

- **Sort:** e.g. by Name or Channel if you want a stable export order.
- **Group by:** leave ungrouped unless you want grouping by Channel or similar.

---

## Code reference (Creative Assets)

- Table: `AIRTABLE_TABLES.CREATIVE_ASSETS` → `"Creative Assets"`.
- Types and CRUD: `lib/airtable/creativeAssets.ts` — `CreativeAsset`, `CREATIVE_ASSET_FIELDS`, `getCreativeAssetById`, `createCreativeAsset`, `updateCreativeAsset`.
