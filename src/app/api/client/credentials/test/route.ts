/**
 * Credential Test API
 * POST - Test a credential by making a simple API call to the service
 *
 * Tests credentials directly against their respective APIs without needing n8n
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

/**
 * Test credential based on type
 */
async function testCredential(type: string, data: Record<string, any>): Promise<TestResult> {
  const typeLower = type.toLowerCase();

  try {
    // OpenAI
    if (typeLower.includes('openai')) {
      const apiKey = data.apiKey || data.api_key;
      if (!apiKey) return { success: false, message: 'API key is required' };

      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (res.ok) return { success: true, message: 'OpenAI API key is valid' };
      if (res.status === 401) return { success: false, message: 'Invalid API key' };
      return { success: false, message: `OpenAI returned ${res.status}`, details: await res.text() };
    }

    // Anthropic
    if (typeLower.includes('anthropic')) {
      const apiKey = data.apiKey || data.api_key;
      if (!apiKey) return { success: false, message: 'API key is required' };

      // Anthropic doesn't have a simple endpoint to test, so we check the key format
      // and make a minimal request
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });

      if (res.ok) return { success: true, message: 'Anthropic API key is valid' };
      if (res.status === 401) return { success: false, message: 'Invalid API key' };
      if (res.status === 400) return { success: true, message: 'Anthropic API key format is valid' };
      return { success: false, message: `Anthropic returned ${res.status}` };
    }

    // Stripe
    if (typeLower.includes('stripe')) {
      const apiKey = data.apiKey || data.secretKey || data.api_key;
      if (!apiKey) return { success: false, message: 'API key is required' };

      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (res.ok) return { success: true, message: 'Stripe API key is valid' };
      if (res.status === 401) return { success: false, message: 'Invalid API key' };
      return { success: false, message: `Stripe returned ${res.status}` };
    }

    // Telegram
    if (typeLower.includes('telegram')) {
      const token = data.accessToken || data.botToken || data.token;
      if (!token) return { success: false, message: 'Bot token is required' };

      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const json = await res.json();

      if (json.ok) return { success: true, message: `Connected as @${json.result?.username || 'bot'}` };
      return { success: false, message: json.description || 'Invalid bot token' };
    }

    // SendGrid
    if (typeLower.includes('sendgrid')) {
      const apiKey = data.apiKey || data.api_key;
      if (!apiKey) return { success: false, message: 'API key is required' };

      const res = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (res.ok) return { success: true, message: 'SendGrid API key is valid' };
      if (res.status === 401) return { success: false, message: 'Invalid API key' };
      return { success: false, message: `SendGrid returned ${res.status}` };
    }

    // Groq
    if (typeLower.includes('groq')) {
      const apiKey = data.apiKey || data.api_key;
      if (!apiKey) return { success: false, message: 'API key is required' };

      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (res.ok) return { success: true, message: 'Groq API key is valid' };
      if (res.status === 401) return { success: false, message: 'Invalid API key' };
      return { success: false, message: `Groq returned ${res.status}` };
    }

    // Google OAuth (test with existing tokens)
    if (typeLower.includes('google') && (typeLower.includes('oauth') || data.oauthTokenData)) {
      const accessToken = data.oauthTokenData?.access_token || data.access_token;
      if (!accessToken) return { success: false, message: 'No access token found' };

      const res = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + accessToken);

      if (res.ok) {
        const info = await res.json();
        return { success: true, message: `Connected to Google (${info.email || 'verified'})` };
      }
      if (res.status === 400) return { success: false, message: 'Access token expired or invalid' };
      return { success: false, message: `Google returned ${res.status}` };
    }

    // Pinecone
    if (typeLower.includes('pinecone')) {
      const apiKey = data.apiKey || data.api_key;
      if (!apiKey) return { success: false, message: 'API key is required' };

      // Pinecone requires environment, but we can at least validate key format
      if (apiKey.length < 20) return { success: false, message: 'API key appears too short' };
      return { success: true, message: 'API key format looks valid (full test requires environment)' };
    }

    // DeepL
    if (typeLower.includes('deepl')) {
      const apiKey = data.apiKey || data.api_key;
      if (!apiKey) return { success: false, message: 'API key is required' };

      // DeepL free vs pro have different endpoints
      const baseUrl = apiKey.endsWith(':fx')
        ? 'https://api-free.deepl.com'
        : 'https://api.deepl.com';

      const res = await fetch(`${baseUrl}/v2/usage`, {
        headers: { 'Authorization': `DeepL-Auth-Key ${apiKey}` },
      });

      if (res.ok) return { success: true, message: 'DeepL API key is valid' };
      if (res.status === 403) return { success: false, message: 'Invalid API key' };
      return { success: false, message: `DeepL returned ${res.status}` };
    }

    // HTTP Header Auth - can't really test without knowing the target API
    if (typeLower.includes('httpheader') || typeLower.includes('http_header')) {
      const headerName = data.headerName || data.name;
      const headerValue = data.headerValue || data.value;

      if (!headerValue) return { success: false, message: 'Header value is required' };
      return { success: true, message: 'Header auth configured (test when used in workflow)' };
    }

    // Default: can't test this type
    return {
      success: true,
      message: 'Credential saved (direct test not available for this type)',
      details: 'This credential type will be tested when used in a workflow'
    };

  } catch (error: any) {
    return {
      success: false,
      message: 'Test failed',
      details: error.message
    };
  }
}

/**
 * POST /api/client/credentials/test
 * Test a credential before or after saving
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Rate limit: 20 tests per minute per user
    const rateLimit = checkRateLimit(`credential-test:${user.id}`, 20, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many test requests. Please wait before trying again.', resetIn: Math.ceil(rateLimit.resetIn / 1000) },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { type, data } = body;

    if (!type) {
      return NextResponse.json({ error: 'Credential type is required' }, { status: 400 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Credential data is required' }, { status: 400 });
    }

    const result = await testCredential(type, data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/client/credentials/test:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
