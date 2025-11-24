import { z } from 'zod';

const envSchema = z.object({
  // Airtable Configuration (supports both AIRTABLE_API_KEY and AIRTABLE_ACCESS_TOKEN)
  AIRTABLE_API_KEY: z.string().optional(),
  AIRTABLE_ACCESS_TOKEN: z.string().optional(),
  AIRTABLE_BASE_ID: z.string().min(1, 'AIRTABLE_BASE_ID is required'),
  AIRTABLE_TABLE_NAME: z.string().min(1, 'AIRTABLE_TABLE_NAME is required'),
  AIRTABLE_LEADS_TABLE: z.string().optional().default('Leads'),
  AIRTABLE_SNAPSHOTS_TABLE: z.string().optional().default('Snapshots'),
  AIRTABLE_FULL_REPORTS_TABLE: z.string().optional().default('Full Reports'),

  // Email Service (optional for local development)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  FROM_EMAIL: z.string().email('FROM_EMAIL must be a valid email').optional(),

  // AI Services (optional for local development)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  PAGESPEED_API_KEY: z.string().optional(),

  // GA4 Analytics (optional)
  GA4_SERVICE_ACCOUNT_KEY: z.string().optional(), // JSON string of service account credentials

  // Security (optional for local development)
  WEBHOOK_SECRET: z.string().optional(),

  // Deployment
  NEXT_PUBLIC_BASE_URL: z.string().url('NEXT_PUBLIC_BASE_URL must be a valid URL').optional(),
  SITE_URL: z.string().url('SITE_URL must be a valid URL').optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).refine(
  (data) => data.AIRTABLE_API_KEY || data.AIRTABLE_ACCESS_TOKEN,
  { message: 'Either AIRTABLE_API_KEY or AIRTABLE_ACCESS_TOKEN is required', path: ['AIRTABLE_API_KEY'] }
);

/**
 * Validates environment variables and returns a safe config object
 * Throws an error if required environment variables are missing or invalid
 */
export function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map(err => err.path.join('.'));
      throw new Error(
        `Missing or invalid environment variables: ${missingVars.join(', ')}\n` +
        'Please check your .env.local file and ensure all required variables are set.'
      );
    }
    throw error;
  }
}

/**
 * Get environment variables with validation
 * Use this in your application code
 * Lazy validation - only validates when accessed, not at module load time
 */
let _env: z.infer<typeof envSchema> | null = null;

// Check if we're in a build context (Next.js build process)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' ||
                    process.env.NEXT_PHASE === 'phase-development-build' ||
                    (typeof process.env.NODE_ENV !== 'undefined' && !process.env.AIRTABLE_API_KEY && !process.env.AIRTABLE_ACCESS_TOKEN);

export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(target, prop: string) {
    if (!_env) {
      // Skip validation during build time
      if (isBuildTime) {
        // Return a mock object with empty strings during build
        _env = {
          AIRTABLE_API_KEY: '',
          AIRTABLE_ACCESS_TOKEN: '',
          AIRTABLE_BASE_ID: '',
          AIRTABLE_TABLE_NAME: '',
          AIRTABLE_LEADS_TABLE: 'Leads',
          AIRTABLE_SNAPSHOTS_TABLE: 'Snapshots',
          AIRTABLE_FULL_REPORTS_TABLE: 'Full Reports',
          NODE_ENV: 'development',
        } as z.infer<typeof envSchema>;
      } else {
        _env = validateEnv();
      }
    }
    return _env[prop as keyof typeof _env];
  }
});

/**
 * Get a specific environment variable safely
 * Returns undefined if the variable is not set
 */
export function getEnvVar(key: keyof z.infer<typeof envSchema>): string | undefined {
  return process.env[key];
}

/**
 * Check if we're in development mode
 */
export const isDev = process.env.NODE_ENV === 'development';

/**
 * Check if we're in production mode
 */
export const isProd = process.env.NODE_ENV === 'production';
