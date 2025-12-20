/**
 * Airtable configuration validation
 *
 * Validates required environment variables are set before making Airtable calls.
 * Throws descriptive errors listing missing variables.
 */

export interface AirtableTableConfig {
  baseId: string;
  apiKey: string;
  opportunitiesTable: string;
  activitiesTable: string;
}

let _validated = false;
let _config: AirtableTableConfig | null = null;

/**
 * Required environment variables for Airtable operations
 */
const REQUIRED_VARS = {
  AIRTABLE_BASE_ID: 'Base ID for Airtable workspace',
  AIRTABLE_API_KEY: 'API key or personal access token',
} as const;

/**
 * Table-specific environment variables with defaults
 */
const TABLE_VARS = {
  AIRTABLE_OPPORTUNITIES_TABLE: { default: 'Opportunities', description: 'Opportunities/pipeline table' },
  AIRTABLE_ACTIVITIES_TABLE: { default: 'Activities', description: 'Activities/timeline table' },
} as const;

/**
 * Validate Airtable configuration on first call.
 * Throws an error listing all missing required variables.
 */
export function validateAirtableConfig(): AirtableTableConfig {
  if (_validated && _config) {
    return _config;
  }

  const missing: string[] = [];

  // Check required vars
  for (const [varName, description] of Object.entries(REQUIRED_VARS)) {
    if (!process.env[varName]) {
      missing.push(`  - ${varName}: ${description}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[Airtable] Missing required environment variables:\n${missing.join('\n')}\n\n` +
      `Please check your .env.local file.`
    );
  }

  // Build config with table names (use defaults if not set)
  _config = {
    baseId: process.env.AIRTABLE_BASE_ID!,
    apiKey: process.env.AIRTABLE_API_KEY!,
    opportunitiesTable: process.env.AIRTABLE_OPPORTUNITIES_TABLE || TABLE_VARS.AIRTABLE_OPPORTUNITIES_TABLE.default,
    activitiesTable: process.env.AIRTABLE_ACTIVITIES_TABLE || TABLE_VARS.AIRTABLE_ACTIVITIES_TABLE.default,
  };

  _validated = true;

  // Log table names on first validation (helps debug routing issues)
  console.log(`[Airtable] Config validated. Tables: opportunities="${_config.opportunitiesTable}", activities="${_config.activitiesTable}"`);

  return _config;
}

/**
 * Get the configured Opportunities table name.
 * Validates config on first call.
 */
export function getOpportunitiesTableName(): string {
  return validateAirtableConfig().opportunitiesTable;
}

/**
 * Get the configured Activities table name.
 * Validates config on first call.
 */
export function getActivitiesTableName(): string {
  return validateAirtableConfig().activitiesTable;
}

/**
 * Check if an Airtable error is an authorization error (401/403).
 * Used to surface clear error messages to UI.
 */
export function isAirtableAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('not authorized');
  }
  return false;
}

/**
 * Format an Airtable error for display to users.
 */
export function formatAirtableError(error: unknown, tableName: string): string {
  if (isAirtableAuthError(error)) {
    return `Airtable unauthorized: check token permissions and access to "${tableName}" table`;
  }
  if (error instanceof Error) {
    return `Airtable error (${tableName}): ${error.message}`;
  }
  return `Airtable error (${tableName}): Unknown error`;
}
