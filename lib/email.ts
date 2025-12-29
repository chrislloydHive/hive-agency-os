import { Resend } from 'resend';
import { env } from './env';

// Lazy initialization to avoid build-time errors
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('Resend API key not configured. Please set RESEND_API_KEY environment variable.');
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface AssessmentNotificationData {
  name: string;
  email: string;
  companyName: string;
  websiteUrl: string;
  recordId: string;
}

export interface ReportData {
  name: string;
  email: string;
  companyName: string;
  reportContent: string;
  downloadUrl?: string;
}

/**
 * Send a generic email
 */
export async function sendEmail(emailData: EmailData): Promise<boolean> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: emailData.from || env.FROM_EMAIL || 'noreply@hiveadagency.com',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
    });

    if (error) {
       
      console.error('Resend API error:', error);
      return false;
    }

     
    console.log('Email sent successfully:', data?.id);
    return true;
  } catch (error) {
     
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Send assessment confirmation email to client
 */
export async function sendAssessmentConfirmation(data: AssessmentNotificationData): Promise<boolean> {
  const subject = `Marketing Assessment Confirmation - ${data.companyName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Marketing Assessment Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f4d03f; padding: 20px; text-align: center; border: 2px solid #000; }
        .content { padding: 20px; background-color: #fff; border: 2px solid #000; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background-color: #000; color: #f4d03f; text-decoration: none; border-radius: 5px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; color: #000;">🎯 Marketing Assessment Confirmation</h1>
        </div>
        
        <div class="content">
          <h2>Hello ${data.name},</h2>
          
          <p>Thank you for submitting your marketing assessment request for <strong>${data.companyName}</strong>!</p>
          
          <p>We've received your submission and our team is already working on analyzing your business and website to provide you with a comprehensive marketing assessment.</p>
          
          <h3>What happens next?</h3>
          <ul>
            <li><strong>Immediate:</strong> Our AI system is analyzing your website at ${data.websiteUrl}</li>
            <li><strong>24-48 hours:</strong> You'll receive your personalized marketing assessment report</li>
            <li><strong>1 week:</strong> We'll schedule a consultation to discuss your results and next steps</li>
          </ul>
          
          <h3>Your Assessment ID</h3>
          <p><strong>${data.recordId}</strong> - Please keep this for reference</p>
          
          <p>If you have any questions or need to make changes to your submission, please don't hesitate to reach out to us.</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="mailto:${env.FROM_EMAIL}" class="button">Contact Our Team</a>
          </p>
        </div>
        
        <div class="footer">
          <p>Best regards,<br>The Hive A.D. Agency Team</p>
          <p><small>This email was sent to ${data.email}</small></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: data.email,
    subject,
    html
  });
}

/**
 * Send marketing assessment report to client
 */
export async function sendMarketingReport(data: ReportData): Promise<boolean> {
  const subject = `Your Marketing Assessment Report - ${data.companyName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Marketing Assessment Report</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f4d03f; padding: 20px; text-align: center; border: 2px solid #000; }
        .content { padding: 20px; background-color: #fff; border: 2px solid #000; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background-color: #000; color: #f4d03f; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .report-preview { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; color: #000;">📊 Your Marketing Assessment Report</h1>
        </div>
        
        <div class="content">
          <h2>Hello ${data.name},</h2>
          
          <p>Great news! Your comprehensive marketing assessment for <strong>${data.companyName}</strong> is ready.</p>
          
          <p>Our AI-powered analysis has reviewed your business, website, and current marketing efforts to provide you with actionable insights and strategic recommendations.</p>
          
          <h3>Report Preview</h3>
          <div class="report-preview">
            <p><strong>Executive Summary:</strong></p>
            <p>${data.reportContent.substring(0, 300)}...</p>
          </div>
          
          <h3>What's included in your report:</h3>
          <ul>
            <li>📈 Current marketing performance analysis</li>
            <li>🔍 Website and content review</li>
            <li>🎯 Strategic recommendations</li>
            <li>📅 Implementation roadmap</li>
            <li>💰 ROI projections and budget guidance</li>
            <li>🚀 Next steps and action items</li>
          </ul>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.downloadUrl || '#'}" class="button">Download Full Report</a>
          </p>
          
          <h3>Next Steps</h3>
          <p>We'll be reaching out within the next 24 hours to schedule your consultation call, where we'll:</p>
          <ul>
            <li>Walk through your report in detail</li>
            <li>Answer any questions you have</li>
            <li>Discuss implementation priorities</li>
            <li>Create a customized action plan</li>
          </ul>
          
          <p>If you'd like to schedule your consultation sooner, feel free to reply to this email or call us directly.</p>
        </div>
        
        <div class="footer">
          <p>Best regards,<br>The Hive A.D. Agency Team</p>
          <p><small>This email was sent to ${data.email}</small></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: data.email,
    subject,
    html
  });
}

/**
 * Send internal notification to team about new assessment
 */
