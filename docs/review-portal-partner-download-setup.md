# Review Portal: Partner download setup

For partners to see **New / All Approved / Downloaded** tabs, **Mark all as seen**, and **per-asset download** on the review portal, the app must get a **delivery context** (batch + destination folder) for the project. That comes from Airtable.

## Required Airtable setup

### 1. Partner Delivery Batches table

A table **Partner Delivery Batches** with at least:

| Field name               | Type   | Required | Notes |
|--------------------------|--------|----------|--------|
| **Batch ID**             | Text   | Yes      | Unique id for this batch (e.g. UUID or slug). |
| **Destination Folder ID**| Text   | Yes      | Google Drive folder ID where “Export Approved” copies files. |
| **Vendor Name**          | Text   | Optional | Shown in the portal (e.g. partner name). |
| **Partner Last Seen At** | DateTime | Optional | Set when partner clicks “Mark all as seen”. |
| **New Approved Count**   | Number | Optional | Can be maintained by automation. |
| **Downloaded Count**     | Number | Optional | Can be maintained by automation. |

Create one row per “delivery batch” (e.g. per partner or per campaign). Copy the **Batch ID** value; you’ll link it to the project.

### 2. Project record

On the **Project** that uses the review portal (same record that has **Client Review Portal Token**), set **one** of:

- **Partner Delivery Batch** (linked record) – link to the **Partner Delivery Batches** row for this project, **or**
- **Delivery Batch ID** (text) – the **Batch ID** value from that row (e.g. `batch-2024-01-car-toys`).

If the **Partner Delivery Batches** table is in the **same base** as **Projects**, you can use either the link or the text field. If the batch table is in a **different base** (e.g. Client PM base), you must use **Delivery Batch ID** (text) on the project, because links don’t work across bases.

### 3. Which base is used

- **Projects** are read from the app’s default Airtable base (`AIRTABLE_BASE_ID` / `AIRTABLE_OS_BASE_ID`).
- **Partner Delivery Batches** is read from that same base first. If the batch table lives in another base (e.g. Client PM), set in Vercel:
  - **`PARTNER_DELIVERY_BASE_ID`** = that base’s ID (e.g. `appVLDjqK2q4IJhGz`).
  The app will then look up the batch by **Batch ID** in that base after checking the default base.

  **Note:** “Mark all as seen” and delivery status write-back currently target the default base. If you use `PARTNER_DELIVERY_BASE_ID`, those updates may need to be extended to write to that base too (code can be updated if needed).

## Checklist

1. [ ] **Partner Delivery Batches** table exists and has at least **Batch ID** and **Destination Folder ID**.
2. [ ] One batch row created; **Destination Folder ID** is a valid Drive folder ID.
3. [ ] On the **Project** (review portal token): **Partner Delivery Batch** linked to that row **or** **Delivery Batch ID** (text) set to that row’s Batch ID.
4. [ ] If the batch table is in a different base: **PARTNER_DELIVERY_BASE_ID** set in Vercel to that base ID.

After that, reload the review portal; you should see the partner header (Mark all as seen, Export Approved), the New / All Approved / Downloaded tabs, and per-asset download.
