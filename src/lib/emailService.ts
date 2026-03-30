import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { APP_URL } from './config';

// Validate SMTP configuration at startup
const SMTP_CONFIGURED = !!(process.env.N8N_SMTP_USER && process.env.N8N_SMTP_PASS);
if (!SMTP_CONFIGURED) {
  // In production, SMTP must be configured for emails to work
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 CRITICAL: SMTP credentials not configured (N8N_SMTP_USER, N8N_SMTP_PASS) - all emails will fail!');
  } else {
    console.warn('⚠️ SMTP credentials not configured (N8N_SMTP_USER, N8N_SMTP_PASS) - emails will fail');
  }
}

// Encryption key for decrypting agency SMTP passwords
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32) || '';
if (!ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL: No encryption key configured for agency SMTP passwords - set ENCRYPTION_SECRET');
  } else {
    console.warn('No encryption key configured for agency SMTP passwords');
  }
}

/**
 * Sanitize string for safe HTML output (prevent XSS)
 */
function sanitizeHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function decryptPassword(encryptedText: string): string {
  if (!encryptedText || !ENCRYPTION_KEY) {
    const errorMsg = '❌ Cannot decrypt: missing encrypted text or encryption key';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) {
      const errorMsg = '❌ Invalid encrypted password format';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8').slice(0, 32), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('❌ Password decryption failed:', error);
    throw new Error('Failed to decrypt agency SMTP password - credentials may be corrupted');
  }
}

