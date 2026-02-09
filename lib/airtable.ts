import Airtable from 'airtable';
import { env } from './env';

// Lazy initialization to avoid build-time errors
let _base: Airtable.Base | null = null;
let _baseId: string | null = null;
let _startupLogged = false;

// Track which (baseId, table) combinations have already logged 403 errors
// to prevent log spam - only log once per combination per process
const _logged403Errors = new Set<string>();

export function getBase(): Airtable.Base {
  if (!_base) {
    const apiKey = env.AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
    // Check AIRTABLE_OS_BASE_ID first (for Hive OS routes), then fall back to AIRTABLE_BASE_ID
    const baseId = process.env.AIRTABLE_OS_BASE_ID || env.AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID || '';
    if (!apiKey || !baseId) {
      throw new Error('Airtable credentials not configured. Please set AIRTABLE_API_KEY (or AIRTABLE_ACCESS_TOKEN) and AIRTABLE_BASE_ID (or AIRTABLE_OS_BASE_ID) environment variables.');
    }
    
    // Startup logging (once per process)
    if (!_startupLogged) {
      const baseIdPrefix = baseId.substring(0, 20);
      console.log('[Airtable] Initializing base:', {
        baseId: `${baseIdPrefix}...`,
        baseIdFull: baseId, // Log full ID for verification
        hasApiKey: !!apiKey,
        hasToken: !!apiKey, // Alias for clarity
        usingOsBaseId: !!process.env.AIRTABLE_OS_BASE_ID,
        usingBaseId: !!process.env.AIRTABLE_BASE_ID && !process.env.AIRTABLE_OS_BASE_ID,
        envVars: {
          AIRTABLE_OS_BASE_ID: process.env.AIRTABLE_OS_BASE_ID ? `${process.env.AIRTABLE_OS_BASE_ID.substring(0, 20)}...` : 'not set',
          AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID ? `${process.env.AIRTABLE_BASE_ID.substring(0, 20)}...` : 'not set',
        },
      });
      _startupLogged = true;
    }
    
    _baseId = baseId;
    const rawBase = new Airtable({ apiKey }).base(baseId);
    
    // Wrap base to intercept .update() calls for instrumentation
    _base = new Proxy(rawBase, {
      get(target, prop) {
        const value = (target as any)[prop];
        if (typeof value === 'function') {
          // If accessing a table (e.g., base('Table Name')), wrap it to intercept .update()
          return function(...args: any[]) {
            const table = value.apply(target, args);
            // Wrap the table's .update() method
            return new Proxy(table, {
              get(tableTarget, tableProp) {
                const tableValue = (tableTarget as any)[tableProp];
                if (tableProp === 'update' && typeof tableValue === 'function') {
                  return function(recordIdOrArray: string | Array<{ id: string; fields: Record<string, unknown> }>, fieldsOrUndefined?: Record<string, unknown>) {
                    // Temporary instrumentation: detect "Delivered At" field
                    let hasDeliveredAt = false;
                    let fieldKeys: string[] = [];
                    let tableName = '';
                    
                    if (typeof recordIdOrArray === 'string' && fieldsOrUndefined) {
                      // Single record update: base('Table').update(recordId, fields)
                      hasDeliveredAt = Object.prototype.hasOwnProperty.call(fieldsOrUndefined, 'Delivered At');
                      fieldKeys = Object.keys(fieldsOrUndefined);
                      tableName = args[0] || 'unknown';
                    } else if (Array.isArray(recordIdOrArray)) {
                      // Batch update: base('Table').update([{ id, fields }, ...])
                      for (const item of recordIdOrArray) {
                        if (item.fields && Object.prototype.hasOwnProperty.call(item.fields, 'Delivered At')) {
                          hasDeliveredAt = true;
                          fieldKeys = Object.keys(item.fields);
                          break;
                        }
                      }
                      tableName = args[0] || 'unknown';
                    }
                    
                    if (hasDeliveredAt) {
                      console.log('[Airtable] SDK .update() instrumentation:', {
                        baseId: baseId ? `${baseId.substring(0, 20)}...` : 'unknown',
                        tableName,
                        recordId: typeof recordIdOrArray === 'string' ? recordIdOrArray : 'batch',
                        fieldKeys,
                        hasDeliveredAt: true,
                      });
                    }
                    
                    // Call the original update method
                    return tableValue.apply(tableTarget, arguments);
                  };
                }
                return tableValue;
              },
            });
          };
        }
        return value;
      },
    }) as Airtable.Base;
  }
  return _base;
}

/**
 * Get the current base ID being used (for logging/debugging)
 */
export function getBaseId(): string | null {
  return _baseId;
}

/**
 * Check if an error is a 403 NOT_AUTHORIZED from Airtable
 */
export function isAirtableAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as any;
  return (
    err?.error === 'NOT_AUTHORIZED' ||
    err?.statusCode === 403 ||
    (typeof err?.message === 'string' && err.message.includes('NOT_AUTHORIZED'))
  );
}

/**
 * Extract Airtable error details for logging
 */
export function getAirtableErrorDetails(error: unknown): {
  statusCode?: number;
  errorCode?: string;
  message?: string;
} {
  if (!error || typeof error !== 'object') {
    return {};
  }
  const err = error as any;
  return {
    statusCode: err?.statusCode,
    errorCode: err?.error,
    message: err?.message,
  };
}

/**
 * Log a 403 NOT_AUTHORIZED error once per (baseId, table) combination
 * Returns true if this is the first time logging this combination, false if already logged
 */
export function logAirtable403Error(baseId: string, tableName: string, details: { statusCode?: number; errorCode?: string }): boolean {
  const key = `${baseId}:${tableName}`;
  if (_logged403Errors.has(key)) {
    // Already logged this combination - don't spam
    return false;
  }
  
  // Mark as logged and log the error
  _logged403Errors.add(key);
  const baseIdPrefix = baseId.length > 20 ? baseId.substring(0, 20) + '...' : baseId;
  console.error(`[Airtable] NOT_AUTHORIZED: base=${baseIdPrefix} table="${tableName}" status=${details.statusCode || 403} error=${details.errorCode || 'NOT_AUTHORIZED'}`);
  return true;
}

let _projectsBase: Airtable.Base | null = null;
/**
 * Base to use for the Projects table (review portal token lookup).
 * When AIRTABLE_PROJECTS_BASE_ID is set, Projects are read from that base; otherwise uses getBase().
 * Use this when your Projects table with "Client Review Portal Token" lives in a different base than the OS base.
 */
export function getProjectsBase(): Airtable.Base {
  if (!_projectsBase) {
    const apiKey = env.AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
    const projectsBaseId =
      process.env.AIRTABLE_PROJECTS_BASE_ID || process.env.REVIEW_PROJECTS_BASE_ID || '';
    const baseId = projectsBaseId.trim()
      ? projectsBaseId
      : process.env.AIRTABLE_OS_BASE_ID || env.AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID || '';
    if (!apiKey || !baseId) {
      throw new Error('Airtable credentials not configured.');
    }
    _projectsBase = new Airtable({ apiKey }).base(baseId);
  }
  return _projectsBase;
}

let _commentsBase: Airtable.Base | null = null;
/**
 * Base to use for the Comments table.
 * When AIRTABLE_COMMENTS_BASE_ID is set, Comments are read from that base; otherwise uses default base appQLwoVH8JyGSTIo.
 * Use this when your Comments table lives in a different base than the OS base.
 */
export function getCommentsBase(): Airtable.Base {
  if (!_commentsBase) {
    const apiKey = env.AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
    const commentsBaseId = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
    if (!apiKey || !commentsBaseId) {
      throw new Error('Airtable credentials not configured.');
    }
    _commentsBase = new Airtable({ apiKey }).base(commentsBaseId);
  }
  return _commentsBase;
}

