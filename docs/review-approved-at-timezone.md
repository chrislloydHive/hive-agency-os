# Approved At time in Airtable

Approval timestamps (e.g. **Approved At** in Creative Review Asset Status, Creative Review Group Approvals, Creative Review Sets) are stored in Airtable as **UTC** (ISO 8601). The app sends the time from the **client** when the user clicks Approve so the recorded moment matches the user’s action.

## If the time looks wrong in Airtable (e.g. “ahead” of your local time)

Airtable **displays** date/time fields using the **base’s timezone**, not the viewer’s. If you see a time that’s ahead of (or behind) your local time, set the base timezone so it matches how you want to see times.

1. In Airtable, open the base that contains the review tables (Client PM OS base).
2. Go to **Base settings** (gear or base name menu).
3. Set **Time zone** to your team’s timezone (e.g. **America/Los_Angeles**, **America/New_York**).
4. Save.

After that, stored UTC values will be shown in that timezone (e.g. 10:00 AM Pacific instead of 6:00 PM UTC).

## Code

- **Client** sends `approvedAt: new Date().toISOString()` when calling the approve and feedback APIs so the server uses the user’s moment.
- **Server** uses `resolveApprovedAt(body.approvedAt)` in `lib/review/approvedAt.ts` to accept that timestamp when it’s valid (and fall back to server time otherwise).
