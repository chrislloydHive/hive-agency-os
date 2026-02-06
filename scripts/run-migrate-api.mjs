#!/usr/bin/env node
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const baseUrl = process.argv[2] || 'http://localhost:3000';
const dryRun = process.argv.includes('--dry-run');
const secret = process.env.MIGRATE_SOURCE_FOLDER_SECRET || process.env.DELIVERY_WEBHOOK_SECRET;

if (!secret) {
  console.error('Set MIGRATE_SOURCE_FOLDER_SECRET or DELIVERY_WEBHOOK_SECRET in .env.local');
  process.exit(1);
}

const url = `${baseUrl}/api/dev/migrate-source-folder-id${dryRun ? '?dryRun=1' : ''}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { 'X-Migration-Secret': secret },
});
const body = await res.json();
console.log(JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
