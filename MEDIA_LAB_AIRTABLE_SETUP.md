# Media Lab V1 - Airtable Setup Guide

## Overview

This guide walks you through setting up the three new Airtable tables required for Media Lab V1, plus updating your Companies table with media fields.

## Table 1: Media Plans

**Table Name:** `Media Plans`

### Fields to Create:

| Field Name | Type | Options/Settings |
|------------|------|------------------|
| Company | Link to another record | → Companies table |
| Name | Single line text | Required |
| Status | Single select | Options: `draft`, `proposed`, `active`, `paused`, `archived` |
| Objective | Single select | Options: `installs`, `leads`, `store_visits`, `calls`, `awareness` |
| Timeframe Start | Date | Include time: No |
| Timeframe End | Date | Include time: No |
| Total Budget | Currency | Format: USD $ |
| Primary Markets | Long text | Plain text |
| Has Seasonal Flights | Checkbox | |
| Notes | Long text | Plain text |
| Created At | Created time | |
| Updated At | Last modified time | |

### Example Record:

```
Company: [Link to Car Toys]
Name: "Car Toys WA+CO 2025 Core Plan"
Status: active
Objective: installs
Timeframe Start: 2025-01-01
Timeframe End: 2025-12-31
Total Budget: $240,000
Primary Markets: "Seattle, Tacoma, Denver, Colorado Springs"
Has Seasonal Flights: ✓
Notes: "Focus on remote start season Q1 and holiday Q4"
```

## Table 2: Media Plan Channels

**Table Name:** `Media Plan Channels`

### Fields to Create:

| Field Name | Type | Options/Settings |
|------------|------|------------------|
| Media Plan | Link to another record | → Media Plans table |
| Channel | Single select | See channel options below |
| % of Budget | Number | Precision: 0, Format: Percent |
| $ Budget | Currency | Format: USD $ |
| Expected Installs / Leads | Number | Integer |
| Expected CPL / CPI | Currency | Format: USD $ |
| Priority | Single select | Options: `core`, `supporting`, `experimental` |
| Notes | Long text | Plain text |

### Channel Options:
- `google_search`
- `google_lsas`
- `google_maps_gbp`
- `paid_social_meta`
- `display_retarg`
- `radio`
- `other`

### Example Records:

```
Record 1:
Media Plan: [Link to Car Toys plan]
Channel: google_search
% of Budget: 35
$ Budget: $84,000
Expected Installs / Leads: 420
Expected CPL / CPI: $200
Priority: core

Record 2:
Media Plan: [Link to Car Toys plan]
Channel: google_lsas
% of Budget: 25
$ Budget: $60,000
Expected Installs / Leads: 300
Expected CPL / CPI: $200
Priority: core

Record 3:
Media Plan: [Link to Car Toys plan]
Channel: paid_social_meta
% of Budget: 20
$ Budget: $48,000
Expected Installs / Leads: 160
Expected CPL / CPI: $300
Priority: supporting
```

## Table 3: Media Plan Flights

**Table Name:** `Media Plan Flights`

### Fields to Create:

| Field Name | Type | Options/Settings |
|------------|------|------------------|
| Media Plan | Link to another record | → Media Plans table |
| Name | Single line text | Required |
| Season | Single select | See season options below |
| Start Date | Date | Include time: No |
| End Date | Date | Include time: No |
| Budget | Currency | Format: USD $ |
| Primary Channels | Multiple select | Use same options as Channel field above |
| Markets / Stores | Long text | Plain text |
| Notes | Long text | Plain text |

### Season Options:
- `remote_start`
- `holiday`
- `carplay_season`
- `summer_audio`
- `other`

### Example Records:

```
Record 1:
Media Plan: [Link to Car Toys plan]
Name: "Remote Start Season"
Season: remote_start
Start Date: 2025-01-01
End Date: 2025-03-31
Budget: $80,000
Primary Channels: google_search, google_lsas, paid_social_meta
Markets / Stores: "All WA stores; Denver + CO Springs"
Notes: "Heavy push for remote start installs in cold months"

Record 2:
Media Plan: [Link to Car Toys plan]
Name: "Holiday Q4 Push"
Season: holiday
Start Date: 2025-11-01
End Date: 2025-12-31
Budget: $100,000
Primary Channels: google_search, google_maps_gbp, display_retarg
Markets / Stores: "All locations"
Notes: "Gift-giving season, CarPlay focus"
```

## Table 4: Companies (Updates)

**Table Name:** `Companies` (existing table)

### New Fields to Add:

| Field Name | Type | Options/Settings |
|------------|------|------------------|
| Has Media Program | Checkbox | |
| Media Status | Single select | Options: `none`, `planning`, `running`, `paused` |
| Media Primary Objective | Single select | Options: `installs`, `leads`, `store_visits`, `calls`, `awareness` |
| Media Notes | Long text | Plain text |

### Example Company with Media:

```
[Existing Company Fields...]
Has Media Program: ✓
Media Status: running
Media Primary Objective: installs
Media Notes: "Focusing on install volume with remote start as hero product"
```

## Views to Create (Optional but Recommended)

### Media Plans Table Views:

1. **All Plans** (Default)
   - Sort: Created At (newest first)
   - Filter: None

