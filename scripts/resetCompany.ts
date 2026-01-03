#!/usr/bin/env ts-node
import { applyCompanyReset } from '@/lib/os/reset/applyCompanyReset';
import { randomUUID } from 'crypto';

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (const arg of args) {
    const [k, v] = arg.replace(/^--/, '').split('=');
    options[k] = v || 'true';
  }
  return options;
}

async function main() {
  const opts = parseArgs();
  const companyId = opts.companyId;
  const mode = (opts.mode === 'apply' ? 'apply' : 'dryRun') as 'dryRun' | 'apply';
  const resetKind = (opts.resetKind === 'hard' ? 'hard' : 'soft') as 'soft' | 'hard';
  const confirmHardDelete = opts.confirmHardDelete === 'true';
  const resetBatchId = opts.resetBatchId || randomUUID();

  if (!companyId) {
    console.error('Usage: node scripts/resetCompany.ts --companyId recXXXX --mode dryRun|apply --resetKind soft|hard [--confirmHardDelete=true]');
    process.exit(1);
  }

  if (resetKind === 'hard' && (!confirmHardDelete || mode !== 'apply')) {
    console.error('Hard delete requires mode=apply and --confirmHardDelete=true');
    process.exit(1);
  }

  const result = await applyCompanyReset({
    companyId,
    mode,
    resetKind,
    resetBatchId,
    confirmHardDelete,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