// Export a function that returns the base, or use a getter pattern
// For compatibility, we'll create a proxy that forwards all calls
const base = new Proxy(function() {} as any, {
  get(target, prop: string | symbol) {
    const baseInstance = getBase();
    const value = (baseInstance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(baseInstance);
    }
    return value;
  },
  apply(target, thisArg, argumentsList) {
    // Handle direct function calls like base('Table Name')
    const baseInstance = getBase();
    return (baseInstance as any)(...argumentsList);
  }
}) as Airtable.Base;

// Export for scripts and direct usage
export const airtableBase = base;

export const TABLES = {
  INITIAL_LEADS: 'Initial Leads',
  get MAIN_LEADS() {
    return env.AIRTABLE_TABLE_NAME || process.env.AIRTABLE_TABLE_NAME || 'Leads';
  }
} as const;

export const LEAD_STATUS = {
  NEW: 'New Lead',
  ASSESSMENT_SENT: 'Assessment Sent', 
  ASSESSMENT_COMPLETED: 'Assessment Completed',
  ANALYSIS_IN_PROGRESS: 'Analysis In Progress',
  ANALYSIS_COMPLETED: 'Analysis Completed',
  REPORT_GENERATED: 'Report Generated'
} as const;

export interface AssessmentData {
  id?: string;
  name: string;
  email: string;
  companyName: string;
  websiteUrl: string;
  phone?: string;
  industry: string;
  yearsInBusiness: string;
  annualRevenue?: string;
  numberOfEmployees: string;
  monthlyMarketingBudget: string;
  currentMarketingActivities: string[] | string;
  biggestMarketingChallenge: string;
  currentMarketingPerformance: string;
  primaryMarketingGoal: string;
  implementationTimeline: string;
  decisionTimeline: string;
  urgencyLevel: string;
  decisionMaker: string;
  budgetAlignment: string;
  marketingSuccessDescription?: string;
  assessmentFocus?: string;
  howTheyFoundUs?: string;
  preferredAssessmentFormat: string;
  preferredContactMethod: string;
  dateSubmitted?: string;
}

export interface LeadRecord {
  id: string;
  fields: Record<string, any>;
}

// Type for Airtable records
export type AirtableRecord = {
  id: string;
  fields: Record<string, any>;
};

// Map form values to Airtable field values
function mapFormValueToAirtable(fieldName: string, value: string): string {
  const mappings: Record<string, Record<string, string>> = {
    'Industry': {
      'technology-software': 'Technology & Software',
      'healthcare-medical': 'Healthcare & Medical',
      'ecommerce-retail': 'E-commerce & Retail',
      'real-estate': 'Real Estate',
      'financial-services': 'Financial Services',
      'manufacturing': 'Manufacturing',
      'home-services': 'Home Services',
      'fitness-wellness': 'Fitness & Wellness',
      'food-beverage': 'Food & Beverage',
      'education-training': 'Education & Training',
      'legal-services': 'Legal Services',
      'marketing-advertising': 'Marketing & Advertising',
      'construction': 'Construction',
      'automotive': 'Automotive',
      'beauty-personal-care': 'Beauty & Personal Care',
      'non-profit': 'Non-Profit',
      'consulting': 'Consulting',
      'other': 'Other'
    },
    'Years In Business': {
      'less-than-1-year': 'Less than 1 year',
      '1-2-years': '1-2 years',
      '3-5-years': '3-5 years',
      '6-10-years': '6-10 years',
      'more-than-10-years': 'More than 10 years'
    },
    'Number of Employees': {
      'just-me-solopreneur': 'Just me (solopreneur)',
      '2-5-employees': '2-5 employees',
      '6-15-employees': '6-15 employees',
      '16-50-employees': '16-50 employees',
      '50-plus-employees': '50+ employees'
    },
    'Annual Revenue': {
      'under-100000': 'Under $100,000',
      '100000-500000': '$100,000 - $500,000',
      '500000-1000000': '$500,000 - $1,000,000',
      '1000000-5000000': '$1,000,000 - $5,000,000',
      'over-5000000': 'Over $5,000,000',
      'prefer-not-to-say': 'Prefer not to say'
    },
    'Current Marketing Activities': {
      'basic-website': 'Basic website',
      'search-engine-optimization-seo': 'Search Engine Optimization (SEO)',
      'google-facebook-ads': 'Google/Facebook Ads',
      'social-media-marketing': 'Social media marketing',
      'email-marketing': 'Email marketing',
      'content-marketing-blogging': 'Content marketing/blogging',
      'networking-referrals-only': 'Networking/referrals only',
      'traditional-advertising-print-radio-etc': 'Traditional advertising (print, radio, etc.)',
      'none-of-the-above': 'None of the above'
    },
    'Monthly Marketing Budget': {
      'under-1000-month': 'Under $1,000/month',
      '1000-3000-month-typical-for-businesses-your-size': '$1,000 - $3,000/month (typical for businesses your size)',
      '3000-7000-month': '$3,000 - $7,000/month',
      '7000-15000-month': '$7,000 - $15,000/month',
      '15000-plus-month': '$15,000+/month',
      'we-dont-have-a-set-budget-yet-help-us-determine-this': 'We don\'t have a set budget yet (help us determine this)'
    },
    'Current Marketing Performance': {
      'excellent-were-seeing-great-results': 'Excellent - we\'re seeing great results',
      'good-decent-results-but-room-for-improvement': 'Good - decent results but room for improvement',
      'fair-some-results-but-inconsistent': 'Fair - some results but inconsistent',
      'poor-not-seeing-the-results-we-need': 'Poor - not seeing the results we need',
      'terrible-marketing-isnt-working-at-all': 'Terrible - marketing isn\'t working at all'
    },
    'Biggest Marketing Challenge': {
      'not-generating-enough-qualified-leads': 'Not generating enough qualified leads',
      'poor-website-performance-low-conversions': 'Poor website performance/low conversions',
      'inconsistent-or-unclear-brand-identity': 'Inconsistent or unclear brand identity',
      'low-visibility-in-search-results-hard-to-find-online': 'Low visibility in search results (hard to find online)',
      'marketing-efforts-dont-produce-measurable-roi': 'Marketing efforts don\'t produce measurable ROI',
      'dont-know-which-marketing-activities-actually-work': 'Don\'t know which marketing activities actually work',
      'competing-with-larger-companies-with-bigger-budgets': 'Competing with larger companies with bigger budgets',
      'limited-marketing-knowledge-expertise': 'Limited marketing knowledge/expertise',
      'inconsistent-marketing-efforts-stop-and-start': 'Inconsistent marketing efforts (stop and start)',
      'too-busy-to-focus-on-marketing-consistently': 'Too busy to focus on marketing consistently'
    },
    'Primary Marketing Goal': {
      'increase-qualified-leads-by-50-plus': 'Increase qualified leads by 50%+',
      'improve-website-conversion-rates': 'Improve website conversion rates',
      'build-stronger-brand-recognition': 'Build stronger brand recognition',
      'reduce-customer-acquisition-costs': 'Reduce customer acquisition costs',
      'establish-thought-leadership-in-our-industry': 'Establish thought leadership in our industry',
      'compete-more-effectively-with-larger-competitors': 'Compete more effectively with larger competitors',
      'create-a-systematic-predictable-marketing-process': 'Create a systematic predictable marketing process',
      'generate-more-referrals-and-word-of-mouth': 'Generate more referrals and word-of-mouth',
      'improve-our-online-reputation-and-reviews': 'Improve our online reputation and reviews'
    },
    'Implementation Timeline': {
      'immediately-ready-to-start-now': 'Immediately (ready to start now)',
      'within-the-next-30-days': 'Within the next 30 days',
      'within-the-next-90-days': 'Within the next 90 days',
      'within-6-months': 'Within 6 months',
      'just-researching-options-for-now': 'Just researching options for now'
    },
    'Decision Timeline': {
      '1-3-months': '1-3 months',
      '3-6-months': '3-6 months',
      '6-12-months': '6-12 months',
      'more-than-12-months': 'More than 12 months',
      'not-sure-yet': 'Not sure yet'
    },
    'Urgency Level': {
      '1-2-not-urgent-just-researching': '1-2 (Not urgent, just researching)',
      '3-4-somewhat-important-would-like-to-improve': '3-4 (Somewhat important, would like to improve)',
      '5-6-moderately-important-actively-looking-to-improve': '5-6 (Moderately important, actively looking to improve)',
      '7-8-very-important-need-to-improve-soon': '7-8 (Very important, need to improve soon)',
      '9-10-critical-urgent-need-immediate-improvement': '9-10 (Critical/urgent, need immediate improvement)'
    },
    'Decision Maker': {
      'just-researching-options-for-now': 'Just researching options for now',
      'i-make-decisions-with-input-from-my-team': 'I make decisions with input from my team',
      'i-need-approval-from-business-partners': 'I need approval from business partners',
      'someone-else-makes-these-decisions': 'Someone else makes these decisions',
      'we-make-decisions-as-a-team-committee': 'We make decisions as a team/committee'
    },
    'Budget Alignment': {
      'yes-this-aligns-with-our-growth-budget': 'Yes, this aligns with our growth budget',
      'we-need-to-justify-the-investment': 'We need to justify the investment',
      'we-may-need-to-adjust-our-budget': 'We may need to adjust our budget',
      'not-sure-yet': 'Not sure yet'
    },
    'Preferred Assessment Format': {
      'live-video-call-30-45-minutes-most-comprehensive': 'Live video call (30-45 minutes, most comprehensive)',
      'phone-call-20-30-minutes': 'Phone call (20-30 minutes)',
      'email-assessment-detailed-written-analysis': 'Email assessment (detailed written analysis)',
      'self-assessment-form-with-feedback': 'Self-assessment form with feedback'
    },
    'Preferred Contact Method': {
      'email-best-for-detailed-information': 'Email (best for detailed information)',
      'phone-call-quicker-conversation': 'Phone call (quicker conversation)',
      'text-message-quick-updates': 'Text message (quick updates)',
      'video-call-most-personal': 'Video call (most personal)'
    }
  };

  return mappings[fieldName]?.[value] || value;
}

