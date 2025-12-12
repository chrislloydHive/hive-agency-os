// lib/testing/index.ts
// Golden Test Set - Internal testing utilities

export { GOLDEN_COMPANIES, getGoldenCompanies, getGoldenCompanyById } from './goldenCompanies';
export type { GoldenCompany } from './goldenCompanies';

export { runGoldenDiagnostics, formatGoldenSummary } from './runGoldenDiagnostics';
export type { GoldenTestResult, GoldenRunSummary } from './runGoldenDiagnostics';
