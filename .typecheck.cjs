const ts = require('typescript');
const path = require('path');

const rootFiles = [
  'lib/riskDetection.ts',
  'lib/airtable/activityLog.ts',
  'lib/decisionEngine.ts',
  'lib/gmail/createDraftReply.ts',
  'app/api/os/tasks/risks/route.ts',
  'app/api/os/tasks/[id]/decide/route.ts',
  'app/api/os/tasks/[id]/apply-decision/route.ts',
  'app/api/os/brief/morning/route.ts',
  'app/api/os/command-center/route.ts',
  'app/tasks/command-center/RiskStrip.tsx',
  'app/tasks/command-center/MorningBrief.tsx',
  'app/tasks/command-center/MorningBriefFocusRow.tsx',
  'app/tasks/command-center/TaskDecider.tsx',
  'app/tasks/command-center/TaskEditPanel.tsx',
  'app/tasks/command-center/CommandCenterClient.tsx',
  'scripts/evalDecisionEngine.ts',
];

const configPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');
const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configPath));

const program = ts.createProgram({
  rootNames: rootFiles,
  options: { ...parsed.options, noEmit: true, skipLibCheck: true, incremental: false },
});

const keep = new Set(rootFiles.map(f => path.resolve(f)));
const diags = ts.getPreEmitDiagnostics(program).filter(d => {
  return d.file ? keep.has(path.resolve(d.file.fileName)) : false;
});

if (!diags.length) { console.log('OK: type-check clean for changed files'); process.exit(0); }
const host = {
  getCanonicalFileName: p => p,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
};
console.log(ts.formatDiagnosticsWithColorAndContext(diags, host));
process.exit(1);
