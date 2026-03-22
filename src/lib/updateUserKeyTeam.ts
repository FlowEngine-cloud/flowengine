/**
 * Handle user subscription changes and team updates
 * Called from Stripe webhooks or subscription management
 */

import { supabaseAdmin as supabaseServiceRole } from '@/lib/supabaseAdmin';

export interface TeamChangeResult {
  success: boolean;
  message: string;
  oldTeamCode: string;
  newTeamCode: string;
  apiKey: string;
  error?: string;
}

/**
 * Update user's team based on new subscription status
 * This function should be called when:
 * - Stripe subscription changes (webhook)
 * - Manual subscription updates
 * - Trial to paid conversions
 */
export async function updateUserKeyTeam(
  userId: string,
  newSubscriptionStatus: string
): Promise<TeamChangeResult> {
  try {
    console.log(`🔄 Updating user ${userId} subscription to: ${newSubscriptionStatus}`);

    const { data, error } = await supabaseServiceRole.rpc('handle_user_team_change', {
      p_user_id: userId,
      p_new_subscription_status: newSubscriptionStatus,
    });

    if (error) {
      console.error('❌ Team change failed:', error.message);
      return {
        success: false,
        message: `Database error: ${error.message}`,
        oldTeamCode: '',
        newTeamCode: '',
        apiKey: '',
        error: error.message,
      };
    }

    const result = Array.isArray(data) ? data[0] : data;

    console.log('✅ Team change result:', {
      success: result.success,
      message: result.message,
      oldTeam: result.old_team_code,
      newTeam: result.new_team_code,
      hasApiKey: !!result.api_key,
    });

    return {
      success: result.success,
      message: result.message,
      oldTeamCode: result.old_team_code || '',
      newTeamCode: result.new_team_code || '',
      apiKey: result.api_key || '',
    };
  } catch (error) {
    console.error('❌ Team update failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      oldTeamCode: '',
      newTeamCode: '',
      apiKey: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user's current team information
 */
export async function getUserTeamInfo(userId: string) {
  try {
    const { data, error } = await supabaseServiceRole
      .from('api_keys')
      .select(
        `
        api_key,
        team_id,
        teams:team_id (
          code,
          name,
          max_budget,
          allowed_models
        )
      `
      )
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('❌ Failed to get user team info:', error.message);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      apiKey: data.api_key,
      teamId: data.team_id,
      teamCode: (data.teams as any)?.code,
      teamName: (data.teams as any)?.name,
      maxBudget: (data.teams as any)?.max_budget,
      allowedModels: (data.teams as any)?.allowed_models,
    };
  } catch (error) {
    console.error('❌ Get team info failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Map Stripe subscription status to internal team codes
 */
export function mapStripeStatusToTeamCode(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'pro';
    case 'pro_plus':
    case 'premium':
      return 'pro_plus';
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'past_due':
    case 'unpaid':
    default:
      return 'free';
  }
}

/**
 * Stripe webhook handler for subscription changes
 */
export async function handleStripeSubscriptionChange(
  userId: string,
  stripeEvent: any
): Promise<TeamChangeResult> {
  try {
    const subscription = stripeEvent.data.object;
    const newStatus = subscription.status;

    console.log(`🎯 Stripe webhook: ${stripeEvent.type}`, {
      userId,
      subscriptionId: subscription.id,
      status: newStatus,
      customerId: subscription.customer,
    });

    // Map Stripe status to internal team code
    const teamCode = mapStripeStatusToTeamCode(newStatus);

    // Update user's team
    return await updateUserKeyTeam(userId, teamCode);
  } catch (error) {
    console.error('❌ Stripe webhook processing failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Webhook processing failed',
      oldTeamCode: '',
      newTeamCode: '',
      apiKey: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
