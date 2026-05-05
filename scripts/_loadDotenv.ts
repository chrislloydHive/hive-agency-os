// scripts/_loadDotenv.ts
// Side-effect-only loader for .env / .env.local.
//
// Importing this file as the FIRST import of a CLI script guarantees that
// process.env is populated before any other module is evaluated. ES modules
// evaluate imports depth-first in source order, so a top-of-file
// `import './_loadDotenv';` runs before sibling imports like
// `import { ... } from '@/lib/airtable/...'` snapshot env vars at module load.
//
// Why this exists: scripts that did
//
//   import { config } from 'dotenv';
//   config({ path: '.env' });
//   config({ path: '.env.local' });
//   import { foo } from '@/lib/...';
//
// look correct textually but break under ESM — the textual `config()` calls
// run *after* `@/lib/...` has already evaluated and captured (empty) env vars.

import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local' });