export async function sendInternalNotification(data: AssessmentNotificationData): Promise<boolean> {
  const subject = `New Marketing Assessment: ${data.companyName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Marketing Assessment</title>
    </head>
    <body>
      <h2>New Marketing Assessment Submitted</h2>
      
      <h3>Company Details:</h3>
      <ul>
        <li><strong>Company:</strong> ${data.companyName}</li>
        <li><strong>Contact:</strong> ${data.name} (${data.email})</li>
        <li><strong>Website:</strong> ${data.websiteUrl}</li>
        <li><strong>Record ID:</strong> ${data.recordId}</li>
      </ul>
      
      <p>Please review and begin the assessment process.</p>
      
      <p>Best regards,<br>Hive Forms System</p>
    </body>
    </html>
  `;

  return sendEmail({
    to: env.FROM_EMAIL || 'team@hiveadagency.com',
    subject,
    html
  });
}

// ============================================================================
// SNAPSHOT EMAIL FUNCTIONS
// ============================================================================

export interface SnapshotEmailData {
  email: string;
  websiteUrl: string;
  overallScore: number;
  seoScore: number;
  contentScore: number;
  conversionScore: number;
  performanceScore: number;
  quickWins: string[];
  strengths: string[];
  contentInsights?: string;
}

/**
 * Send snapshot results email via Resend
 * Returns true if sent successfully, false otherwise
 * If RESEND_API_KEY is missing, logs warning and returns false (graceful degradation)
 * Email includes scores, quick wins, strengths, and CTA link to full assessment
 * 
 * @param data - Snapshot email data including scores and insights
 * @returns Promise resolving to boolean (true if sent, false if skipped/failed)
 * @throws Never throws - returns false on error
 */
export async function sendSnapshotEmail(
  data: SnapshotEmailData
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn(
      '⚠️  RESEND_API_KEY not set. Snapshot email will not be sent.'
    );
    return false;
  }

  try {
    const hostname = new URL(data.websiteUrl).hostname.replace(/^www\./, '');
    const subject = `Your Hive Snapshot: ${data.overallScore}/100 — ${hostname}`;

    const assessmentUrl = new URL('/assessment', process.env.SITE_URL || 'https://www.hiveadagency.com');
    assessmentUrl.searchParams.set('website', data.websiteUrl);
    assessmentUrl.searchParams.set('email', data.email);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Hive Snapshot</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #fbbf24; padding: 30px 20px; text-align: center; border: 2px solid #000; }
          .content { padding: 30px 20px; background-color: #fff; border: 2px solid #000; border-top: none; }
          .score-display { text-align: center; margin: 30px 0; }
          .overall-score { font-size: 72px; font-weight: bold; color: #000; margin: 10px 0; }
          .scores-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 30px 0; }
          .score-item { padding: 15px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 5px; }
          .score-label { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 5px; }
          .score-value { font-size: 24px; font-weight: bold; color: #000; }
          .section { margin: 30px 0; }
          .section-title { font-size: 18px; font-weight: bold; color: #000; margin-bottom: 15px; }
          .list { list-style: none; padding: 0; }
          .list li { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .list li:last-child { border-bottom: none; }
          .list li::before { content: "✓ "; color: #fbbf24; font-weight: bold; margin-right: 10px; }
          .cta-button { display: inline-block; padding: 15px 30px; background-color: #000; color: #fbbf24; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #000;">Your Hive Snapshot</h1>
          </div>
          
          <div class="content">
            <div class="score-display">
              <div class="overall-score">${data.overallScore}</div>
              <p style="font-size: 18px; color: #6b7280;">Overall Marketing Score</p>
            </div>

            <div class="scores-grid">
              <div class="score-item">
                <div class="score-label">SEO</div>
                <div class="score-value">${data.seoScore}</div>
              </div>
              <div class="score-item">
                <div class="score-label">Content</div>
                <div class="score-value">${data.contentScore}</div>
              </div>
              <div class="score-item">
                <div class="score-label">Conversion</div>
                <div class="score-value">${data.conversionScore}</div>
              </div>
              <div class="score-item">
                <div class="score-label">Performance</div>
                <div class="score-value">${data.performanceScore}</div>
              </div>
            </div>

                    <div class="section">
                      <div class="section-title">Quick Wins</div>
                      <ul class="list">
                        ${data.quickWins.map((win) => `<li>${win}</li>`).join('')}
                      </ul>
                    </div>

                    <div class="section">
                      <div class="section-title">Strengths</div>
                      <ul class="list">
                        ${data.strengths.map((strength) => `<li>${strength}</li>`).join('')}
                      </ul>
                    </div>

                    ${data.contentInsights ? `
                    <div class="section">
                      <div class="section-title">Content Analysis</div>
                      <p style="color: #333; line-height: 1.6; margin-top: 10px;">
                        ${data.contentInsights}
                      </p>
                    </div>
                    ` : ''}

                    <div style="text-align: center; margin: 40px 0;">
                      <a href="${assessmentUrl.toString()}" class="cta-button">Get Your Full Growth Assessment</a>
                    </div>

            <p style="color: #6b7280; font-size: 14px;">
              Want to dive deeper? Get a comprehensive marketing assessment with personalized recommendations, 
              ROI projections, and a custom action plan tailored to your business.
            </p>
          </div>
          
          <div class="footer">
            <p>Best regards,<br>The Hive A.D. Agency Team</p>
            <p><small>This email was sent to ${data.email}</small></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return sendEmail({
      to: data.email,
      subject,
      html,
    });
  } catch (error) {
     
    console.error('Error sending snapshot email:', error);
    return false;
  }
}
