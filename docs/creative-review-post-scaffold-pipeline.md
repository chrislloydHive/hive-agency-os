# Creative review: post-scaffold pipeline

This document matches the code as of the fix for cross-base CRAS + delivery reads (`shouldLinkProjectFieldOnCras`, delivery webhooks on `getProjectsBase()`).

## Airtable bases

| Base | Typical env | Tables in this flow |
|------|-------------|---------------------|
| **Client PM OS** | `AIRTABLE_PROJECTS_BASE_ID` | Projects, Creative Review Sets (CRS), CRAS, Creative Review Group Approvals, Partner Delivery Batches, Companies (for PDB `Partner` link) |
| **Hive Database** | `AIRTABLE_OS_BASE_ID` / `AIRTABLE_BASE_ID` | Companies (client OAuth / client code) — **not** where CRAS lives when PM base is set |

All CRAS / CRS / PDB / project reads for the review portal and delivery must use **`getProjectsBase()`**. Hive **`getBase()`** is only for OS-side tables (e.g. Hive `Companies` when resolving Google OAuth for a client).

## End-to-end flow

### 1. Project + scaffold (working)

1. **Project** row exists in Client PM OS (`Projects`).
2. **Scaffold** (`POST /api/os/creative/scaffold`): reads Project + linked Company from the correct bases, creates Drive job folder + tactic/variant tree, copies the review sheet, upserts **CRS** rows (variant × tactic) in the **projects** base, writes hub URL + **`Client Review Portal Token`** on the Project.
3. After a successful scaffold, the app **fire-and-forget** calls **`ensurePartnerDeliverySetup`** so a **Partner Delivery Batches** row tends to exist before the first asset (still idempotent if ingest also calls it).

### 2. Partner Delivery Batch (PDB)

- **Not** required for an asset to **appear** in the portal. Portal assets are **CRAS-driven** after the first client refresh.
- **Created by code**: `ensurePartnerDeliverySetup` (from scaffold, from **`ingestFileToCras`** on first CRAS create, and from **`ingestCreativeFilesScheduled`** once per project per cron tick).
- **Airtable side**: the row is created with `Create Partner Batch` toggled false → true so an automation (`Initialize Partner Delivery Batch`) can create Drive partner structure. **`Make Active`** is a human (or separate automation) step before delivery runs.
- **Project field “Create Partner Batch”** (`fldB5eusW4LAacAjT`): if present in your base, it is an **Airtable** trigger for your own automation — the app does not write that field today; app flow uses **`ensurePartnerDeliverySetup`** → PDB table + `Create Partner Batch` **on the batch record**.

### 3. Asset upload → portal display

1. **Drive**: files live under the job folder ID stored on the Project as **`Creative Review Hub Folder ID`** (same id CRS rows use for `Folder ID`).
2. **Server render** (`/review/[token]`): loads CRS from the **projects** base, lists files in each CRS folder with **company Google OAuth**, then **`batchEnsureCrasRecords`** creates missing **CRAS** rows (`Project` link + `Show in Client Portal` = true, token via lookup from Project).
3. **Client refresh** (~250ms later): **`GET /api/review/assets`** loads **`listAssetStatuses(token)`** — **Airtable-first**. Only CRAS rows for that portal token drive the UI. If CRAS creation was blocked, the UI becomes empty after refresh even if the server render briefly listed Drive files.

**Ingest cron** (`ingestCreativeFilesScheduled`, Inngest every 5 minutes): lists files under each project’s CRH folder using **service account / WIF** (`getDriveClient`). That only sees folders the SA can access; company-only folders need SA sharing or rely on portal SSR + `batchEnsureCrasRecords` instead.

### 4. Client approval → partner folders / copy

1. **`POST /api/review/assets/approve`**: sets **Asset Approved (Client)** (and related fields) on CRAS via **`setSingleAssetApprovedClient`** — does **not** copy to partner Drive by itself.
2. **Partner Delivery Batches status:** Some Airtable automations (e.g. production checklist) require a batch row with **Status** = `Delivering`. Batches often sit in **`Active`** until handoff. After each successful approve, **`syncPartnerDeliveryBatchesForApprovedCras`** sets the linked batch (from CRAS **Partner Delivery Batch** or the project’s primary **Active** batch) to **`Delivering`**. Opt out with **`PARTNER_BATCH_SET_DELIVERING_ON_APPROVE=0`** if your base uses different select options.
3. **Delivery** is still driven by **Partner Delivery Batch** activation (`Make Active`, `Start Delivery`, or webhooks / Inngest **`partner.delivery.requested`**) per `docs/partner-delivery.md`.
4. **`POST /api/delivery/partner/approved`**: resolves batch id from the **CRAS** record; CRAS reads use **`getProjectsBase()`**.

## Regression note (Apr 9–10 class of bugs)

When **`AIRTABLE_PROJECTS_BASE_ID`** split from OS, **`shouldLinkProjectFieldOnCras()`** incorrectly returned false (it compared projects base id to **OS** base id). That blocked **`batchEnsureCrasRecords`** / **`ensureCrasRecord`** whenever the CRAS token field is a **lookup** (cannot write token on create), so no CRAS rows → empty portal after `/api/review/assets` refresh. Separately, any **`getBase()`** + CRAS table read would hit the wrong base and break delivery webhooks.

## Env: Brkthru partner row

`Partner` on **Partner Delivery Batches** must link to a **Companies** row in the **same** base as the batch (Client PM). Optional override: **`BRKTHRU_PARTNER_COMPANY_RECORD_ID`** (Airtable record id, e.g. `recVzyPAcfZXQoEtj`).
