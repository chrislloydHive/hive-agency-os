declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Airtable Configuration
      AIRTABLE_API_KEY: string;
      AIRTABLE_BASE_ID: string;
      AIRTABLE_TABLE_NAME: string;
      
      // Email Service
      RESEND_API_KEY: string;
      FROM_EMAIL: string;
      
      // AI Services
      OPENAI_API_KEY: string;
      ANTHROPIC_API_KEY: string;
      
      // Security
      WEBHOOK_SECRET: string;
      
      // Deployment
      NEXT_PUBLIC_BASE_URL: string;
      
      // Node environment
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

export {};
