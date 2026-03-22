/**
 * Agency SMTP Settings Management
 *
 * POST /api/agency/smtp-settings - Save SMTP settings
 * DELETE /api/agency/smtp-settings - Disable custom SMTP
 * GET /api/agency/smtp-settings - Get SMTP status
 *
 * The password is encrypted before storage.
 */
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { encrypt, decrypt } from '@/lib/encryption';
import { checkRateLimit } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';


// POST: Save SMTP settings
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

    // Rate limiting: 5 SMTP config changes per minute per user
    const rateLimitResult = checkRateLimit(`smtp-settings:${user.id}`, 5, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { host, port, user: smtpUser, password, sender } = await req.json();

    // Check if user already has SMTP configured (for updates)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('agency_smtp_enabled, agency_smtp_pass_encrypted')
      .eq('id', user.id)
      .single();

    const isUpdate = existingProfile?.agency_smtp_enabled && existingProfile?.agency_smtp_pass_encrypted;

    // Validate required fields - password is optional when updating existing settings
    if (!host || !smtpUser || !sender) {
      return NextResponse.json(
        { error: 'Required fields: host, user, sender' },
        { status: 400 }
      );
    }

    // Password is required for new setups, optional for updates
    if (!isUpdate && !password) {
      return NextResponse.json(
        { error: 'Password is required for initial SMTP setup' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sender)) {
      return NextResponse.json(
        { error: 'Invalid sender email format' },
        { status: 400 }
      );
    }

    // Determine which password to use for verification
    let passwordToUse = password;
    if (!password && isUpdate) {
      // Use existing encrypted password
      try {
        passwordToUse = decrypt(existingProfile.agency_smtp_pass_encrypted);
      } catch (decryptError) {
        console.error('Failed to decrypt existing password:', decryptError);
        return NextResponse.json(
          { error: 'Failed to retrieve existing password. Please enter your password again.' },
          { status: 400 }
        );
      }
    }

    // Test the SMTP connection
    try {
      const transporter = nodemailer.createTransport({
        host,
        port: port || 587,
        secure: port === 465,
        auth: {
          user: smtpUser,
          pass: passwordToUse,
        },
      });

      await transporter.verify();
    } catch (smtpError: any) {
      console.error('SMTP verification failed:', smtpError.message);
      return NextResponse.json(
        { error: `SMTP connection failed: ${smtpError.message}` },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: Record<string, any> = {
      agency_smtp_host: host,
      agency_smtp_port: port || 587,
      agency_smtp_user: smtpUser,
      agency_smtp_sender: sender,
      agency_smtp_enabled: true,
    };

    // Only update password if a new one was provided
    if (password) {
      updateData.agency_smtp_pass_encrypted = encrypt(password);
    }

    // Save settings
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to save SMTP settings:', updateError);
      return NextResponse.json(
        { error: 'Failed to save SMTP settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'SMTP settings saved successfully',
    });
  } catch (error) {
    console.error('Save SMTP settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Disable custom SMTP
export async function DELETE(req: NextRequest) {
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

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        agency_smtp_host: null,
        agency_smtp_port: 587,
        agency_smtp_user: null,
        agency_smtp_pass_encrypted: null,
        agency_smtp_sender: null,
        agency_smtp_enabled: false,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to disable SMTP:', updateError);
      return NextResponse.json(
        { error: 'Failed to disable SMTP' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Custom SMTP disabled',
    });
  } catch (error) {
    console.error('Disable SMTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Get SMTP status
export async function GET(req: NextRequest) {
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

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('agency_smtp_host, agency_smtp_port, agency_smtp_user, agency_smtp_sender, agency_smtp_enabled')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({
      enabled: profile?.agency_smtp_enabled || false,
      host: profile?.agency_smtp_host || null,
      port: profile?.agency_smtp_port || 587,
      user: profile?.agency_smtp_user || null,
      sender: profile?.agency_smtp_sender || null,
    });
  } catch (error) {
    console.error('Get SMTP status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
