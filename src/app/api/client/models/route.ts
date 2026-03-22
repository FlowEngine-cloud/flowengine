/**
 * Client Models API
 * Fetches available AI models from the configured OpenAI-compatible provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPortalSettings } from '@/lib/portalSettings';


export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get portal settings for AI provider configuration
    const settings = await getPortalSettings();
    const { ai_base_url, ai_api_key } = settings;

    if (!ai_api_key) {
      return NextResponse.json({
        error: 'AI provider not configured',
        message: 'Please configure your AI provider in Settings → AI Provider',
      }, { status: 403 });
    }

    const baseUrl = (ai_base_url || 'https://openrouter.ai/api').replace(/\/$/, '');

    // Fetch models from the configured OpenAI-compatible provider
    const modelsResponse = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ai_api_key}`,
      },
    });

    if (!modelsResponse.ok) {
      const errorData = await modelsResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: 'Failed to fetch models',
          message: errorData.error || 'Could not retrieve models from AI provider',
        },
        { status: modelsResponse.status }
      );
    }

    const data = await modelsResponse.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('[API:CLIENT:MODELS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
