# Context Population Matrix

## Overview

This document tracks how each diagnostic source writes data to the Context Graph. For each source, we verify:

1. **Writes to table**: Which Airtable table stores the run data
2. **Output field**: Which field contains the JSON output
3. **Expected JSON path**: Where the lab result is nested in the output
4. **Reader**: Which importer/writer reads and processes the data
5. **Status**: Current working state

## Lab Sources

| Source | Tool ID | Writes To | Output Field | JSON Path | Reader | Status |
|--------|---------|-----------|--------------|-----------|--------|--------|
| Website Lab | `websiteLab` | DIAGNOSTIC_RUNS | rawJson | `rawEvidence.labResultV4` | `websiteLabImporter` + postRunHooks | ✅ FIXED |
| Brand Lab | `brandLab` | DIAGNOSTIC_RUNS | rawJson | `rawEvidence.labResultV4` → `result` → root | `brandLabImporter` + postRunHooks | ✅ FIXED |
| SEO Lab | `seoLab` | DIAGNOSTIC_RUNS | rawJson | `rawEvidence.labResultV4` → `findings` → root | `seoLabImporter` | ✅ FIXED |
| Content Lab | `contentLab` | DIAGNOSTIC_RUNS | rawJson | `rawEvidence.labResultV4` → `findings` → root | `contentLabImporter` | ✅ FIXED |
| Demand Lab | `demandLab` | DIAGNOSTIC_RUNS | rawJson | `rawEvidence.labResultV4` → `findings` → root | `demandLabImporter` | ✅ FIXED |
| Ops Lab | `opsLab` | DIAGNOSTIC_RUNS | rawJson | `rawEvidence.labResultV4` → `findings` → root | `opsLabImporter` | ✅ FIXED |
| Audience Lab | `audienceLab` | Audience Model | N/A | N/A (uses own storage) | `audienceLabImporter` | ✅ OK |
| Competition Lab | `competitionLab` | Competition Runs | N/A | N/A (uses own storage) | `competitionLabImporter` | ✅ OK |

## GAP Sources

| Source | Table | Output Field | JSON Path | Reader | Confidence | Status |
|--------|-------|--------------|-----------|--------|------------|--------|
| GAP Snapshot | DIAGNOSTIC_RUNS | rawJson | `initialAssessment` | `gapImporter` + postRunHooks | 0.85 | ✅ OK |
| GAP IA | GAP_IA_RUNS | core/dimensions/summary | N/A (structured) | `gapImporter` | 0.85 | ✅ OK |
| GAP Plan | GAP_PLAN_RUN | Data JSON | `gapStructured` + `insights` | `gapPlanImporter` | 0.6 | ✅ OK |
| GAP Heavy | GAP_HEAVY_RUNS | evidencePack | `evidencePack.*` | Legacy fallback only | 0.85 | ✅ LEGACY |

## Confidence Tiers

| Source Type | Confidence | Notes |
|------------|------------|-------|
| User/Human | 1.0 | Manually confirmed data |
| Labs | 0.85 | Primary source for domain |
| GAP Plan | 0.6 | Secondary, gap-filling only |

## Post-Run Hooks (Domain Writers)

| Tool ID | Has Domain Writer | Extraction Path | Status |
|---------|-------------------|-----------------|--------|
| `websiteLab` | ✅ Yes | `rawEvidence.labResultV4.siteAssessment` | ✅ FIXED |
| `brandLab` | ✅ Yes | `rawEvidence.labResultV4` → `result` → root | ✅ FIXED |
| `gapSnapshot` | ✅ Yes | `initialAssessment` | ✅ OK |
| `seoLab` | ⚠️ Importer only | Importers read on-demand | ✅ OK (importer fixed) |
| `contentLab` | ⚠️ Importer only | Importers read on-demand | ✅ OK (importer fixed) |
| `demandLab` | ⚠️ Importer only | Importers read on-demand | ✅ OK (importer fixed) |
| `opsLab` | ⚠️ Importer only | Importers read on-demand | ✅ OK (importer fixed) |
| `audienceLab` | ⚠️ Own storage | Uses audience model | ✅ OK |
| `competitionLab` | ⚠️ Own storage | Uses competition runs | ✅ OK |

## Fix Status

### ✅ COMPLETED: Lab Importers (DIAGNOSTIC_RUNS + labResultV4)

All lab importers now:
1. Check DIAGNOSTIC_RUNS table first (`listDiagnosticRunsForCompany`)
2. Extract from `rawJson.rawEvidence.labResultV4` first
3. Fall back to legacy paths (`result`, `findings`, root) if needed
4. Fall back to GAP_HEAVY_RUNS if no DIAGNOSTIC_RUNS data (brand only)

Fixed importers:
- `websiteLabImporter` ✅
- `brandLabImporter` ✅
- `seoLabImporter` ✅
- `contentLabImporter` ✅
- `demandLabImporter` ✅
- `opsLabImporter` ✅

### ✅ VERIFIED: postRunHooks Writers

Domain writers exist for WebsiteLab, BrandLab, and GapSnapshot. Other labs use on-demand import via their importers.

### ✅ VERIFIED: GAP Sources

GAP sources already read from correct tables:
- GAP IA: GAP_IA_RUNS (structured fields)
- GAP Plan: GAP_PLAN_RUN (Data JSON → gapStructured)
- GAP Heavy: Legacy fallback only

---

*Last updated: 2025-12-18*
