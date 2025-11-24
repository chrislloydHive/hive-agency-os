// lib/inngest/client.ts
// Inngest client for background job processing

import { Inngest } from 'inngest';

// Create Inngest client
// Event key should be set in environment variables
export const inngest = new Inngest({
  id: 'hive-forms',
  name: 'Hive Forms Background Jobs',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