export interface AgencySmtpConfig {
  host: string;
  port: number;
  user: string;
  passEncrypted: string;
  sender: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.N8N_SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.N8N_SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.N8N_SMTP_USER,
        pass: process.env.N8N_SMTP_PASS,
      },
    });
  }

  /**
   * Create a transporter for agency-specific SMTP settings
   */
  private createAgencyTransporter(config: AgencySmtpConfig): nodemailer.Transporter {
    const password = decryptPassword(config.passEncrypted);
    return nodemailer.createTransport({
      host: config.host,
      port: config.port || 587,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: password,
      },
    });
  }

  async sendUpgradeRecommendation(to: string, userName: string): Promise<void> {
    const subject = 'Your n8n Workflows Are Growing!';
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">

    <h1 style="color: white; margin: 10px 0 0 0; font-size: 24px;">Your Workflows Are Growing!</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${sanitizeHtml(userName) || 'there'}</strong>,</p>
    <p style="font-size: 15px; line-height: 1.7;">Great news! Your n8n instance is handling a <strong style="color: #667eea;">high volume of workflow executions</strong>.</p>
    <p style="font-size: 15px; line-height: 1.7;">Your automations are working hard, but to ensure optimal performance as your usage grows, we recommend upgrading to a larger plan with more resources.</p>
    <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #667eea;">
      <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">🚀 Upgrade to 50GB Plan</h3>
      <ul style="margin: 15px 0; padding-left: 20px; line-height: 1.9;">
        <li style="margin-bottom: 8px;"><strong>5x more storage</strong> – 50GB for all your workflow data</li>
        <li style="margin-bottom: 8px;"><strong>2x more RAM</strong> – Handle complex workflows with ease</li>
        <li style="margin-bottom: 8px;"><strong>Better performance</strong> – Faster execution times</li>
        <li style="margin-bottom: 8px;"><strong>Room to grow</strong> – Scale your automations without limits</li>
      </ul>
      <p style="margin: 20px 0 0 0; font-size: 24px; font-weight: 700; color: #667eea;">Upgrade Today</p>
    </div>
    <div style="text-align: center; margin: 35px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/n8n-account" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
        Upgrade Now →
      </a>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-top: 35px; padding-top: 20px; border-top: 1px solid #e5e7eb;">Have questions? Just reply to this email and we'll help you choose the right plan.</p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 15px;">Best regards,<br><strong>Your Team</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html);
  }

  async sendSplitRecommendation(to: string, userName: string): Promise<void> {
    const subject = 'High Workflow Activity - Scale Your Setup';
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">

    <h1 style="color: white; margin: 10px 0 0 0; font-size: 24px;">Time to Scale Up</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${sanitizeHtml(userName) || 'there'}</strong>,</p>
    <p style="font-size: 15px; line-height: 1.7;">Excellent! Your workflows are running at <strong style="color: #667eea;">high execution volumes</strong>. This is a great sign of success! 🎉</p>
    <p style="font-size: 15px; line-height: 1.7;">To maintain optimal performance and reliability as you scale, we recommend distributing your workflows across multiple dedicated n8n instances.</p>
    <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #667eea;">
      <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">💡 Multi-Instance Benefits</h3>
      <ul style="margin: 15px 0; padding-left: 20px; line-height: 1.9;">
        <li style="margin-bottom: 8px;"><strong>Dedicated resources</strong> – Each instance gets its own CPU and RAM</li>
        <li style="margin-bottom: 8px;"><strong>Isolation</strong> – Separate production from testing/development</li>
        <li style="margin-bottom: 8px;"><strong>Better organization</strong> – One instance per client or project</li>
        <li style="margin-bottom: 8px;"><strong>Reduced risk</strong> – One workflow issue won't affect others</li>
        <li style="margin-bottom: 8px;"><strong>Improved uptime</strong> – Keep critical workflows always running</li>
      </ul>
      <p style="margin: 20px 0 0 0; font-size: 15px; color: #4b5563;">Deploy additional instances for better performance and isolation.</p>
    </div>
    <div style="text-align: center; margin: 35px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/n8n-account" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
        Deploy Additional Instance →
      </a>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-top: 35px; padding-top: 20px; border-top: 1px solid #e5e7eb;">Need help planning your multi-instance setup? Reply to this email and we'll create a custom plan for you.</p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 15px;">Best regards,<br><strong>Your Team</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html);
  }

  async sendCriticalStorageWarning(to: string, userName: string, storageUsedPercent: number, storageLimitGb: number): Promise<void> {
    const subject = '⚠️ URGENT: Your n8n Instance is Nearly Full';
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">

    <h1 style="color: white; margin: 10px 0 0 0; font-size: 24px;">⚠️ Critical Storage Alert</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${sanitizeHtml(userName) || 'there'}</strong>,</p>
    <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-left: 5px solid #ef4444; padding: 25px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.15);">
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #991b1b;">⚠️ Your n8n instance is at <span style="font-size: 28px; color: #dc2626;">${storageUsedPercent}%</span> capacity!</p>
    </div>
    <p style="font-size: 15px; line-height: 1.7;"><strong style="color: #dc2626;">This is critical:</strong> When your instance reaches 100% storage capacity, <span style="color: #ef4444; font-weight: 600;">workflow executions will fail</span> and your automations will stop working.</p>
    <p style="font-size: 15px; line-height: 1.7; margin-top: 20px;">You currently have only <strong style="color: #dc2626;">${100 - storageUsedPercent}%</strong> remaining storage space.</p>
    <div style="background: #fff7ed; padding: 28px; border-radius: 10px; margin: 30px 0; border: 2px solid #fb923c;">
      <h3 style="margin-top: 0; color: #dc2626; font-size: 18px;">🚨 Take Action Now</h3>
      <ul style="margin: 15px 0; padding-left: 20px; line-height: 1.9;">
        <li style="margin-bottom: 10px;"><strong>Clean up old data:</strong> Review and delete old workflow execution logs</li>
        <li style="margin-bottom: 10px;"><strong>Remove unused workflows:</strong> Archive or delete workflows you're no longer using</li>
        <li style="margin-bottom: 10px;"><strong>Upgrade storage:</strong> ${storageLimitGb === 10 ? 'Move to our 30GB plan for 3x more space' : storageLimitGb === 30 ? 'Move to our 50GB plan for more space' : 'Contact us for enterprise storage options'}</li>
        <li style="margin-bottom: 10px;"><strong>Split workflows:</strong> Distribute across multiple instances for better performance</li>
      </ul>
    </div>
    <div style="text-align: center; margin: 35px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/n8n-account" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-decoration: none; padding: 18px 45px; border-radius: 8px; font-weight: 700; display: inline-block; font-size: 17px; box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
        ⚡ Upgrade Now to Prevent Downtime
      </a>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-top: 35px; padding-top: 20px; border-top: 1px solid #e5e7eb;"><strong style="color: #dc2626;">Need immediate help?</strong> Reply to this email and we'll assist you right away. Our team is here to help!</p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 15px;">Best regards,<br><strong>Your Team</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html);
  }

  async sendClientInvitation(
    to: string,
    agencyName: string,
    storageSizeGb: number,
    billingCycle: 'monthly' | 'annual',
    inviteUrl: string,
    agencySmtp?: AgencySmtpConfig
  ): Promise<void> {
    const isBYON = storageSizeGb === 0;

    const subject = `You've been invited to ${sanitizeHtml(agencyName)}'s portal`;

    // Different content for BYON (portal-only) vs hosted instances
    // Note: For hosted invites, the client picks their own billing cycle when they accept,
    // so we don't show specific pricing in the email.
    const detailsSection = isBYON
      ? `
    <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #667eea;">
      <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">Your Portal Access</h3>
      <p style="margin: 10px 0 0; color: #374151;">Connect your existing server and manage your workflows from a dedicated portal.</p>
    </div>`
      : `
    <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #667eea;">
      <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">Your Dedicated Server</h3>
      <ul style="margin: 15px 0; padding-left: 20px; line-height: 1.9;">
        <li style="margin-bottom: 8px;"><strong>Storage:</strong> ${storageSizeGb}GB SSD</li>
        <li style="margin-bottom: 8px;">Choose your billing plan (monthly or annual) when you accept</li>
      </ul>
    </div>`;

    const featuresSection = isBYON
      ? `
    <p style="font-size: 15px; line-height: 1.7;">With your portal access, you'll be able to:</p>
    <ul style="margin: 15px 0; padding-left: 20px; line-height: 1.9;">
      <li style="margin-bottom: 8px;">View and manage your workflows</li>
      <li style="margin-bottom: 8px;">See execution logs and history</li>
      <li style="margin-bottom: 8px;">Trigger workflows with simple buttons</li>
      <li style="margin-bottom: 8px;">Connect your existing server</li>
    </ul>`
      : `
    <p style="font-size: 15px; line-height: 1.7;">With your portal, you'll be able to:</p>
    <ul style="margin: 15px 0; padding-left: 20px; line-height: 1.9;">
      <li style="margin-bottom: 8px;">View and manage your workflows</li>
      <li style="margin-bottom: 8px;">See execution logs and history</li>
      <li style="margin-bottom: 8px;">Trigger workflows with simple buttons</li>
      <li style="margin-bottom: 8px;">Get your own dedicated server</li>
    </ul>`;

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi there!</p>
    <p style="font-size: 15px; line-height: 1.7;"><strong style="color: #667eea;">${sanitizeHtml(agencyName)}</strong> has invited you to their portal.</p>
    ${detailsSection}
    ${featuresSection}

    <div style="text-align: center; margin: 35px 0;">
      <a href="${inviteUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
        Accept Invitation
      </a>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 25px;">This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">Best regards,<br><strong>${sanitizeHtml(agencyName)}</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html, agencySmtp);
  }

  async sendClientAccessGrant(
    to: string,
    agencyName: string,
    inviteUrl: string,
    agencySmtp?: AgencySmtpConfig
  ): Promise<void> {
    const subject = `You've been invited to ${sanitizeHtml(agencyName)}'s portal`;
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You've Got Access!</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi there!</p>
    <p style="font-size: 15px; line-height: 1.7;"><strong style="color: #667eea;">${sanitizeHtml(agencyName)}</strong> has invited you to their portal.</p>

    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #22c55e;">
      <h3 style="margin-top: 0; color: #166534; font-size: 18px;">✓ No Payment Required</h3>
      <p style="margin: 0; color: #166534;">Your agency has already set up everything for you. Just create an account to access your portal.</p>
    </div>

    <p style="font-size: 15px; line-height: 1.7;">With your portal, you'll be able to:</p>
    <ul style="margin: 15px 0; padding-left: 20px; line-height: 1.9;">
      <li style="margin-bottom: 8px;">View your workflows</li>
      <li style="margin-bottom: 8px;">Trigger actions with simple buttons</li>
      <li style="margin-bottom: 8px;">Submit data through easy forms</li>
      <li style="margin-bottom: 8px;">See execution history and logs</li>
    </ul>

    <div style="text-align: center; margin: 35px 0;">
      <a href="${inviteUrl}" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);">
        Access Your Portal
      </a>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 25px;">This invitation expires in 30 days. If you didn't expect this email, you can safely ignore it.</p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">Best regards,<br><strong>${sanitizeHtml(agencyName)}</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html, agencySmtp);
  }

  async sendTeamMemberInvite(
    to: string,
    ownerName: string,
    role: string,
    inviteUrl: string
  ): Promise<void> {
    const roleLabel = role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : 'Member';
    const subject = `${sanitizeHtml(ownerName)} invited you to their team`;
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi there!</p>
    <p style="font-size: 15px; line-height: 1.7;"><strong style="color: #667eea;">${sanitizeHtml(ownerName)}</strong> has invited you to join their team as <strong>${roleLabel}</strong>.</p>

    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #3b82f6;">
      <h3 style="margin-top: 0; color: #1e40af; font-size: 18px;">Team ${roleLabel} Access</h3>
      <p style="margin: 0; color: #1e40af;">Accept to access the shared portal, instances, and workflows.</p>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="${inviteUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
        Join Team
      </a>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 25px;">If you didn't expect this email, you can safely ignore it.</p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">Best regards,<br><strong>${sanitizeHtml(ownerName)}</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html);
  }

  async sendClientWelcome(
    to: string,
    agencyName: string,
    dashboardUrl: string,
    agencySmtp?: AgencySmtpConfig
  ): Promise<void> {
    const subject = `Welcome - Your portal is ready!`;
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome!</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi there!</p>
    <p style="font-size: 15px; line-height: 1.7;">Great news! Your account has been set up successfully. <strong style="color: #22c55e;">${sanitizeHtml(agencyName)}</strong> has given you access to their portal.</p>

    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #22c55e;">
      <h3 style="margin-top: 0; color: #166534; font-size: 18px;">✓ Your Account is Ready</h3>
      <p style="margin: 0; color: #166534;">You can now access your portal to view workflows, trigger actions, and more.</p>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);">
        Go to My Portal
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">If you have any questions, just reply to this email.<br><br>Best regards,<br><strong>${sanitizeHtml(agencyName)}</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html, agencySmtp);
  }

  /**
   * Send notification about a new template available
   */
  async sendNewTemplateNotification(
    to: string,
    templateName: string,
    templateDescription: string | null,
    agencyName: string,
    dashboardUrl: string,
    agencySmtp?: AgencySmtpConfig
  ): Promise<void> {
    const subject = `New Workflow Template Available: ${sanitizeHtml(templateName)}`;
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">New Template Available</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi there!</p>
    <p style="font-size: 15px; line-height: 1.7;"><strong style="color: #667eea;">${sanitizeHtml(agencyName)}</strong> has published a new workflow template that you can now import.</p>

    <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #667eea;">
      <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">${sanitizeHtml(templateName)}</h3>
      ${templateDescription ? `<p style="margin: 10px 0 0 0; color: #4b5563; font-size: 14px;">${sanitizeHtml(templateDescription)}</p>` : ''}
    </div>

    <p style="font-size: 15px; line-height: 1.7;">To import this template and start using it in your workflows, visit your dashboard.</p>

    <div style="text-align: center; margin: 35px 0;">
      <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
        View Templates
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">Best regards,<br><strong>${sanitizeHtml(agencyName)}</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html, agencySmtp);
  }

  /**
   * Send notification about a template update
   */
  async sendTemplateUpdateNotification(
    to: string,
    templateName: string,
    workflowName: string,
    oldVersion: number,
    newVersion: number,
    changelog: string,
    dashboardUrl: string,
    agencyName: string,
    agencySmtp?: AgencySmtpConfig
  ): Promise<void> {
    const subject = `Workflow Update Available: ${sanitizeHtml(templateName)} v${newVersion}`;
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Workflow Update Available</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi there!</p>
    <p style="font-size: 15px; line-height: 1.7;">An update is available for one of your workflows.</p>

    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #22c55e;">
      <h3 style="margin-top: 0; color: #166534; font-size: 18px;">${sanitizeHtml(workflowName)}</h3>
      <p style="margin: 10px 0 0 0; color: #166534; font-size: 14px;">
        <strong>Version:</strong> v${oldVersion} → v${newVersion}
      </p>
    </div>

    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #374151;">What's Changed:</p>
      <p style="margin: 0; font-size: 14px; color: #4b5563;">${sanitizeHtml(changelog)}</p>
    </div>

    <p style="font-size: 15px; line-height: 1.7;">Visit your dashboard to review and apply this update. Your current configuration will be preserved.</p>

    <div style="text-align: center; margin: 35px 0;">
      <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);">
        View Update
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">Best regards,<br><strong>${sanitizeHtml(agencyName)}</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html, agencySmtp);
  }

  /**
   * Send deployment failure alert to admin
   */
  async sendDeploymentFailureAlert(opts: {
    userEmail: string;
    instanceName: string;
    route: 'Pro/Pro+' | 'Pay-Per-Instance' | 'OpenClaw Provision';
    error: string;
    serverIp?: string;
  }): Promise<void> {
    const subject = `[ALERT] Deployment Failed: ${opts.instanceName}`;
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #dc2626; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Deployment Failed</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 8px 0; font-weight: bold;">User:</td><td style="padding: 8px 0;">${sanitizeHtml(opts.userEmail)}</td></tr>
      <tr><td style="padding: 8px 0; font-weight: bold;">Instance:</td><td style="padding: 8px 0;">${sanitizeHtml(opts.instanceName)}</td></tr>
      <tr><td style="padding: 8px 0; font-weight: bold;">Route:</td><td style="padding: 8px 0;">${sanitizeHtml(opts.route)}</td></tr>
      <tr><td style="padding: 8px 0; font-weight: bold;">Server:</td><td style="padding: 8px 0;">${sanitizeHtml(opts.serverIp || 'unknown')}</td></tr>
      <tr><td style="padding: 8px 0; font-weight: bold;">Time:</td><td style="padding: 8px 0;">${new Date().toISOString()}</td></tr>
    </table>
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-top: 20px;">
      <p style="margin: 0 0 5px 0; font-weight: bold; color: #991b1b;">Error:</p>
      <pre style="margin: 0; white-space: pre-wrap; font-size: 13px; color: #7f1d1d;">${sanitizeHtml(opts.error)}</pre>
    </div>
  </div>
</body>
</html>`;
    await this.sendEmail(process.env.ADMIN_EMAIL || '', subject, html);
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailedNotice(
    to: string,
    userName: string,
    isInstance: boolean,
    instanceName: string | null
  ): Promise<void> {
    const subject = '⚠️ Payment Failed - Update Payment Method';
    const entityType = isInstance ? 'instance' : 'membership';
    const entityName = isInstance && instanceName ? ` (${instanceName})` : '';

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Payment Failed</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${sanitizeHtml(userName)}</strong>,</p>
    <p style="font-size: 15px; line-height: 1.7;">We were unable to process your payment for your ${entityType}${entityName}.</p>

    <p style="font-size: 15px; line-height: 1.7; color: #dc2626; font-weight: 600;">⚠️ Warning: If payment is not updated, your ${entityType} will be canceled and you may lose your data.</p>

    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #f59e0b;">
      <h3 style="margin-top: 0; color: #92400e; font-size: 18px;">Action Required</h3>
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        Please update your payment method immediately to prevent data loss and restore access to your ${entityType}.
      </p>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="${APP_URL}/settings?tab=billing" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);">
        Update Payment Method
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">If you have questions, reply to this email.<br><br>Best regards,<br><strong>Your Team</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html);
  }

  /**
   * Send subscription canceled notification with restoration notice
   */
  async sendSubscriptionCanceledNotice(
    to: string,
    userName: string,
    isInstance: boolean,
    instanceName: string | null
  ): Promise<void> {
    const subject = 'Subscription Canceled - Data Available for 7 Days';
    const entityType = isInstance ? 'instance' : 'membership';
    const entityName = isInstance && instanceName ? ` "${instanceName}"` : '';
    const backupNote = isInstance ? '<li style="margin-bottom: 8px;">All your backups are preserved on our servers</li>' : '';

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Canceled</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${sanitizeHtml(userName)}</strong>,</p>
    <p style="font-size: 15px; line-height: 1.7;">Your ${entityType}${entityName} subscription has been canceled.</p>

    <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 28px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #3b82f6;">
      <h3 style="margin-top: 0; color: #1e40af; font-size: 18px;">7-Day Restoration Available</h3>
      <p style="margin: 10px 0 15px 0; color: #1e40af; font-size: 14px;">
        Good news! Your data is safe for the next 7 days. Resubscribe within this period to restore:
      </p>
      <ul style="margin: 15px 0; padding-left: 20px; line-height: 1.9; color: #1e40af;">
        <li style="margin-bottom: 8px;">All your workflows and configurations</li>
        <li style="margin-bottom: 8px;">Execution history and logs</li>
        ${backupNote}
        <li style="margin-bottom: 8px;">Your original subdomain and credentials</li>
      </ul>
    </div>

    <p style="font-size: 15px; line-height: 1.7;">To restore your ${entityType}, simply resubscribe through our dashboard.</p>

    <div style="text-align: center; margin: 35px 0;">
      <a href="${APP_URL}/#pricing" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
        Restore Subscription
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">If you have questions, reply to this email.<br><br>Best regards,<br><strong>Your Team</strong></p>
  </div>
</body>
</html>`;
    await this.sendEmail(to, subject, html);
  }

  private async sendEmail(to: string, subject: string, html: string, agencySmtp?: AgencySmtpConfig): Promise<void> {
    // Fail fast if no SMTP configured and no agency SMTP provided
    if (!agencySmtp && !SMTP_CONFIGURED) {
      const errorMsg = 'SMTP credentials not configured - cannot send email';
      console.error(`❌ ${errorMsg} (to: ${to}, subject: ${subject})`);
      throw new Error(errorMsg);
    }

    let transporter = this.transporter;
    let from = process.env.N8N_SMTP_SENDER || process.env.SMTP_FROM || 'noreply@example.com';

    // Use agency SMTP if provided
    if (agencySmtp) {
      transporter = this.createAgencyTransporter(agencySmtp);
      from = agencySmtp.sender;
    }

    try {
      await transporter.sendMail({ from, to, subject, html });
      console.log(`✅ Email sent to ${to}: ${subject}`);
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