2. **Active Plans Only**
   - Filter: Status is `active`
   - Group by: Company

3. **By Company**
   - Group by: Company
   - Sort: Status, then Name

### Media Plan Channels Table Views:

1. **All Channels**
   - Sort: % of Budget (descending)

2. **By Plan**
   - Group by: Media Plan
   - Sort: % of Budget (descending)

3. **Core Channels Only**
   - Filter: Priority is `core`

### Media Plan Flights Table Views:

1. **All Flights**
   - Sort: Start Date

2. **By Season**
   - Group by: Season
   - Sort: Start Date

3. **Upcoming Flights**
   - Filter: Start Date is within next 3 months

## Field Validation & Best Practices

### Media Plans:
- **Name:** Use descriptive names like "[Company] [Markets] [Year] [Type]"
- **Status:**
  - Use `draft` for plans being built
  - Use `proposed` for plans pending approval
  - Use `active` for currently running plans
  - Use `paused` for temporarily stopped plans
  - Use `archived` for completed/historical plans
- **Total Budget:** Sum of all channel budgets
- **Primary Markets:** Use comma-separated format for consistency

### Media Plan Channels:
- **% of Budget:** Should sum to 100% across all channels for a plan
- **$ Budget:** Should match (Total Budget × % of Budget)
- **Expected CPL/CPI:** Budget ÷ Expected Volume
- **Priority:**
  - `core` = Primary revenue driver, 50%+ of budget
  - `supporting` = Important but secondary, 15-40% of budget
  - `experimental` = Testing/learning, <15% of budget

### Media Plan Flights:
- **Dates:** Should fall within parent plan's timeframe
- **Budget:** Sum of flight budgets may exceed total budget (overlap is OK)
- **Primary Channels:** Select 2-4 channels per flight for focus

## Testing Your Setup

### Step 1: Create Test Company
1. Open Companies table
2. Create or find a test company
3. Set `Has Media Program` = ✓
4. Set `Media Status` = `planning`
5. Set `Media Primary Objective` = `installs`

### Step 2: Create Test Media Plan
1. Open Media Plans table
2. Click "+ New"
3. Link to your test company
4. Fill in required fields:
   - Name: "Test Plan 2025"
   - Status: active
   - Objective: installs
   - Total Budget: $100,000

### Step 3: Add Test Channels
1. Open Media Plan Channels table
2. Create 3 channels:

```
Channel 1:
- Link to Test Plan
- Channel: google_search
- % of Budget: 50
- $ Budget: $50,000

Channel 2:
- Link to Test Plan
- Channel: google_lsas
- % of Budget: 30
- $ Budget: $30,000

Channel 3:
- Link to Test Plan
- Channel: paid_social_meta
- % of Budget: 20
- $ Budget: $20,000
```

### Step 4: Add Test Flight
1. Open Media Plan Flights table
2. Create flight:

```
- Link to Test Plan
- Name: "Q1 Test Flight"
- Season: other
- Start Date: 2025-01-01
- End Date: 2025-03-31
- Budget: $25,000
- Primary Channels: google_search, google_lsas
```

### Step 5: Verify in UI
1. Navigate to `/media-lab/[testCompanyId]`
2. Verify plan appears
3. Verify channels show in channel mix
4. Verify flight appears in seasonal flights section
5. Check budget calculations are correct

## Common Issues & Solutions

### Issue: "Company link not working"
**Solution:** Make sure the Media Plan is linked to the correct Companies table, not a different base.

### Issue: "Channels not showing up"
**Solution:** Verify the "Media Plan" link field points to the correct plan record.

### Issue: "Budget percentages don't add to 100%"
**Solution:** This is just a warning - manually adjust % values or use a formula field to track.

### Issue: "Primary Channels field empty in flights"
**Solution:** Multi-select fields need exact option matches - verify spelling of channel names.

### Issue: "Date ranges overlap"
**Solution:** This is allowed - flights can overlap intentionally.

## Formula Fields (Optional)

### Media Plans: Budget Utilization Check
```
IF(
  SUM({Channel Budgets}) = {Total Budget},
  "✓ Allocated",
  CONCATENATE("⚠️ ",
    ROUND(({Total Budget} - SUM({Channel Budgets})), 0),
    " remaining"
  )
)
```

### Media Plan Channels: Budget Check
```
IF(
  {$ Budget} = {Total Budget} * ({% of Budget} / 100),
  "✓",
  "⚠️ Mismatch"
)
```

## Permissions & Access

Recommended Airtable permissions:
- **Editor:** Marketing team, ops team
- **Commenter:** Stakeholders who review plans
- **Read-only:** Finance, executives

Set up filtered views for each role:
- Marketing sees all active + draft plans
- Finance sees budget tracking views
- Executives see summary views only

## Next Steps

1. Complete table setup following this guide
2. Create test data as outlined above
3. Verify data appears in Media Lab UI
4. Train team on table structure and workflows
5. Import any existing media plans from spreadsheets
6. Set up automations (optional) for budget alerts

## Support

If you encounter issues:
1. Check field names match exactly (case-sensitive)
2. Verify linked records are in same base
3. Confirm option values match code expectations
4. Review console logs for validation errors
5. Check Airtable API permissions

All field names, types, and options must match exactly as specified for the Media Lab to work correctly!
