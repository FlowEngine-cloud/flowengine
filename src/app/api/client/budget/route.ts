/**
 * GET /api/client/budget
 * Returns AI token budget for a specific client.
 *
 * Query params:
 *   clientUserId - (optional) view budget for this client instead of self
 *
 * Response shape (matches what the client detail page expects):
 *   { success: true, budget: { tokensRemaining, tokensUsed }, feConnected: boolean }
 *
 * When the portal has a FlowEngine API key configured the budget is fetched
 * from FlowEngine.  Otherwise feConnected=false and zeros are returned so
 * the AI tokens tab can show a "connect FlowEngine" gate instead of fake data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPortalSettings } from '@/lib/portalSettings';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientUserId = searchParams.get('clientUserId') || user.id;

    // Check if FlowEngine is configured
    const portalSettings = await getPortalSettings().catch(() => null);
    const feApiKey = portalSettings?.flowengine_api_key as string | undefined;

    if (feApiKey) {
      try {
        const feRes = await fetch(`https://flowengine.cloud/api/v1/user?userId=${clientUserId}`, {
          headers: { Authorization: `Bearer ${feApiKey}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        if (feRes.ok) {
          const feData = await feRes.json();
          if (feData.success) {
            return NextResponse.json({
              success: true,
              budget: {
                tokensRemaining: feData.credits_remaining ?? 0,
                tokensUsed: feData.credits_used ?? 0,
              },
              feConnected: true,
            });
          }
        }
      } catch {
        // fall through — FlowEngine unreachable, return not-connected state
      }
    }

    // FlowEngine not configured or unreachable — return gate signal
    return NextResponse.json({
      success: true,
      budget: { tokensRemaining: 0, tokensUsed: 0 },
      feConnected: false,
    });
  } catch (error) {
    console.error('[API:CLIENT:BUDGET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
