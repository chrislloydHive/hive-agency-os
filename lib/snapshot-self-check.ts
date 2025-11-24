/**
 * Self-check utility for Snapshot feature
 * Logs environment variable status and warnings on server start
 */

/**
 * Check and log environment variable status for Snapshot feature
 * Should be called on server startup
 */
export function checkSnapshotEnv(): void {
  const checks: Array<{ name: string; present: boolean; required: boolean }> = [
    {
      name: 'AIRTABLE_API_KEY',
      present: !!process.env.AIRTABLE_API_KEY,
      required: true,
    },
    {
      name: 'AIRTABLE_BASE_ID',
      present: !!process.env.AIRTABLE_BASE_ID,
      required: true,
    },
    {
      name: 'AIRTABLE_TABLE_NAME',
      present: !!process.env.AIRTABLE_TABLE_NAME,
      required: true,
    },
    {
      name: 'OPENAI_API_KEY',
      present: !!process.env.OPENAI_API_KEY,
      required: true,
    },
    {
      name: 'PAGESPEED_API_KEY',
      present: !!process.env.PAGESPEED_API_KEY,
      required: false,
    },
    {
      name: 'RESEND_API_KEY',
      present: !!process.env.RESEND_API_KEY,
      required: false,
    },
    {
      name: 'SITE_URL',
      present: !!process.env.SITE_URL,
      required: false,
    },
  ];

  console.log('\n📸 Hive Snapshot Self-Check');
  console.log('────────────────────────────');

  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  checks.forEach((check) => {
    const status = check.present ? '✅' : check.required ? '❌' : '⚠️ ';
    console.log(`${status} ${check.name}: ${check.present ? 'SET' : 'MISSING'}`);

    if (!check.present) {
      if (check.required) {
        missingRequired.push(check.name);
      } else {
        missingOptional.push(check.name);
      }
    }
  });

  if (missingRequired.length > 0) {
    console.error(
      `\n❌ Missing required environment variables: ${missingRequired.join(', ')}`
    );
    console.error('   Snapshot feature will not work without these.');
  }

  if (missingOptional.length > 0) {
    console.warn(
      `\n⚠️  Missing optional environment variables: ${missingOptional.join(', ')}`
    );
    if (missingOptional.includes('RESEND_API_KEY')) {
      console.warn('   Email sending will be disabled (requests will still succeed).');
    }
    if (missingOptional.includes('PAGESPEED_API_KEY')) {
      console.warn('   PageSpeed analysis will use default score of 75.');
    }
  }

  if (missingRequired.length === 0 && missingOptional.length === 0) {
    console.log('\n✅ All environment variables configured correctly!');
  }

  console.log('────────────────────────────\n');
}