// Create comprehensive assessment record
export async function createAssessmentLead(assessmentData: AssessmentData): Promise<LeadRecord> {
  try {
    const fields = {
      'Your Name': assessmentData.name,
      'Email': assessmentData.email,
      'Company Name': assessmentData.companyName,
      'Website URL': assessmentData.websiteUrl,
      'Phone': assessmentData.phone || '',
      'Industry': mapFormValueToAirtable('Industry', assessmentData.industry),
      'Years In Business': mapFormValueToAirtable('Years In Business', assessmentData.yearsInBusiness),
      'Annual Revenue': assessmentData.annualRevenue ? mapFormValueToAirtable('Annual Revenue', assessmentData.annualRevenue) : '',
      'Number of Employees': mapFormValueToAirtable('Number of Employees', assessmentData.numberOfEmployees),
      'Monthly Marketing Budget': mapFormValueToAirtable('Monthly Marketing Budget', assessmentData.monthlyMarketingBudget),
      'Current Marketing Activities': Array.isArray(assessmentData.currentMarketingActivities) 
        ? assessmentData.currentMarketingActivities.map(activity => mapFormValueToAirtable('Current Marketing Activities', activity))
        : (assessmentData.currentMarketingActivities ? [mapFormValueToAirtable('Current Marketing Activities', assessmentData.currentMarketingActivities)] : []),
      'Biggest Marketing Challenge': mapFormValueToAirtable('Biggest Marketing Challenge', assessmentData.biggestMarketingChallenge),
      'Current Marketing Performance': mapFormValueToAirtable('Current Marketing Performance', assessmentData.currentMarketingPerformance),
      'Primary Marketing Goal': mapFormValueToAirtable('Primary Marketing Goal', assessmentData.primaryMarketingGoal),
      'Implementation Timeline': mapFormValueToAirtable('Implementation Timeline', assessmentData.implementationTimeline),
      'Decision Timeline': mapFormValueToAirtable('Decision Timeline', assessmentData.decisionTimeline),
      'Urgency Level': mapFormValueToAirtable('Urgency Level', assessmentData.urgencyLevel),
      'Decision Maker': mapFormValueToAirtable('Decision Maker', assessmentData.decisionMaker),
      'Budget Alignment': mapFormValueToAirtable('Budget Alignment', assessmentData.budgetAlignment),
      'Marketing Success Description': assessmentData.marketingSuccessDescription || '',
      'Assessment Focus': assessmentData.assessmentFocus || '',
      'How You Found Us': assessmentData.howTheyFoundUs || '',
      'Preferred Assessment Format': mapFormValueToAirtable('Preferred Assessment Format', assessmentData.preferredAssessmentFormat),
      'Preferred Contact Method': mapFormValueToAirtable('Preferred Contact Method', assessmentData.preferredContactMethod),
      'Date Submitted': (assessmentData.dateSubmitted || new Date().toISOString()).split('T')[0], // Just the date part YYYY-MM-DD
      'Status': LEAD_STATUS.ASSESSMENT_COMPLETED,
      'Lead Priority': 'Medium Priority'
    };

    console.log('📝 Sending fields to Airtable:', fields);

     
    const record = await base(TABLES.MAIN_LEADS).create([
      { fields: fields as any }
    ]);
    
    console.log('Assessment record created:', record[0].id);
    return record[0];
  } catch (error) {
    console.error('❌ Error creating assessment lead:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name
    });
    
    // If it's an Airtable error, log more details
    if (error && typeof error === 'object' && 'error' in error) {
      console.error('❌ Airtable error details:', error);
    }
    
    throw new Error(`Failed to create assessment record: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Update lead record
export async function updateLead(
  recordId: string, 
  updates: Record<string, any>, 
  tableName: string = TABLES.MAIN_LEADS
): Promise<LeadRecord> {
  try {
     
    const record = await base(tableName).update([
      {
        id: recordId,
        fields: updates as any
      }
    ]);
    return record[0];
  } catch (error) {
    console.error('Error updating lead:', error);
    throw new Error(`Failed to update lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get lead by email
export async function getLeadByEmail(email: string): Promise<LeadRecord | null> {
  try {
    const records = await base(TABLES.MAIN_LEADS)
      .select({
        filterByFormula: `{Email} = "${email}"`
      })
      .firstPage();
    
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('Error finding lead:', error);
    throw new Error(`Failed to find lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get lead by ID
export async function getLeadById(
  recordId: string, 
  tableName: string = TABLES.MAIN_LEADS
): Promise<LeadRecord> {
  try {
    const record = await base(tableName).find(recordId);
    return record;
  } catch (error) {
    console.error('Error getting lead:', error);
    throw new Error(`Failed to get lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get all leads with pagination
export async function getAllLeads(
  tableName: string = TABLES.MAIN_LEADS,
  pageSize: number = 100
): Promise<LeadRecord[]> {
  try {
    const records = await base(tableName)
      .select({
        pageSize,
        sort: [{ field: 'Date Submitted', direction: 'desc' }]
      })
      .firstPage();
    
    return Array.from(records).map(record => ({
      id: record.id,
      fields: record.fields
    })) as LeadRecord[];
  } catch (error) {
    console.error('Error getting leads:', error);
    throw new Error(`Failed to get leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get all assessments for admin dashboard
export async function getAllAssessments(): Promise<AssessmentData[]> {
  try {
    const records = await getAllLeads();
    
    return records.map(record => ({
      id: record.id,
      name: record.fields['Your Name'] || '',
      email: record.fields['Email'] || '',
      companyName: record.fields['Company Name'] || '',
      websiteUrl: record.fields['Website URL'] || '',
      phone: record.fields['Phone'] || '',
      industry: record.fields['Industry'] || '',
      yearsInBusiness: record.fields['Years In Business'] || '',
      annualRevenue: record.fields['Annual Revenue'] || '',
      numberOfEmployees: record.fields['Number of Employees'] || '',
      monthlyMarketingBudget: record.fields['Monthly Marketing Budget'] || '',
      currentMarketingActivities: record.fields['Current Marketing Activities'] || '',
      biggestMarketingChallenge: record.fields['Biggest Marketing Challenge'] || '',
      currentMarketingPerformance: record.fields['Current Marketing Performance'] || '',
      primaryMarketingGoal: record.fields['Primary Marketing Goal'] || '',
      implementationTimeline: record.fields['Implementation Timeline'] || '',
      decisionTimeline: record.fields['Decision Timeline'] || '',
      urgencyLevel: record.fields['Urgency Level'] || '',
      decisionMaker: record.fields['Decision Maker'] || '',
      budgetAlignment: record.fields['Budget Alignment'] || '',
      marketingSuccessDescription: record.fields['Marketing Success Description'] || '',
      assessmentFocus: record.fields['Assessment Focus'] || '',
      howTheyFoundUs: record.fields['How You Found Us'] || '',
      preferredAssessmentFormat: record.fields['Preferred Assessment Format'] || '',
      preferredContactMethod: record.fields['Preferred Contact Method'] || '',
      dateSubmitted: record.fields['Date Submitted'] || ''
    }));
  } catch (error) {
    console.error('Error getting all assessments:', error);
    throw new Error(`Failed to get assessments: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Create analysis record in Airtable
export async function createAnalysisRecord(analysis: {
  assessmentId: string;
  marketingScore: number;
  priorityAreas: string[];
  recommendations: string[];
  estimatedROI: string;
  timeline: string;
  nextSteps: string[];
}): Promise<LeadRecord> {
  try {
    // First, update the original assessment record with the analysis results
    const updates = {
      'Marketing Score': analysis.marketingScore.toString(),
      'Priority Areas': analysis.priorityAreas.join(', '),
      'Recommendations': analysis.recommendations.join('; '),
      'Estimated ROI': analysis.estimatedROI,
      'Implementation Timeline': analysis.timeline,
      'Next Steps': analysis.nextSteps.join('; '),
      'Status': LEAD_STATUS.ANALYSIS_COMPLETED,
      'Analysis Date': new Date().toISOString()
    };

    const updatedRecord = await updateLead(analysis.assessmentId, updates);
    
    console.log('Analysis record created for assessment:', analysis.assessmentId);
    return updatedRecord;
  } catch (error) {
    console.error('Error creating analysis record:', error);
    throw new Error(`Failed to create analysis record: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get analysis by assessment ID
export async function getAnalysisByAssessmentId(assessmentId: string): Promise<{
  id: string;
  assessmentId: string;
  marketingScore: number;
  priorityAreas: string[];
  recommendations: string[];
  estimatedROI: string;
  timeline: string;
  nextSteps: string[];
  analysisDate: string;
} | null> {
  try {
    const record = await getLeadById(assessmentId);
    
    if (!record.fields['Marketing Score']) {
      return null; // No analysis yet
    }

    return {
      id: record.id,
      assessmentId: record.id,
      marketingScore: parseInt(record.fields['Marketing Score']) || 0,
      priorityAreas: record.fields['Priority Areas'] ? record.fields['Priority Areas'].split(', ') : [],
      recommendations: record.fields['Recommendations'] ? record.fields['Recommendations'].split('; ') : [],
      estimatedROI: record.fields['Estimated ROI'] || '',
      timeline: record.fields['Implementation Timeline'] || '',
      nextSteps: record.fields['Next Steps'] ? record.fields['Next Steps'].split('; ') : [],
      analysisDate: record.fields['Analysis Date'] || ''
    };
  } catch (error) {
    console.error('Error getting analysis:', error);
    return null;
  }
}

// Get all analyses for admin dashboard
export async function getAllAnalyses(): Promise<{
  id: string;
  assessmentId: string;
  marketingScore: number;
  priorityAreas: string[];
  recommendations: string[];
  estimatedROI: string;
  timeline: string;
  nextSteps: string[];
  analysisDate: string;
}[]> {
  try {
    const assessments = await getAllAssessments();
    const analyses = [];

    for (const assessment of assessments) {
      const analysis = await getAnalysisByAssessmentId(assessment.id!);
      if (analysis) {
        analyses.push(analysis);
      }
    }

    return analyses;
  } catch (error) {
    console.error('Error getting all analyses:', error);
    return [];
  }
}

// ============================================================================
// SNAPSHOT FUNCTIONS
// ============================================================================

export interface SnapshotData {
  email?: string; // Optional - can be omitted
  websiteUrl: string;
  overallScore: number;
  seoScore: number;
  contentScore: number;
  conversionScore: number;
  performanceScore: number;
  strengths: string[];
  quickWins: string[];
  contentInsights?: string;
  rawJson: string;
  leadId?: string; // Optional - can be linked later
  companyId?: string; // Canonical company ID (UUID) - stable across all tables
}

/**
 * Upsert lead by email (create or update)
 * Creates new lead if email doesn't exist, otherwise updates existing lead
 * Sets Stage to "Snapshot Sent" and updates Website URL
 * 
 * @param email - Lead email address (used as unique key)
 * @param websiteUrl - Website URL to associate with lead
 * @returns Promise resolving to Airtable record ID
 * @throws Error if Airtable operation fails
 */
export async function upsertLead(
  email: string,
  websiteUrl: string
): Promise<string> {
  try {
    // Try to find existing lead
    const existing = await getLeadByEmail(email);

    if (existing) {
      console.log(`📝 Updating existing lead: ${existing.id}`);
      console.log(`   Current Email: ${existing.fields['Email'] || 'NOT SET'}`);
      console.log(`   Current Website URL: ${existing.fields['Website URL'] || 'NOT SET'}`);
      
      // Update existing lead (only update fields that exist)
      const updateFields: Record<string, unknown> = {
        'Website URL': websiteUrl,
      };
      
      // Also update Email if it's different (shouldn't happen, but just in case)
      if (existing.fields['Email'] !== email) {
        console.warn(`   ⚠️  Email mismatch! Existing: ${existing.fields['Email']}, New: ${email}`);
        updateFields['Email'] = email;
      }
      
      // Only add Stage if field exists (don't use Status - it may have different options)
      if (existing.fields['Stage'] !== undefined) {
        updateFields['Stage'] = 'Snapshot Sent';
      }
      // If Stage doesn't exist, skip it
      
      console.log(`   Updating with fields: ${Object.keys(updateFields).join(', ')}`);
      
      await updateLead(existing.id, updateFields);
      
      // Verify update
      try {
        const updatedRecord = await getLeadById(existing.id);
        console.log(`   ✅ Lead updated`);
        if (updatedRecord.fields['Email']) {
          console.log(`   ✅ Email: ${updatedRecord.fields['Email']}`);
        }
        if (updatedRecord.fields['Website URL']) {
          console.log(`   ✅ Website URL: ${updatedRecord.fields['Website URL']}`);
        }
      } catch (verifyError) {
        console.warn('   Could not verify updated fields');
      }
      
      return existing.id;
    }

    // Create new lead (only include fields that exist)
    const createFields: Record<string, unknown> = {
      Email: email,
      'Website URL': websiteUrl,
    };
    
    console.log(`📝 Creating new lead with Email: ${email}, Website URL: ${websiteUrl}`);
    
    // Add Date Submitted if field exists
    try {
      const sampleRecords = await base(TABLES.MAIN_LEADS).select({ maxRecords: 1 }).firstPage();
      if (sampleRecords.length > 0) {
        const sampleFields = Object.keys(sampleRecords[0].fields);
        console.log(`   Available fields in Leads table: ${sampleFields.join(', ')}`);
        
        // Check if Email and Website URL fields exist
        if (!sampleFields.includes('Email')) {
          console.warn(`   ⚠️  'Email' field not found! Available fields: ${sampleFields.join(', ')}`);
        }
        if (!sampleFields.includes('Website URL')) {
          console.warn(`   ⚠️  'Website URL' field not found! Available fields: ${sampleFields.join(', ')}`);
        }
        
        if (sampleFields.includes('Date Submitted')) {
          createFields['Date Submitted'] = new Date().toISOString().split('T')[0];
        }
        
        // Only add Stage if field exists (don't use Status as fallback - it may have different options)
        if (sampleFields.includes('Stage')) {
          createFields['Stage'] = 'Snapshot Sent';
        }
        // If Stage doesn't exist, skip it (field will be added later)
      } else {
        console.warn('   ⚠️  Leads table is empty - cannot verify field names');
        console.warn('   Attempting to create with Email and Website URL fields');
      }
    } catch (error) {
      console.warn('   ⚠️  Could not check existing fields:', error instanceof Error ? error.message : 'Unknown error');
      console.warn('   Attempting to create with Email and Website URL fields');
    }
    
     
    console.log(`   Creating record with fields: ${Object.keys(createFields).join(', ')}`);
    
    try {
       
      const record = await base(TABLES.MAIN_LEADS).create([
        { fields: createFields as any },
      ]);

      const recordId = record[0].id;
       
      console.log(`   ✅ Lead created: ${recordId}`);
      
      // Verify what was actually saved
      try {
        const savedRecord = await getLeadById(recordId);
        const savedFields = Object.keys(savedRecord.fields);
        console.log(`   Saved fields: ${savedFields.join(', ')}`);
        
        if (savedRecord.fields['Email']) {
          console.log(`   ✅ Email saved: ${savedRecord.fields['Email']}`);
        } else {
          console.warn(`   ❌ Email NOT saved!`);
        }
        
        if (savedRecord.fields['Website URL']) {
          console.log(`   ✅ Website URL saved: ${savedRecord.fields['Website URL']}`);
        } else {
          console.warn(`   ❌ Website URL NOT saved!`);
        }
      } catch (verifyError) {
        console.warn('   Could not verify saved fields:', verifyError instanceof Error ? verifyError.message : 'Unknown error');
      }

      return recordId;
    } catch (createError) {
      console.error('   ❌ Error creating lead:', createError instanceof Error ? createError.message : 'Unknown error');
      if ((createError as { error?: unknown }).error) {
        console.error('   Airtable error details:', JSON.stringify((createError as { error?: unknown }).error, null, 2));
      }
      throw createError;
    }
  } catch (error) {
    console.error('Error upserting lead:', error);
    throw new Error(
      `Failed to upsert lead: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create snapshot record
 * Creates record in Snapshots table with all scores and insights
 * Stores email and website URL directly (no lead linking required initially)
 * 
 * @param snapshotData - Snapshot data including email, website, scores, strengths, quick wins
 * @returns Promise resolving to Airtable snapshot record ID
 * @throws Error if Airtable operation fails
 */
export async function createSnapshot(
  snapshotData: SnapshotData
): Promise<string> {
  try {
    const snapshotsTable =
      process.env.AIRTABLE_SNAPSHOTS_TABLE || 'Snapshots';

    // Validate overall score before saving
    if (typeof snapshotData.overallScore !== 'number' || isNaN(snapshotData.overallScore)) {
      console.error('⚠️  Invalid overall score provided:', snapshotData.overallScore);
      throw new Error(`Invalid overall score: ${snapshotData.overallScore}`);
    }

    // Build fields object with EXACT field names from Airtable table
    // Using the exact names you provided: Overall Score, SEO Score, Content Score, Conversion Score, etc.
    const fieldsToCreate: Record<string, unknown> = {
      'Overall Score': Math.round(snapshotData.overallScore),
      'SEO Score': Math.round(snapshotData.seoScore),
      'Content Score': Math.round(snapshotData.contentScore),
      'Conversion Score': Math.round(snapshotData.conversionScore),
      'PageSpeed Lighthouse Perf': Math.round(snapshotData.performanceScore),
      '3 Strengths': snapshotData.strengths.join('\n'),
      '3 Quick Wins': snapshotData.quickWins.join('\n'),
      'Raw JSON': snapshotData.rawJson,
      'Website URL': snapshotData.websiteUrl,
    };

    // Add email field using exact name from your table
    if (snapshotData.email) {
      fieldsToCreate['Email Address'] = snapshotData.email;
    }

    // Add Content Insights if provided
    if (snapshotData.contentInsights) {
      fieldsToCreate['Content Insights'] = snapshotData.contentInsights;
    }

    // Add Company ID if provided (canonical company identifier)
    if (snapshotData.companyId) {
      fieldsToCreate['Company ID'] = snapshotData.companyId;
    }
    
    // Extract LinkedIn and Google Business URLs from raw JSON (parse once)
    try {
      const parsedJson = JSON.parse(snapshotData.rawJson);
      
      // Add LinkedIn Company Page URL if provided
      if (parsedJson.linkedin_url) {
        fieldsToCreate['LinkedIn Company Page URL'] = parsedJson.linkedin_url;
      }
      
      // Add Google Business Profile URL if provided
      if (parsedJson.google_business_url) {
        fieldsToCreate['Google Business Profile URL'] = parsedJson.google_business_url;
      }
    } catch (e) {
      // Ignore JSON parse errors - URLs are optional
      console.warn('⚠️  Could not parse raw JSON to extract LinkedIn/GBP URLs');
    }
    
    console.log('💾 Attempting to save snapshot with fields:', Object.keys(fieldsToCreate).join(', '));

    // Log what we're saving (first 500 chars of raw JSON for debugging)
    const rawJsonPreview = snapshotData.rawJson.substring(0, 500);
    console.log(`💾 Saving to Airtable - Raw JSON preview: ${rawJsonPreview}...`);
    console.log(`💾 Raw JSON length: ${snapshotData.rawJson.length} characters`);
    
    // Check if scorecard is in the raw JSON
    try {
      const parsed = JSON.parse(snapshotData.rawJson);
      console.log(`💾 Scorecard in raw JSON: ${!!parsed?.rubric?.scorecard}`);
    } catch (e) {
      console.warn(`⚠️  Could not parse raw JSON to check for scorecard: ${e}`);
    }

    console.log('💾 Saving snapshot with Overall Score:', fieldsToCreate['Overall Score']);
    console.log('📝 Fields to save:', Object.keys(fieldsToCreate).join(', '));

    // Add Lead link if provided (optional - can be linked later)
    if (snapshotData.leadId) {
      // Try multiple possible field names for the lead link
      const possibleLeadFields = ['Linked Lead', 'Lead Record', 'Related Lead', 'Lead'];
      
      try {
        const sampleRecords = await base(snapshotsTable).select({ maxRecords: 1 }).firstPage();
        if (sampleRecords.length > 0) {
          const availableFields = Object.keys(sampleRecords[0].fields);
          const foundField = possibleLeadFields.find(field => availableFields.includes(field));
          if (foundField) {
            fieldsToCreate[foundField] = [snapshotData.leadId];
          }
        }
      } catch {
        // If we can't check, try 'Linked Lead' as default
        fieldsToCreate['Linked Lead'] = [snapshotData.leadId];
      }
    }

    // Content Insights is now added above in fieldsToCreate
    // No need for separate checking since we're using exact field names

    let snapshotRecordId: string;
    
    try {
       
      const record = await base(snapshotsTable).create([
        {
          fields: fieldsToCreate as any,
        },
      ]);
      
      snapshotRecordId = record[0].id;
      
      // Log successful creation
      console.log(`✅ Snapshot record created: ${snapshotRecordId}`);
      
      // Update Snapshot URL and Snapshot ID fields after creation
      try {
        const updateFields: Record<string, unknown> = {};
        
        // Set Snapshot URL with shareable URL
        const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://hiveadagency.com';
        updateFields['Snapshot URL'] = `${siteUrl}/snapshot?id=${snapshotRecordId}`;
        
        // Set Snapshot ID (the Airtable record ID)
        updateFields['Snapshot ID'] = snapshotRecordId;
        
        await base(snapshotsTable).update([
          {
            id: snapshotRecordId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fields: updateFields as any,
          },
        ]);
        
        console.log(`✅ Updated Snapshot URL: ${updateFields['Snapshot URL']}`);
        console.log(`✅ Updated Snapshot ID: ${snapshotRecordId}`);
      } catch (updateError) {
        console.warn('⚠️  Could not update Snapshot URL/ID fields:', updateError instanceof Error ? updateError.message : 'Unknown error');
        // Non-critical, continue
      }
      
      // Verify which fields were actually saved (if record exists)
      try {
        const savedRecord = await base(snapshotsTable).find(snapshotRecordId);
        const savedFields = Object.keys(savedRecord.fields);
        const missingFields = Object.keys(fieldsToCreate).filter(
          (field) => !savedFields.includes(field)
        );
        
        if (missingFields.length > 0) {
          console.warn(
            `⚠️  Some fields were not saved (may not exist in Airtable): ${missingFields.join(', ')}`
          );
          console.warn(
            `   Add these fields to your Snapshots table: ${missingFields.join(', ')}`
          );
        } else {
          console.log(`✅ All ${Object.keys(fieldsToCreate).length} fields saved successfully`);
        }
      } catch (verifyError) {
        // Verification failed, but record was created - that's okay
        console.log(`✅ Snapshot record created (could not verify fields)`);
      }
    } catch (error) {
      // More detailed error logging
      if (error instanceof Error) {
        console.error('Error creating snapshot record:', error.message);
        
        // Check if it's a field-related error
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('field') || errorMessage.includes('column') || (error as { statusCode?: number }).statusCode === 422) {
          console.error('⚠️  This looks like a field name/type mismatch error');
          console.error('   Fields we tried to save:', Object.keys(fieldsToCreate).join(', '));
          console.error('   Check that all field names match exactly (case-sensitive)');
          console.error('   Check that field types are correct (Number vs Text, etc.)');
        }
        
        if (error && typeof error === 'object' && 'error' in error) {
          const airtableError = (error as { error: unknown }).error;
          console.error('Airtable error details:', JSON.stringify(airtableError, null, 2));
          
          // Try to extract field name from error
          const errorStr = JSON.stringify(airtableError);
          
          // Handle Website URL field issues - try alternative field names or skip
          if (errorStr.includes('Website URL') && (errorStr.includes('UNKNOWN_FIELD_NAME') || errorStr.includes('Unknown field'))) {
            console.error('\n💡 Website URL field issue detected');
            console.error('   Attempting to fix or skip Website URL field...');
            
            const fieldsFixed = { ...fieldsToCreate };
            
            // Remove Website URL variations
            delete fieldsFixed['Website URL'];
            delete fieldsFixed['Website'];
            delete fieldsFixed['URL'];
            
            console.log('   Retrying without Website URL field...');
            
            try {
               
              const retryRecord = await base(snapshotsTable).create([
                { fields: fieldsFixed as any },
              ]);
              console.log(`✅ Snapshot created successfully without Website URL: ${retryRecord[0].id}`);
              console.warn('⚠️  Website URL was not saved - add "Website URL" field to Snapshots table (or it\'s stored in Raw JSON)');
              return retryRecord[0].id;
            } catch (retryError) {
              console.error('❌ Retry without Website URL also failed:', retryError instanceof Error ? retryError.message : 'Unknown error');
              // Continue to throw original error
            }
          }
          
          // Handle Email field issues - try alternative field names
          if (errorStr.includes('Email') && (errorStr.includes('UNKNOWN_FIELD_NAME') || errorStr.includes('Unknown field'))) {
            console.error('\n💡 Email field issue detected');
            console.error('   Attempting to fix email field name...');
            
            const fieldsFixed = { ...fieldsToCreate };
            
            // Remove both Email and Email Address
            delete fieldsFixed['Email'];
            delete fieldsFixed['Email Address'];
            
            // Try Email Address if we were using Email
            if (fieldsToCreate['Email']) {
              fieldsFixed['Email Address'] = fieldsToCreate['Email'];
              console.log('   Retrying with "Email Address" instead of "Email"...');
            } else if (fieldsToCreate['Email Address']) {
              // Try Email if we were using Email Address
              fieldsFixed['Email'] = fieldsToCreate['Email Address'];
              console.log('   Retrying with "Email" instead of "Email Address"...');
            } else {
              // Just skip email field
              console.log('   Retrying without email field...');
            }
            
            try {
               
              const retryRecord = await base(snapshotsTable).create([
                { fields: fieldsFixed as any },
              ]);
              console.log(`✅ Snapshot created successfully with fixed email field: ${retryRecord[0].id}`);
              return retryRecord[0].id;
            } catch (retryError) {
              // If that fails, try without email entirely
              console.error('❌ Retry with alternative email field failed, trying without email...');
              const fieldsWithoutEmail = { ...fieldsFixed };
              delete fieldsWithoutEmail['Email'];
              delete fieldsWithoutEmail['Email Address'];
              
              try {
                 
                const finalRetryRecord = await base(snapshotsTable).create([
                  { fields: fieldsWithoutEmail as any },
                ]);
                console.log(`✅ Snapshot created successfully without email field: ${finalRetryRecord[0].id}`);
                console.warn('⚠️  Email was not saved - add "Email" or "Email Address" field to Snapshots table');
                return finalRetryRecord[0].id;
              } catch (finalRetryError) {
                console.error('❌ Final retry also failed:', finalRetryError instanceof Error ? finalRetryError.message : 'Unknown error');
                // Continue to throw original error
              }
            }
          }
          
          if (errorStr.includes('Content Insights')) {
            console.error('\n💡 Solution: Remove "Content Insights" from fields or add the field to Airtable');
            console.error('   Option 1: Add "Content Insights" field (Long text) to Snapshots table');
            console.error('   Option 2: The field will be skipped automatically if it doesn\'t exist');
            
            // Remove Content Insights and retry without it
            const fieldsWithoutContent = { ...fieldsToCreate };
            delete fieldsWithoutContent['Content Insights'];
            delete fieldsWithoutContent['Content Analysis'];
            delete fieldsWithoutContent['Content Notes'];
            
            console.log('\n🔄 Retrying without Content Insights field...');
            try {
               
              const retryRecord = await base(snapshotsTable).create([
                { fields: fieldsWithoutContent as any },
              ]);
              console.log(`✅ Snapshot created successfully without Content Insights: ${retryRecord[0].id}`);
              return retryRecord[0].id;
            } catch (retryError) {
              console.error('Retry also failed:', retryError instanceof Error ? retryError.message : 'Unknown error');
              throw error; // Throw original error
            }
          }
        }
      }
      throw error;
    }

    return snapshotRecordId;
  } catch (error) {
    // Enhanced error logging
    console.error('❌ Error in createSnapshot function:', {
      error,
      errorType: typeof error,
      isError: error instanceof Error,
      message: error instanceof Error ? error.message : 'Not an Error instance',
      stack: error instanceof Error ? error.stack : undefined,
      stringified: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    
    // If it's an Airtable error, try to extract more details
    if (error && typeof error === 'object' && 'error' in error) {
      console.error('Airtable error structure:', JSON.stringify((error as { error?: unknown }).error, null, 2));
    }
    
    // Preserve the original error message or create a descriptive one
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : JSON.stringify(error);
    
    const enhancedError = new Error(`Failed to create snapshot: ${errorMessage}`);
    // Attach original error for debugging
    (enhancedError as { originalError?: unknown }).originalError = error;
    throw enhancedError;
  }
}

/**
 * Get snapshot by ID
 * Fetches snapshot record from Airtable and parses the raw JSON
 * 
 * @param snapshotId - Airtable record ID of the snapshot
 * @returns Snapshot data including parsed raw JSON, or null if not found
 */
export async function getSnapshotById(snapshotId: string): Promise<{
  id: string;
  websiteUrl: string;
  overallScore: number;
  brandScore: number;
  contentScore: number;
  websiteScore: number;
  rawJson?: any;
  scorecard?: any;
} | null> {
  try {
    const snapshotsTable = process.env.AIRTABLE_SNAPSHOTS_TABLE || 'Snapshots';
    const record = await base(snapshotsTable).find(snapshotId);
    
    if (!record) {
      return null;
    }

    const fields = record.fields;
    const rawJsonStr = fields['Raw JSON'] as string | undefined;
    let rawJson: any = null;
    
    if (rawJsonStr) {
      try {
        rawJson = JSON.parse(rawJsonStr);
      } catch (e) {
        console.warn('Failed to parse Raw JSON from snapshot:', e);
      }
    }

    // Extract scores from raw JSON or fallback to direct fields
    const scores = rawJson?.scores || {};
    
    // Get scores - prefer raw JSON scores, then direct fields
    const overallScore = scores.overall ?? fields['Overall Score'] ?? 0;
    const brandScore = scores.brand ?? fields['SEO Score'] ?? 0; // Legacy: SEO Score maps to brand
    const contentScore = scores.content ?? fields['Content Score'] ?? 0;
    const websiteScore = scores.website ?? fields['Conversion Score'] ?? 0; // Legacy: Conversion Score maps to website
    
    console.log(`📸 Snapshot data extracted:`, {
      hasRawJson: !!rawJson,
      scoresFromJson: !!scores.overall,
      overallScore,
      brandScore,
      contentScore,
      websiteScore,
      hasScorecard: !!rawJson?.rubric?.scorecard,
    });
    
    return {
      id: snapshotId,
      websiteUrl: (fields['Website URL'] || fields['Website'] || fields['URL'] || rawJson?.website_url) as string,
      overallScore: typeof overallScore === 'number' ? overallScore : parseInt(String(overallScore)) || 0,
      brandScore: typeof brandScore === 'number' ? brandScore : parseInt(String(brandScore)) || 0,
      contentScore: typeof contentScore === 'number' ? contentScore : parseInt(String(contentScore)) || 0,
      websiteScore: typeof websiteScore === 'number' ? websiteScore : parseInt(String(websiteScore)) || 0,
      rawJson,
      scorecard: rawJson?.rubric?.scorecard || null,
    };
  } catch (error) {
    console.error('Error getting snapshot:', error);
    return null;
  }
}

/**
 * Save full report to Airtable
 * Creates a record in a Full Reports table (or updates snapshot with full report data)
 * 
 * @param reportData - Full report data
 * @returns Promise resolving to Airtable record ID
 */
export async function saveFullReport(reportData: {
  snapshotId?: string;
  websiteUrl: string;
  email?: string;
  overallScore: number;
  brandScore: number;
  contentScore: number;
  websiteScore: number;
  rawJson: string;
}): Promise<string> {
  try {
    // Use Full Reports table (separate from Snapshots)
    const fullReportsTable = process.env.AIRTABLE_FULL_REPORTS_TABLE || 'Full Reports';
    
    // Parse raw JSON to extract additional data
    let parsedJson: any = {};
    try {
      parsedJson = JSON.parse(reportData.rawJson);
    } catch (e) {
      console.warn('Could not parse raw JSON:', e);
    }
    
    // Get available fields from Full Reports table
    let availableFields: string[] = [];
    try {
      const sampleRecords = await base(fullReportsTable).select({ maxRecords: 1 }).firstPage();
      if (sampleRecords.length > 0) {
        availableFields = Object.keys(sampleRecords[0].fields);
        console.log('📋 Available fields in Full Reports table:', availableFields.join(', '));
      }
    } catch (checkError) {
      console.warn('⚠️  Could not check available fields in Full Reports table:', checkError);
    }
    
    // Build fields for Full Reports table
    const fieldsToCreate: Record<string, unknown> = {
      'Overall Score': Math.round(reportData.overallScore),
      'Brand Score': Math.round(reportData.brandScore),
      'Content Score': Math.round(reportData.contentScore),
      'Website Score': Math.round(reportData.websiteScore),
      'Raw JSON': reportData.rawJson,
      'Generated Date': new Date().toISOString().split('T')[0], // Date format: YYYY-MM-DD
    };
    
    // Set Report URL if field exists (will be set after record creation)
    // We'll update it after creating the record since we need the reportId
    
    // Map additional fields from parsed JSON if available
    if (parsedJson.companyName && availableFields.includes('Company Name (from Lead)')) {
      // Company Name is likely a formula field, skip it
    }
    
    if (parsedJson.maturityStage && availableFields.includes('Maturity Stage')) {
      fieldsToCreate['Maturity Stage'] = parsedJson.maturityStage;
    }
    
    if (parsedJson.overallScoreSummary && availableFields.includes('One Sentence Summary')) {
      fieldsToCreate['One Sentence Summary'] = parsedJson.overallScoreSummary;
    }
    
    // Map strengths, opportunities, risks, competitor teaser
    if (availableFields.includes('Strengths (Short)')) {
      const strengths = parsedJson.topStrengths || parsedJson.services?.brandingAndImpact?.strengths || [];
      if (Array.isArray(strengths) && strengths.length > 0) {
        fieldsToCreate['Strengths (Short)'] = strengths.slice(0, 3).join(', ');
      } else if (strengths) {
        fieldsToCreate['Strengths (Short)'] = strengths;
      }
    }
    
    if (parsedJson.globalRoadmap && availableFields.includes('Opportunities (Short)')) {
      const opportunities = parsedJson.globalRoadmap.slice(0, 3).map((r: any) => r.action).join(', ');
      fieldsToCreate['Opportunities (Short)'] = opportunities;
    }
    
    if (parsedJson.emergingRisks && availableFields.includes('Emerging Risks')) {
      fieldsToCreate['Emerging Risks'] = Array.isArray(parsedJson.emergingRisks) 
        ? parsedJson.emergingRisks.join(', ') 
        : parsedJson.emergingRisks;
    }
    
    if (parsedJson.competitorTeaser && availableFields.includes('Competitor Teaser')) {
      fieldsToCreate['Competitor Teaser'] = Array.isArray(parsedJson.competitorTeaser)
        ? parsedJson.competitorTeaser.join(' ')
        : parsedJson.competitorTeaser;
    }
    
    // Map 90-Day Priority Theme from roadmap
    if (parsedJson.globalRoadmap && parsedJson.globalRoadmap.length > 0 && availableFields.includes('90-Say Priority Theme')) {
      const topPriority = parsedJson.globalRoadmap[0];
      fieldsToCreate['90-Say Priority Theme'] = topPriority.action || topPriority.theme || '';
    }
    
    // Map LinkedIn and GBP URLs if available
    if (parsedJson.services?.brandingAndImpact?.brandAuthority?.linkedin?.url && availableFields.includes('LinkedIn URL')) {
      fieldsToCreate['LinkedIn URL'] = parsedJson.services.brandingAndImpact.brandAuthority.linkedin.url;
    }
    
    if (parsedJson.services?.brandingAndImpact?.brandAuthority?.gbp?.url && availableFields.includes('GBP URL')) {
      fieldsToCreate['GBP URL'] = parsedJson.services.brandingAndImpact.brandAuthority.gbp.url;
    }
    
    // Calculate Technical Score (average of website and performance metrics)
    if (availableFields.includes('Technical Score')) {
      // Use website score as technical score, or calculate from performance metrics
      const technicalScore = reportData.websiteScore; // Or calculate from parsedJson if available
      fieldsToCreate['Technical Score'] = Math.round(technicalScore);
    }
    
    // Calculate Authority Score (average of brand authority metrics)
    if (availableFields.includes('Authority Score')) {
      // Use brand score as authority score, or calculate from brand authority data
      const authorityScore = reportData.brandScore; // Or calculate from parsedJson if available
      fieldsToCreate['Authority Score'] = Math.round(authorityScore);
    }
    
    // Map SEO Score (separate from Brand Score)
    if (availableFields.includes('SEO Score')) {
      // SEO Score might be different from Brand Score, use brand score for now
      fieldsToCreate['SEO Score'] = Math.round(reportData.brandScore);
    }
    
    // Link to Lead if we have email and Lead field exists
    if (reportData.email && availableFields.includes('Lead')) {
      try {
        // Try to find the lead by email
        const leadsTable = process.env.AIRTABLE_TABLE_NAME || 'Leads';
        const leadRecords = await base(leadsTable)
          .select({
            filterByFormula: `{Email} = "${reportData.email}"`,
            maxRecords: 1,
          })
          .firstPage();
        
        if (leadRecords.length > 0) {
          fieldsToCreate['Lead'] = [leadRecords[0].id];
          console.log(`✅ Linked full report to lead: ${leadRecords[0].id}`);
        }
      } catch (leadError) {
        console.warn('⚠️  Could not link to lead:', leadError);
      }
    }
    
    // Link to Snapshot if snapshotId provided and field exists
    if (reportData.snapshotId && availableFields.includes('Snapshot')) {
      try {
        fieldsToCreate['Snapshot'] = [reportData.snapshotId];
      } catch (snapshotError) {
        console.warn('⚠️  Could not link to snapshot:', snapshotError);
      }
    }
    
    // Only include fields that exist in the table
    if (availableFields.length > 0) {
      const fieldsToRemove: string[] = [];
      for (const fieldName of Object.keys(fieldsToCreate)) {
        if (!availableFields.includes(fieldName)) {
          fieldsToRemove.push(fieldName);
          console.warn(`⚠️  Field "${fieldName}" does not exist in Full Reports table. Skipping.`);
        }
      }
      for (const fieldName of fieldsToRemove) {
        delete fieldsToCreate[fieldName];
      }
    }
    
    const record = await base(fullReportsTable).create([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { fields: fieldsToCreate as any },
    ]);
    
    const reportId = record[0].id;
    console.log(`✅ Created full report record in Full Reports table: ${reportId}`);
    
    // Update Report URL field if it exists
    if (availableFields.includes('Report URL')) {
      try {
        const reportUrl = `${process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://hiveadagency.com'}/full-report?id=${reportId}`;
         
        await base(fullReportsTable).update([
          {
            id: reportId,
            fields: {
              'Report URL': reportUrl,
            } as any,
          },
        ]);
        console.log(`✅ Set Report URL: ${reportUrl}`);
      } catch (urlError) {
        console.warn('⚠️  Could not set Report URL:', urlError);
      }
    }
    
    // Also update the snapshot record if snapshotId provided
    if (reportData.snapshotId) {
      try {
        const snapshotsTable = process.env.AIRTABLE_SNAPSHOTS_TABLE || 'Snapshots';
        const snapshotRecord = await base(snapshotsTable).find(reportData.snapshotId);
        const snapshotFields = Object.keys(snapshotRecord.fields);
        
        const snapshotUpdates: Record<string, unknown> = {};
        if (snapshotFields.includes('Full Report Generated')) {
          snapshotUpdates['Full Report Generated'] = true;
        }
        if (snapshotFields.includes('Full Report ID')) {
          snapshotUpdates['Full Report ID'] = reportId;
        }
        
        if (Object.keys(snapshotUpdates).length > 0) {
           
          await base(snapshotsTable).update([
            {
              id: reportData.snapshotId,
              fields: snapshotUpdates as any,
            },
          ]);
          console.log(`✅ Updated snapshot ${reportData.snapshotId} with full report link`);
        }
      } catch (updateError) {
        console.warn('⚠️  Could not update snapshot with full report link:', updateError);
        // Non-critical, continue
      }
    }
    
    return reportId;
  } catch (error) {
    console.error('Error saving full report:', error);
    throw error;
  }
}

/**
 * Get full report by ID
 * Fetches full report from Airtable
 */
export async function getFullReportById(reportId: string): Promise<{
  id: string;
  websiteUrl: string;
  overallScore: number;
  brandScore: number;
  contentScore: number;
  websiteScore: number;
  rawJson?: any;
} | null> {
  try {
    // Try Full Reports table first
    const fullReportsTable = process.env.AIRTABLE_FULL_REPORTS_TABLE || 'Full Reports';
    let record;
    let foundInFullReports = false;
    
    try {
      record = await base(fullReportsTable).find(reportId);
      foundInFullReports = true;
      console.log(`✅ Found full report in Full Reports table: ${reportId}`);
    } catch (fullReportsError) {
      // Fallback to Snapshots table for backward compatibility
      console.log(`⚠️  Not found in Full Reports table, checking Snapshots table...`);
      const snapshotsTable = process.env.AIRTABLE_SNAPSHOTS_TABLE || 'Snapshots';
      record = await base(snapshotsTable).find(reportId);
    }
    
    if (!record) {
      return null;
    }

    const fields = record.fields;
    const rawJsonStr = fields['Raw JSON'] as string | undefined;
    let rawJson: any = null;
    
    if (rawJsonStr) {
      try {
        rawJson = JSON.parse(rawJsonStr);
      } catch (e) {
        console.warn('Failed to parse Raw JSON from full report:', e);
      }
    }

    // Extract scores from raw JSON or fallback to direct fields
    // Full Reports table uses different field names
    const overallScore = rawJson?.overallScore ?? fields['Overall Score'] ?? 0;
    const brandScore = foundInFullReports 
      ? (rawJson?.services?.brandingAndImpact?.score ?? fields['Brand Score'] ?? fields['SEO Score'] ?? 0)
      : (rawJson?.services?.brandingAndImpact?.score ?? fields['SEO Score'] ?? 0);
    const contentScore = rawJson?.services?.contentAndEngagement?.score ?? fields['Content Score'] ?? 0;
    const websiteScore = foundInFullReports
      ? (rawJson?.services?.websiteAndConversion?.score ?? fields['Website Score'] ?? fields['Conversion Score'] ?? 0)
      : (rawJson?.services?.websiteAndConversion?.score ?? fields['Conversion Score'] ?? 0);
    
    // Get website URL from Lead link or direct field
    let websiteUrl = fields['Website URL'] || fields['Website'] || fields['URL'] || rawJson?.websiteUrl;
    if (!websiteUrl && fields['Lead'] && Array.isArray(fields['Lead']) && fields['Lead'].length > 0) {
      // Try to get website URL from linked Lead record
      try {
        const leadsTable = process.env.AIRTABLE_TABLE_NAME || 'Leads';
        const leadRecord = await base(leadsTable).find(fields['Lead'][0] as string);
        websiteUrl = leadRecord.fields['Website URL'] || leadRecord.fields['Website'] || leadRecord.fields['URL'];
      } catch (leadError) {
        console.warn('Could not fetch website URL from linked Lead:', leadError);
      }
    }
    
    return {
      id: reportId,
      websiteUrl: (websiteUrl || '') as string,
      overallScore: typeof overallScore === 'number' ? overallScore : parseInt(String(overallScore)) || 0,
      brandScore: typeof brandScore === 'number' ? brandScore : parseInt(String(brandScore)) || 0,
      contentScore: typeof contentScore === 'number' ? contentScore : parseInt(String(contentScore)) || 0,
      websiteScore: typeof websiteScore === 'number' ? websiteScore : parseInt(String(websiteScore)) || 0,
      rawJson,
    };
  } catch (error) {
    console.error('Error getting full report:', error);
    return null;
  }
}
