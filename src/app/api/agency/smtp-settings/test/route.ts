/**
 * Test Agency SMTP Settings
 *
 * POST /api/agency/smtp-settings/test - Send a test email
 */
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { decrypt } from '@/lib/encryption';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';


export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get SMTP settings
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('agency_smtp_host, agency_smtp_port, agency_smtp_user, agency_smtp_pass_encrypted, agency_smtp_sender, agency_smtp_enabled')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.agency_smtp_enabled || !profile.agency_smtp_pass_encrypted) {
      return NextResponse.json(
        { error: 'SMTP is not configured' },
        { status: 400 }
      );
    }

    // Decrypt password
    const password = decrypt(profile.agency_smtp_pass_encrypted);

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: profile.agency_smtp_host,
      port: profile.agency_smtp_port || 587,
      secure: profile.agency_smtp_port === 465,
      auth: {
        user: profile.agency_smtp_user,
        pass: password,
      },
    });

    // Send test email to user's email
    await transporter.sendMail({
      from: profile.agency_smtp_sender,
      to: user.email,
      subject: 'SMTP Test - Success!',
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">SMTP Test Successful!</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Great news!</p>
    <p style="font-size: 15px; line-height: 1.7;">Your custom SMTP settings are working correctly. Client invitation emails will now be sent from:</p>
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <strong style="font-size: 18px; color: #1f2937;">${profile.agency_smtp_sender}</strong>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      This is a test email. If you received this, your SMTP is configured correctly.
    </p>
  </div>
</body>
</html>`,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${user.email}`,
    });
  } catch (error: any) {
    console.error('SMTP test error:', error);
    return NextResponse.json(
      { error: `Failed to send test email: ${error.message}` },
      { status: 500 }
    );
  }
}
