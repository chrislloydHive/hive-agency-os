# Airtable Approval Automations

This document provides exact step-by-step configuration for Airtable automations to ensure `Approved At` is properly set in CRAS (Creative Review Asset Status) records.

## Task A: Single-Asset Approval Automation

**Purpose:** Ensure `Approved At` is stamped whenever `Status = "Approved"` and `Approved At` is empty.

### Automation Configuration

1. **Go to:** Airtable base → Extensions → Automations
2. **Click:** "Create a new automation"
3. **Name:** "Set Approved At on Status Change"

#### Trigger Configuration:
- **Trigger Type:** "When record matches conditions"
- **Table:** "Creative Review Asset Status"
- **Conditions:**
  - Condition 1:
    - Field: `Status`
    - Operator: `is exactly`
    - Value: `Approved`
  - Condition 2:
    - Field: `Approved At`
    - Operator: `is empty`
  - Logic: `AND` (both conditions must be true)

#### Action Configuration:
- **Action Type:** "Update record"
- **Table:** "Creative Review Asset Status"
- **Record:** "Use the record from the trigger"
- **Fields to update:**
  - Field: `Approved At`
  - Value: `NOW()` (Airtable dynamic value - current time)

#### Additional Settings:
- **Run conditions:** Leave default (runs automatically)
- **Error handling:** "Continue running automation even if this action fails"

---

## Task B: Group Approval Propagation Automation

**Purpose:** When a group is approved, propagate approval to all matching CRAS records.

### Automation Configuration

1. **Go to:** Airtable base → Extensions → Automations
2. **Click:** "Create a new automation"
3. **Name:** "Propagate Group Approval to Assets"

#### Trigger Configuration:
- **Trigger Type:** "When record matches conditions"
- **Table:** "Creative Review Group Approvals"
- **Conditions:**
  - Field: `Approved At`
  - Operator: `is not empty`

#### Action Configuration:
- **Action Type:** "Run script"
- **Script:** Use the code below

### Script Code for Task B

```javascript
// Group Approval Propagation Script
// Updates all CRAS records matching the group approval's Review Token + Group Key

let groupApproval = input.config();
let table = base.getTable("Creative Review Asset Status");
let groupApprovalsTable = base.getTable("Creative Review Group Approvals");

// Get the group approval record details
let groupApprovalRecord = await groupApprovalsTable.selectRecordsAsync({
    recordIds: [groupApproval.recordId]
});
let groupFields = groupApprovalRecord.records[0].fields;

let reviewToken = groupFields["Review Token"];
let groupKey = groupFields["Group Key"];
let approvedAt = groupFields["Approved At"];
let approvedByName = groupFields["Approved By Name"] || null;
let approvedByEmail = groupFields["Approved By Email"] || null;

if (!reviewToken || !groupKey || !approvedAt) {
    console.log("Missing required fields: reviewToken, groupKey, or approvedAt");
    output.set("updated", 0);
    output.set("skipped", 0);
    return;
}

// Build query to find matching CRAS records
// Match by Review Token AND (Tactic + Variant matching Group Key)
let groupKeyParts = groupKey.split("::");
if (groupKeyParts.length !== 2) {
    console.log("Invalid Group Key format:", groupKey);
    output.set("updated", 0);
    output.set("skipped", 0);
    return;
}

let tactic = groupKeyParts[0];
let variant = groupKeyParts[1];

// Query CRAS records matching Review Token, Tactic, and Variant
let query = await table.selectRecordsAsync({
    filterByFormula: `AND(
        {Review Token} = "${reviewToken}",
        {Tactic} = "${tactic}",
        {Variant} = "${variant}"
    )`
});

let recordsToUpdate = [];
let skipped = 0;

for (let record of query.records) {
    let fields = record.fields;
    
    // Skip if already approved with Approved At set
    if (fields["Approved At"] && fields["Status"] === "Approved") {
        skipped++;
        continue;
    }
    
    // Prepare update fields
    let updateFields = {
        "Status": "Approved",
        "Approved At": approvedAt,
        "Asset Approved (Client)": true
    };
    
    // Add Approved By fields if present
    if (approvedByName) {
        updateFields["Approved By Name"] = approvedByName;
    }
    if (approvedByEmail) {
        updateFields["Approved By Email"] = approvedByEmail;
    }
    
    recordsToUpdate.push({
        id: record.id,
        fields: updateFields
    });
}

// Batch update records (Airtable allows up to 50 records per batch)
let batchSize = 50;
let updated = 0;

for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
    let batch = recordsToUpdate.slice(i, i + batchSize);
    
    for (let recordUpdate of batch) {
        try {
            await table.updateRecordAsync(recordUpdate.id, recordUpdate.fields);
            updated++;
        } catch (error) {
            console.error(`Failed to update record ${recordUpdate.id}:`, error);
        }
    }
}

output.set("updated", updated);
output.set("skipped", skipped);
output.set("total", query.records.length);
```

### Script Input Configuration:
- **Input:** "Record ID" from trigger
- **Variable name:** `recordId`

### Script Output:
- `updated`: Number of CRAS records updated
- `skipped`: Number of records already approved
- `total`: Total matching records found

---

## Alternative: Code-Based Solution

If you prefer to handle this in code rather than Airtable automations, we can update the API routes to:

1. **Always set `Approved At`** when `Status = "Approved"` (even if not provided, use current time)
2. **Propagate group approvals** to CRAS records when a group is approved

This would be more reliable and easier to debug than Airtable automations.
