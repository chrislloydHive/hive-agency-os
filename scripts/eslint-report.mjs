#!/usr/bin/env node
/**
 * ESLint Report Generator
 *
 * Reads ESLint JSON output and generates a developer-friendly summary:
 * - Top 15 rules by count
 * - Top 20 files by warning count
 * - For each of top 5 rules: top 10 files with that rule
 *
 * Usage:
 *   npm run lint:report
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const REPORT_FILE = join(ROOT_DIR, 'reports', 'eslint.json');

/**
 * Load and parse the ESLint JSON report
 */
function loadReport() {
  try {
    const content = readFileSync(REPORT_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Could not read report file: ${REPORT_FILE}`);
    console.error('Run: npm run lint:report');
    process.exit(1);
  }
}

/**
 * Get relative path from project root
 */
function relativePath(filePath) {
  return relative(ROOT_DIR, filePath);
}

/**
 * Aggregate issues by rule
 */
function aggregateByRule(results) {
  const ruleMap = new Map();

  for (const file of results) {
    for (const message of file.messages) {
      const ruleId = message.ruleId || 'unknown';
      if (!ruleMap.has(ruleId)) {
        ruleMap.set(ruleId, { count: 0, files: new Map() });
      }
      const rule = ruleMap.get(ruleId);
      rule.count++;

      const filePath = relativePath(file.filePath);
      rule.files.set(filePath, (rule.files.get(filePath) || 0) + 1);
    }
  }

  // Convert to sorted array (deterministic: by count desc, then rule name asc)
  return Array.from(ruleMap.entries())
    .map(([ruleId, data]) => ({
      ruleId,
      count: data.count,
      files: Array.from(data.files.entries())
        .map(([file, count]) => ({ file, count }))
        .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)),
    }))
    .sort((a, b) => b.count - a.count || a.ruleId.localeCompare(b.ruleId));
}

/**
 * Aggregate issues by file
 */
function aggregateByFile(results) {
  const fileMap = new Map();

  for (const file of results) {
    const filePath = relativePath(file.filePath);
    const total = file.errorCount + file.warningCount;
    if (total > 0) {
      fileMap.set(filePath, {
        errors: file.errorCount,
        warnings: file.warningCount,
        total,
      });
    }
  }

  // Convert to sorted array (deterministic: by total desc, then path asc)
  return Array.from(fileMap.entries())
    .map(([file, data]) => ({ file, ...data }))
    .sort((a, b) => b.total - a.total || a.file.localeCompare(b.file));
}

/**
 * Print a section header
 */
function printHeader(title) {
  console.log('');
  console.log('\x1b[1m' + '='.repeat(70) + '\x1b[0m');
  console.log('\x1b[1m  ' + title + '\x1b[0m');
  console.log('='.repeat(70));
}

/**
 * Print a sub-header
 */
function printSubHeader(title) {
  console.log('');
  console.log('\x1b[36m  ' + title + '\x1b[0m');
  console.log('  ' + '-'.repeat(66));
}

/**
 * Pad string to fixed width
 */
function pad(str, width, align = 'left') {
  const s = String(str);
  if (align === 'right') {
    return s.padStart(width);
  }
  return s.padEnd(width);
}

/**
 * Truncate path for display
 */
function truncatePath(path, maxLen = 55) {
  if (path.length <= maxLen) return path;
  return '...' + path.slice(-(maxLen - 3));
}

function main() {
  const results = loadReport();

  // Calculate totals
  let totalErrors = 0;
  let totalWarnings = 0;
  for (const file of results) {
    totalErrors += file.errorCount || 0;
    totalWarnings += file.warningCount || 0;
  }

  const byRule = aggregateByRule(results);
  const byFile = aggregateByFile(results);

  // Summary header
  printHeader('ESLint Report Summary');
  console.log(`  Total files analyzed: ${results.length}`);
  console.log(`  Total errors:         \x1b[${totalErrors > 0 ? '31' : '32'}m${totalErrors}\x1b[0m`);
  console.log(`  Total warnings:       \x1b[33m${totalWarnings}\x1b[0m`);
  console.log(`  Unique rules:         ${byRule.length}`);

  // Top 15 rules by count
  printHeader('Top 15 Rules by Issue Count');
  console.log('  ' + pad('#', 4) + pad('Count', 8, 'right') + '  ' + 'Rule');
  console.log('  ' + '-'.repeat(66));

  const top15Rules = byRule.slice(0, 15);
  top15Rules.forEach((rule, i) => {
    const num = pad(i + 1, 3);
    const count = pad(rule.count, 7, 'right');
    console.log(`  ${num} ${count}  ${rule.ruleId}`);
  });

  // Top 20 files by warning count
  printHeader('Top 20 Files by Issue Count');
  console.log('  ' + pad('#', 4) + pad('Err', 5, 'right') + pad('Warn', 6, 'right') + '  ' + 'File');
  console.log('  ' + '-'.repeat(66));

  const top20Files = byFile.slice(0, 20);
  top20Files.forEach((file, i) => {
    const num = pad(i + 1, 3);
    const errors = pad(file.errors, 4, 'right');
    const warnings = pad(file.warnings, 5, 'right');
    const errColor = file.errors > 0 ? '\x1b[31m' : '';
    const reset = file.errors > 0 ? '\x1b[0m' : '';
    console.log(`  ${num} ${errColor}${errors}${reset} ${warnings}  ${truncatePath(file.file)}`);
  });

  // For each of top 5 rules: top 10 files
  printHeader('Top 5 Rules - File Breakdown');

  const top5Rules = byRule.slice(0, 5);
  top5Rules.forEach((rule, ruleIndex) => {
    printSubHeader(`${ruleIndex + 1}. ${rule.ruleId} (${rule.count} total)`);

    const top10Files = rule.files.slice(0, 10);
    top10Files.forEach((file, fileIndex) => {
      const num = pad(fileIndex + 1, 3);
      const count = pad(file.count, 5, 'right');
      console.log(`    ${num} ${count}  ${truncatePath(file.file, 50)}`);
    });

    if (rule.files.length > 10) {
      console.log(`    ... and ${rule.files.length - 10} more files`);
    }
  });

  // Footer
  console.log('');
  console.log('='.repeat(70));
  console.log(`  Report generated from: reports/eslint.json`);
  console.log('='.repeat(70));
  console.log('');
}

main();
