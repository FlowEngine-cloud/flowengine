import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { rpc: vi.fn(), from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));

import {
  updateUserKeyTeam,
  mapStripeStatusToTeamCode,
  handleStripeSubscriptionChange,
} from '@/lib/updateUserKeyTeam';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── mapStripeStatusToTeamCode ────────────────────────────────────────────────

describe('mapStripeStatusToTeamCode', () => {
  it('maps active/trialing to pro', () => {
    expect(mapStripeStatusToTeamCode('active')).toBe('pro');
    expect(mapStripeStatusToTeamCode('trialing')).toBe('pro');
  });

  it('maps pro_plus/premium to pro_plus', () => {
    expect(mapStripeStatusToTeamCode('pro_plus')).toBe('pro_plus');
    expect(mapStripeStatusToTeamCode('premium')).toBe('pro_plus');
  });

  it('maps canceled/past_due/unpaid and others to free', () => {
    expect(mapStripeStatusToTeamCode('canceled')).toBe('free');
    expect(mapStripeStatusToTeamCode('past_due')).toBe('free');
    expect(mapStripeStatusToTeamCode('unpaid')).toBe('free');
    expect(mapStripeStatusToTeamCode('incomplete')).toBe('free');
    expect(mapStripeStatusToTeamCode('incomplete_expired')).toBe('free');
    expect(mapStripeStatusToTeamCode('unknown_status')).toBe('free');
  });
});

// ─── updateUserKeyTeam ────────────────────────────────────────────────────────

describe('updateUserKeyTeam', () => {
  it('returns success result from RPC on success', async () => {
    mockSupabaseAdmin.rpc.mockResolvedValue({
      data: [{
        success: true,
        message: 'Team updated',
        old_team_code: 'free',
        new_team_code: 'pro',
        api_key: 'fp_test123',
      }],
      error: null,
    });

    const result = await updateUserKeyTeam('user-123', 'pro');
    expect(result.success).toBe(true);
    expect(result.newTeamCode).toBe('pro');
    expect(result.oldTeamCode).toBe('free');
    expect(result.apiKey).toBe('fp_test123');
  });

  it('handles RPC returning single object (not array)', async () => {
    mockSupabaseAdmin.rpc.mockResolvedValue({
      data: {
        success: true,
        message: 'Done',
        old_team_code: 'pro',
        new_team_code: 'free',
        api_key: '',
      },
      error: null,
    });

    const result = await updateUserKeyTeam('user-123', 'free');
    expect(result.success).toBe(true);
    expect(result.newTeamCode).toBe('free');
  });

  it('returns failure when RPC returns error', async () => {
    mockSupabaseAdmin.rpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' },
    });

    const result = await updateUserKeyTeam('user-123', 'pro');
    expect(result.success).toBe(false);
    expect(result.error).toBe('RPC failed');
    expect(result.newTeamCode).toBe('');
  });

  it('returns failure when an exception is thrown', async () => {
    mockSupabaseAdmin.rpc.mockRejectedValue(new Error('Network error'));

    const result = await updateUserKeyTeam('user-123', 'pro');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Network error');
  });
});

// ─── handleStripeSubscriptionChange ──────────────────────────────────────────

describe('handleStripeSubscriptionChange', () => {
  it('maps stripe status and calls updateUserKeyTeam', async () => {
    mockSupabaseAdmin.rpc.mockResolvedValue({
      data: [{ success: true, message: 'Done', old_team_code: 'free', new_team_code: 'pro', api_key: 'fp_x' }],
      error: null,
    });

    const event = {
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_123', status: 'active', customer: 'cus_123' } },
    };

    const result = await handleStripeSubscriptionChange('user-123', event);
    expect(result.success).toBe(true);
    expect(result.newTeamCode).toBe('pro');
  });

  it('returns failure when exception is thrown during processing', async () => {
    const badEvent = null; // will throw

    const result = await handleStripeSubscriptionChange('user-123', badEvent);
    expect(result.success).toBe(false);
  });
});
