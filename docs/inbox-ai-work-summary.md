# Inbox AI Work Summary Fields

## Overview

The Gmail Inbox Review pipeline now generates a work summary (one-liner, bullets, category) in addition to individual tasks. This summary is stored on the **EMAIL CONTAINER record** (the source record with Trace ID) and is used in notification emails.

## New Airtable Fields

Add these fields to the **Inbox** table in Airtable:

### 1. AI Work Summary (Long text)
- **Field Name**: `AI Work Summary`
- **Type**: Long text
- **Format**: 
  ```
  One-liner summary (max 140 chars)
  - Bullet point 1
  - Bullet point 2
  - Bullet point 3
  ```
- **Purpose**: Human-readable summary of work to be done, formatted for email display

### 2. AI Work Category (Single select)
- **Field Name**: `AI Work Category`
- **Type**: Single select
- **Options**:
  - Creative Production
  - Media Ops
  - Reporting/Analytics
  - Client Comms
  - Project Management
  - Finance/Billing
  - Tech/Automation
  - Other
- **Purpose**: Categorizes the type of work requested

### 3. AI Summary JSON (Long text) - Optional
- **Field Name**: `AI Summary JSON`
- **Type**: Long text
- **Purpose**: Raw JSON output from AI for debugging purposes
- **Note**: This field is optional and can be omitted if not needed

## Field Mapping

The pipeline automatically:
1. Extracts `one_liner`, `summary_bullets`, and `category` from AI response
2. Formats `AI Work Summary` as: `one_liner` + bullets (each prefixed with `- `)
3. Writes `AI Work Category` (validated against allowed values)
4. Stores raw JSON in `AI Summary JSON` (if field exists)

## Email Template Updates

Update your Airtable notification email automation to include:

### Email Subject Line
```
{{Project}} — {{AI Work Category}} — {{one_liner}} ({{taskCount}} tasks)
```

**Fallback logic**: If any element is missing, use:
- Missing Project: `"{{AI Work Category}} — {{one_liner}} ({{taskCount}} tasks)"`
- Missing Category: `"{{Project}} — {{one_liner}} ({{taskCount}} tasks)"`
- Missing one_liner: `"{{Project}} — {{AI Work Category}} ({{taskCount}} tasks)"`

### Email Body (at top)
```
Project: {{Project}}
Category: {{AI Work Category}}
Trace ID: {{Trace ID}}

{{AI Work Summary}}

---
[Task list follows below]
```

## Troubleshooting

### Summary is Missing

**Symptom**: `AI Work Summary` field is empty or "Not specified"

**Possible Causes**:
1. AI extraction failed or returned invalid JSON
2. Email content was too vague for AI to generate summary
3. Field doesn't exist in Airtable schema

**Solutions**:
1. Check `AI Summary JSON` field for raw AI output
2. Check pipeline logs for `[INBOX_REVIEW_PIPELINE]` entries
3. Verify fields exist in Airtable Inbox table
4. Check `Trace ID` matches between container record and tasks

### Category is "Other"

**Symptom**: `AI Work Category` is always set to "Other"

**Possible Causes**:
1. AI couldn't determine category from email content
2. Category validation failed (invalid value from AI)

**Solutions**:
1. Check `AI Summary JSON` to see what category AI suggested
2. Verify category is one of the allowed values
3. Review email content - may need more context for AI to categorize

### Summary Formatting Issues

**Symptom**: Bullets not displaying correctly in email

**Possible Causes**:
1. Email template not handling line breaks correctly
2. Bullets formatted incorrectly

**Solutions**:
1. Ensure email template uses HTML formatting for line breaks (`<br>` or `<ul><li>`)
2. Check `AI Work Summary` field format: should have one-liner on first line, then bullets with `- ` prefix

### Container Record Not Updated

**Symptom**: Tasks created but container record missing AI fields

**Possible Causes**:
1. Container record update failed after task creation
2. Field names don't match exactly (case-sensitive)
3. Airtable API permissions issue

**Solutions**:
1. Check pipeline logs for `[INBOX_REVIEW_PIPELINE] SOURCE record updated` message
2. Verify field names match exactly: `AI Work Summary`, `AI Work Category`, `AI Summary JSON`
3. Check Airtable API key permissions
4. Verify `Trace ID` matches between container and tasks

## Testing Checklist

Test with these sample emails:

1. **Creative Production Email**
   - Input: Email requesting logo resizes with spec blocks
   - Expected: Category = "Creative Production", Summary includes spec details

2. **Client Comms Email**
   - Input: Email requesting meeting or update
   - Expected: Category = "Client Comms", Summary describes communication need

3. **Project Management Email**
   - Input: Email about timelines or coordination
   - Expected: Category = "Project Management", Summary describes project work

Verify:
- [ ] Container record has `AI Work Summary` populated
- [ ] Container record has `AI Work Category` set (not "Other" unless appropriate)
- [ ] Summary bullets are concrete and actionable (not vague)
- [ ] One-liner is <= 140 characters
- [ ] Email notification includes summary at top
- [ ] Email subject line includes category and one-liner

## Code Location

- **Pipeline**: `/lib/inbound/inbox-review-pipeline.ts`
- **Function**: `runInboxReviewPipeline()`
- **AI Extraction**: `openaiExtractInboxItems()`
- **Validation**: `validateExtractionResponse()`
- **Formatting**: `formatAIWorkSummary()`

## Field Creation Notes

If creating fields manually in Airtable:
1. Create `AI Work Summary` as Long text field
2. Create `AI Work Category` as Single select field with the 8 options listed above
3. Create `AI Summary JSON` as Long text field (optional, for debugging)

Field names are case-sensitive and must match exactly as shown above.
