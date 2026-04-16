const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const files = [
  'lib/airtable/activityLog.ts',
  'lib/airtable/bases.ts',
  'lib/airtable/tasks.ts',
  'app/api/os/tasks/auto-triage/route.ts',
  'app/api/os/gmail/draft-reply/route.ts',
  'app/api/os/activity/log/route.ts',
];

let hadError = false;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const diags = sf.parseDiagnostics || [];
  if (diags.length) {
    hadError = true;
    console.log(`${f}: ${diags.length} parse errors`);
    for (const d of diags) {
      const { line, character } = sf.getLineAndCharacterOfPosition(d.start || 0);
      console.log(`  [${line+1}:${character+1}] ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    }
  } else {
    console.log(`${f}: OK`);
  }
}
process.exit(hadError ? 1 : 0);
