#!/usr/bin/env node
/**
 * ESLint Warning Budget Guard
 *
 * Prevents warning regressions in CI. Compares current ESLint warning count
 * against a hardcoded baseline. Fails only if warnings INCREASE.
 *
 * Usage:
 *   npm run lint:budget
 *
 * Exit codes:
 *   0 - warnings ≤ baseline (pass)
 *   1 - warnings > baseline (fail)
 */

const { spawn } = require('child_process');
const path = require('path');

// ---------------------------------------------------------------------------
// Baseline Configuration
// ---------------------------------------------------------------------------
// Update this number intentionally after cleaning up warnings.
// Never increase it - only decrease after verified cleanup.

const BASELINE_WARNINGS = 3068;

// ---------------------------------------------------------------------------
// ESLint Configuration
// ---------------------------------------------------------------------------

const ROOT_DIR = path.join(__dirname, '..');

// Must match package.json "lint" script targets
const ESLINT_TARGETS = [
  'app/**/*.{ts,tsx}',
  'components/**/*.{ts,tsx}',
  'lib/**/*.{ts,tsx}',
  'hooks/**/*.{ts,tsx}',
  'types/**/*.{ts,tsx}',
];

// ---------------------------------------------------------------------------
// ESLint Runner
// ---------------------------------------------------------------------------

function runEslint() {
  return new Promise((resolve, reject) => {
    const args = [
      'eslint',
      ...ESLINT_TARGETS,
      '--format', 'json',
      '--cache',
      '--no-error-on-unmatched-pattern',
    ];

    const child = spawn('npx', args, {
      cwd: ROOT_DIR,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', () => {
      if (stdout.trim()) {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error('Failed to parse ESLint JSON output'));
        }
      } else if (stderr && !stdout.trim()) {
        reject(new Error(`ESLint failed: ${stderr}`));
      } else {
        resolve([]);
      }
    });

    child.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

function countIssues(results) {
  let errorCount = 0;
  let warningCount = 0;

  for (const file of results) {
    errorCount += file.errorCount || 0;
    warningCount += file.warningCount || 0;
  }

  return { errorCount, warningCount };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printResult(errorCount, warningCount, passed) {
  const delta = warningCount - BASELINE_WARNINGS;
  const deltaStr = delta === 0 ? '±0' : delta > 0 ? `+${delta}` : `${delta}`;

  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log('  ESLint Warning Budget');
  console.log('════════════════════════════════════════════════');
  console.log(`  Current:  ${warningCount}`);
  console.log(`  Baseline: ${BASELINE_WARNINGS}`);
  console.log(`  Delta:    ${deltaStr}`);
  console.log('────────────────────────────────────────────────');

  if (errorCount > 0) {
    console.log(`  Errors:   ${errorCount} (must be 0)`);
  }

  if (passed) {
    console.log('  Result:   ✅ PASS');
  } else {
    console.log('  Result:   ❌ FAIL');
  }

  console.log('════════════════════════════════════════════════');

  if (!passed) {
    console.log('');
    if (warningCount > BASELINE_WARNINGS) {
      console.log(`ESLint warnings increased: ${warningCount} > ${BASELINE_WARNINGS}`);
      console.log('Please fix new warnings before merging.');
    }
    if (errorCount > 0) {
      console.log('ESLint errors must be fixed before merging.');
    }
  }

  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Running ESLint...');

  const results = await runEslint();
  const { errorCount, warningCount } = countIssues(results);

  // Pass if: no errors AND warnings ≤ baseline
  const passed = errorCount === 0 && warningCount <= BASELINE_WARNINGS;

  printResult(errorCount, warningCount, passed);

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
