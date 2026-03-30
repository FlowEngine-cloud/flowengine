import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { randomUUID } from 'crypto';
import { emailService } from '@/lib/emailService';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * ⚠️ CRITICAL: MULTI-SUBSCRIPTION PROFILE SAFETY
 *
 * The profiles table has ONLY ONE set of subscription fields:
 * - subscription_id
 * - subscription_status
 * - stripe_subscription_id
 * - stripe_price_id
 *
 * However, users can have MULTIPLE Stripe subscriptions simultaneously:
 * 1. BYON Portal Subscriptions (agency paying for client portal access)
 * 2. Pay-per-instance Subscriptions (separate n8n instances)
 * 3. Daily Backup Add-ons (for existing instances)
 *
 * CRITICAL RULE: NEVER UPDATE PROFILE SUBSCRIPTION FIELDS UNLESS:
 *
 * SAFE to update profile subscription fields:
 * - Client-paid BYON (client is paying, updates their profile)
 *
 * NEVER update profile subscription fields for:
 * - Agency-paid BYON (would overwrite agency's existing subscription)
 * - Pay-per-instance subscriptions (use pay_per_instance_deployments table)
 * - Daily backup add-ons (use backup_interval_days field in instance tables)
 *
 * IMPLEMENTATION PATTERN:
 * 1. Detect subscription type via metadata.flow_type or metadata.addon_type
 * 2. Handle special cases FIRST with early returns
 * 3. Only update profile subscription fields for client-paid BYON
 * 4. Document WHY you're updating (or not updating) profile fields
 *
 * EXAMPLE - Agency-paid BYON:
 * - Agency buys BYON subscription for client
 * - Webhook receives event with metadata.flow_type = 'agency_byon'
 * - Create invite for client
 * - Track subscription in Stripe
 * - DON'T update agency's profile
 *
 * EXAMPLE - Client-paid BYON:
 * - Client receives invite, pays for their own BYON subscription
 * - Webhook receives event with metadata.flow_type = 'client_byon'
 * - Update CLIENT's profile (gives them portal access)
 * - Mark invite as accepted
 *
 * If you need to add new subscription types, ask yourself:
 * "Will this overwrite an existing subscription in the profile?"
 * If yes, use a separate table or metadata field instead.
 */

// Local interfaces for TypeScript compliance
interface UserLookupResult {
  user_id?: string;
}

function getStripeWebhook() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
}

// supabaseAdmin imported from @/lib/supabaseAdmin

// Webhook event processing state tracker
interface WebhookProcessingResult {
  success: boolean;
  correlationId: string;
  processingTimeMs: number;
  processedAt: number; // Date.now() when the event was processed
  error?: string;
}

// Webhook metrics for monitoring
interface WebhookMetrics {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  avgProcessingTimeMs: number;
  lastProcessedAt: Date;
  eventTypeCounts: Record<string, number>;
  errorTypes: Record<string, number>;
}

// Global metrics tracking (in production, use Redis or external metrics service)
const webhookMetrics: WebhookMetrics = {
  totalProcessed: 0,
  successCount: 0,
  errorCount: 0,
  avgProcessingTimeMs: 0,
  lastProcessedAt: new Date(),
  eventTypeCounts: {},
  errorTypes: {},
};

// Dead Letter Queue for failed webhook events (in production, use SQS, Redis, or DB)
interface FailedWebhookEvent {
  eventId: string;
  eventType: string;
  correlationId: string;
  failureReason: string;
  failureCount: number;
  firstFailedAt: Date;
  lastFailedAt: Date;
  eventData: any;
}

const deadLetterQueue: Map<string, FailedWebhookEvent> = new Map();

// Expose metrics globally for monitoring endpoint
globalThis.webhookMetrics = webhookMetrics;
globalThis.deadLetterQueue = deadLetterQueue;

// Add event to dead letter queue
function addToDeadLetterQueue(
  event: Stripe.Event,
  correlationId: string,
  error: string,
  isRetry: boolean = false
) {
  const existingEntry = deadLetterQueue.get(event.id);

  if (existingEntry && !isRetry) {
    existingEntry.failureCount++;
    existingEntry.lastFailedAt = new Date();
    existingEntry.failureReason = error;
  } else if (!existingEntry) {
    deadLetterQueue.set(event.id, {
      eventId: event.id,
      eventType: event.type,
      correlationId,
      failureReason: error,
      failureCount: 1,
      firstFailedAt: new Date(),
      lastFailedAt: new Date(),
      eventData: {
        type: event.type,
        created: event.created,
        data: event.data.object,
      },
    });
  }

  // Log critical failures for immediate attention
  if (existingEntry && existingEntry.failureCount >= 3) {
    console.error('🚨 CRITICAL: Webhook event failed 3+ times', {
      eventId: event.id,
      eventType: event.type,
      failureCount: existingEntry.failureCount,
      correlationId,
    });
  }
}

// Utility to update webhook metrics
function updateWebhookMetrics(
  eventType: string,
  processingTimeMs: number,
  success: boolean,
  error?: string
) {
  webhookMetrics.totalProcessed++;
  webhookMetrics.lastProcessedAt = new Date();

  // Update event type counts
  webhookMetrics.eventTypeCounts[eventType] = (webhookMetrics.eventTypeCounts[eventType] || 0) + 1;

  if (success) {
    webhookMetrics.successCount++;
  } else {
    webhookMetrics.errorCount++;

    // Track error types
    const errorType = error?.includes('timeout')
      ? 'timeout'
      : error?.includes('not found')
        ? 'not_found'
        : error?.includes('invalid')
          ? 'invalid_data'
          : 'database_error';
    webhookMetrics.errorTypes[errorType] = (webhookMetrics.errorTypes[errorType] || 0) + 1;
  }

  // Update average processing time
  const totalTime =
    webhookMetrics.avgProcessingTimeMs * (webhookMetrics.totalProcessed - 1) + processingTimeMs;
  webhookMetrics.avgProcessingTimeMs = Math.round(totalTime / webhookMetrics.totalProcessed);

  // Log metrics periodically for monitoring
  if (webhookMetrics.totalProcessed % 10 === 0) {
    console.log('📊 Webhook Metrics Update', {
      totalProcessed: webhookMetrics.totalProcessed,
      successRate:
        ((webhookMetrics.successCount / webhookMetrics.totalProcessed) * 100).toFixed(2) + '%',
      avgProcessingTimeMs: webhookMetrics.avgProcessingTimeMs,
      topEventTypes: Object.entries(webhookMetrics.eventTypeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      errorTypes: webhookMetrics.errorTypes,
    });
  }
}

// In-memory webhook idempotency cache (Stripe retries are rare; process restarts clear it, which is fine —
// Stripe's own retry logic + our idempotent provision routes handle duplicates safely)
const webhookProcessingCache = new Map<string, WebhookProcessingResult>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const correlationId = randomUUID();

  // Enhanced logging with correlation ID
  const log = {
    info: (message: string, meta?: any) => console.log(`[${correlationId}] ${message}`, meta || ''),
    error: (message: string, meta?: any) =>
      console.error(`[${correlationId}] ❌ ${message}`, meta || ''),
    warn: (message: string, meta?: any) =>
      console.warn(`[${correlationId}] ⚠️ ${message}`, meta || ''),
    debug: (message: string, meta?: any) =>
      console.debug(`[${correlationId}] 🔍 ${message}`, meta || ''),
  };

  log.info('🎯 Webhook request received');
  log.debug('Request details', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  // Security: Check for replay attacks (events older than 5 minutes are suspicious)
  const timestampHeader = req.headers.get('stripe-signature')?.match(/t=(\d+)/)?.[1];
  if (timestampHeader) {
    const webhookTimestamp = parseInt(timestampHeader);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timestampDifference = currentTimestamp - webhookTimestamp;

    // Reject webhooks older than 5 minutes (300 seconds)
    if (timestampDifference > 300) {
      log.error('Webhook replay attack detected - timestamp too old', {
        webhookTimestamp,
        currentTimestamp,
        differenceSeconds: timestampDifference,
      });
      return NextResponse.json(
        {
          error: 'Webhook timestamp too old',
          correlationId,
        },
        { status: 400 }
      );
    }

    // Reject webhooks from the future (clock skew tolerance: 5 minutes)
    if (timestampDifference < -300) {
      log.error('Webhook timestamp from future detected', {
        webhookTimestamp,
        currentTimestamp,
        differenceSeconds: timestampDifference,
      });
      return NextResponse.json(
        {
          error: 'Webhook timestamp from future',
          correlationId,
        },
        { status: 400 }
      );
    }
  }

  // Critical: Stripe webhook signature verification
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    log.error('Missing Stripe signature header');
    return NextResponse.json(
      {
        error: 'Missing signature',
        correlationId,
      },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    log.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
    return NextResponse.json(
      {
        error: 'Webhook not configured',
        correlationId,
      },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify the webhook signature to ensure it's genuinely from Stripe
    event = getStripeWebhook().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    log.error('Stripe webhook signature verification failed', { error: err.message });
    return NextResponse.json(
      {
        error: 'Webhook signature verification failed',
        details: err.message,
        correlationId,
      },
      { status: 400 }
    );
  }

  // Idempotency check: prevent duplicate processing
  const eventKey = `${event.id}-${event.type}`;
  const cachedResult = webhookProcessingCache.get(eventKey);

  if (cachedResult) {
    log.info(`🔄 Duplicate webhook detected, returning cached result`, {
      eventId: event.id,
      eventType: event.type,
      cachedProcessingTime: cachedResult.processingTimeMs,
    });
    return NextResponse.json({
      received: true,
      cached: true,
      correlationId: cachedResult.correlationId,
    });
  }

  log.info('✅ Verified Stripe webhook', {
    eventType: event.type,
    eventId: event.id,
    created: new Date(event.created * 1000).toISOString(),
  });

  // Clean up old cache entries periodically
  if (Math.random() < 0.01) {
    cleanupWebhookCache();
  }

  let processingResult: WebhookProcessingResult;

  try {
    // Process the webhook event with timeout protection
    await Promise.race([
      processWebhookEvent(event, log, correlationId),
      new Promise(
        (_, reject) => setTimeout(() => reject(new Error('Webhook processing timeout')), 25000) // 25s timeout
      ),
    ]);

    const processingTime = Date.now() - startTime;
    processingResult = {
      success: true,
      correlationId,
      processingTimeMs: processingTime,
      processedAt: Date.now(),
    };

    // Update metrics
    updateWebhookMetrics(event.type, processingTime, true);

    // Cache successful result for idempotency
    webhookProcessingCache.set(eventKey, processingResult);

    log.info('✅ Webhook processed successfully', {
      eventType: event.type,
      processingTimeMs: processingTime,
    });

    return NextResponse.json({
      received: true,
      correlationId,
      processingTimeMs: processingTime,
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    processingResult = {
      success: false,
      correlationId,
      processingTimeMs: processingTime,
      processedAt: Date.now(),
      error: error.message,
    };

    // Update metrics for failed processing
    updateWebhookMetrics(event.type, processingTime, false, error.message);

    log.error('💥 Webhook handler error', {
      error: error.message,
      stack: error.stack,
      eventType: event.type,
      eventId: event.id,
      processingTimeMs: processingTime,
    });

    // Don't cache failures to allow retries

    // Add to dead letter queue for non-retryable errors or after multiple failures
    const isRetryable = !error.message.includes('not found') && !error.message.includes('invalid');

    if (!isRetryable) {
      addToDeadLetterQueue(event, correlationId, error.message);
    }

    // Return appropriate HTTP status based on error type
    if (error.message.includes('timeout')) {
      return NextResponse.json(
        {
          error: 'Processing timeout',
          correlationId,
          retryable: true,
        },
        { status: 408 }
      ); // Request Timeout
    }

    if (error.message.includes('not found') || error.message.includes('invalid')) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          correlationId,
          retryable: false,
        },
        { status: 400 }
      ); // Bad Request - don't retry
    }

    // Default to 500 for retryable errors
    return NextResponse.json(
      {
        error: 'Webhook handler failed',
        correlationId,
        retryable: true,
      },
      { status: 500 }
    );
  }
}

// Separate function for webhook event processing
async function processWebhookEvent(event: Stripe.Event, log: any, correlationId: string) {
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session, log);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription, log);
      break;

    case 'customer.subscription.deleted':
      const deletedSub = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(deletedSub, log);
      break;

    case 'subscription_schedule.completed': {
      // Fires when a scheduled subscription change is executed (e.g., downgrade at period end)
      const schedule = event.data.object as Stripe.SubscriptionSchedule;
      await handleSubscriptionScheduleCompleted(schedule, log);
      break;
    }

    case 'subscription_schedule.canceled': {
      // Fires when a scheduled subscription change is canceled
      const schedule = event.data.object as Stripe.SubscriptionSchedule;
      await handleSubscriptionScheduleCanceled(schedule, log);
      break;
    }

    case 'subscription_schedule.updated': {
      // Fires when a scheduled subscription change is modified
      const schedule = event.data.object as Stripe.SubscriptionSchedule;
      log.info(`📅 Subscription schedule updated: ${schedule.id}, status: ${schedule.status}`);
      // No action needed - the actual change will be handled when schedule completes
      break;
    }

    default:
      log.info(`Unhandled event type: ${event.type}`);
  }
}

// Cleanup function for webhook cache
function cleanupWebhookCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, result] of webhookProcessingCache.entries()) {
    if (now - result.processedAt > CACHE_TTL_MS) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => webhookProcessingCache.delete(key));

  if (keysToDelete.length > 0) {
    console.log(`🧹 Cleaned up ${keysToDelete.length} expired webhook cache entries`);
  }
}

// Check if a price ID is for an instance add-on (NOT a membership)
function isInstancePrice(priceId?: string | null): boolean {
  if (!priceId) return false;

  const instancePrices = [
    process.env.NEXT_PUBLIC_STRIPE_10GB_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_10GB_ANNUAL_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_30GB_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_30GB_ANNUAL_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_50GB_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_50GB_ANNUAL_PRICE_ID,
  ];

  return instancePrices.includes(priceId);
}

// Check if a price ID is for a daily backup addon (NOT a membership)
function isDailyBackupPrice(priceId?: string | null): boolean {
  if (!priceId) return false;
  return priceId === process.env.STRIPE_DAILY_BACKUP_PRICE_ID;
}

// Check if a price ID is for a WhatsApp API subscription (NOT a membership)
function isWhatsAppPrice(priceId?: string | null): boolean {
  if (!priceId) return false;
  return priceId === process.env.STRIPE_PRICE_WHATSAPP_MONTHLY
    || priceId === process.env.STRIPE_PRICE_WHATSAPP_ANNUAL;
}


// Exponential backoff retry utility
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  log?: any
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      // Don't retry on non-retryable errors
      if (
        error.message?.includes('not found') ||
        error.message?.includes('invalid') ||
        error.code === 'PGRST301'
      ) {
        // Supabase user not found
        throw error;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
      log?.warn(`Retry attempt ${attempt + 1}/${maxRetries + 1} after ${delayMs}ms delay`, {
        error: error.message,
        attempt: attempt + 1,
      });

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
}


async function handleCheckoutCompleted(session: Stripe.Checkout.Session, log: any) {
  const metadata = session.metadata;
  if (!metadata && !session.client_reference_id) {
    log.error('Missing metadata and client_reference_id in session', { sessionId: session.id });
    return;
  }

  log.info('Processing completed checkout', {
    sessionId: session.id,
    clientReferenceId: session.client_reference_id,
    metadata: metadata,
    amountTotal: session.amount_total,
    currency: session.currency,
  });

  // Handle daily backup addon checkout
  // IMPORTANT: This is checked FIRST and returns early - no membership changes will occur
  const isDailyBackupAddon = metadata?.addon_type === 'daily_backup';
  if (isDailyBackupAddon) {
    const instanceId = metadata?.instance_id;
    const userId = metadata?.supabase_user_id;
    // Note: subscription will exist even with 100% coupon (Stripe still creates the subscription)
    const subscriptionId = session.subscription as string | null;

    log.info(`🔄 Daily backup addon checkout detected`, {
      instanceId,
      userId,
      subscriptionId,
      sessionId: session.id,
      amountTotal: session.amount_total, // Log amount to verify coupon handling
      is100PercentCoupon: session.amount_total === 0,
    });

    if (!instanceId || !userId) {
      log.error('❌ Missing required metadata for daily backup addon:', { instanceId, userId });
      return;
    }

    try {
      // Update instance to daily backups - try BOTH tables since we don't know which one has the instance
      // The backup_interval_days: 1 is the key change - subscription_id can be null for 100% coupons
      const { error: n8nError, count: n8nCount } = await supabaseAdmin
        .from('n8n_instances')
        .update({
          backup_interval_days: 1,
          daily_backup_subscription_id: subscriptionId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', instanceId)
        .eq('user_id', userId);

      const { error: ppiError, count: ppiCount } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .update({
          backup_interval_days: 1,
          daily_backup_subscription_id: subscriptionId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', instanceId)
        .eq('user_id', userId);

      // At least one should succeed without error
      if (n8nError && ppiError) {
        log.error('❌ Failed to update backup interval in both tables:', { n8nError, ppiError });
        throw new Error('Failed to update backup interval');
      }

      log.info(`✅ Daily backup addon activated for instance ${instanceId}`, {
        n8nUpdated: !n8nError,
        ppiUpdated: !ppiError,
        backupIntervalDays: 1, // Explicit confirmation of the change
        subscriptionId: subscriptionId || 'none (100% coupon)',
      });

      // Update subscription metadata for future webhook handling
      if (subscriptionId) {
        try {
          await getStripeWebhook().subscriptions.update(subscriptionId, {
            metadata: {
              addon_type: 'daily_backup',
              instance_id: instanceId,
              supabase_user_id: userId,
            },
          });
          log.info(`✅ Updated subscription ${subscriptionId} with daily_backup metadata`);
        } catch (metaError: any) {
          log.warn(`⚠️ Failed to update subscription metadata:`, metaError.message);
        }
      }
    } catch (error: any) {
      log.error('❌ Daily backup addon activation failed:', error);
      throw error;
    }

    return; // Exit early - daily backup addon handled
  }

  // CRITICAL: Check if this is a BYON (Bring Your Own n8n) checkout
  // These only need subscription tracking and invite handling - NO instance provisioning
  const isBYON = metadata?.flow_type === 'agency_byon' || metadata?.flow_type === 'client_byon';
  if (isBYON) {
    const isAgencyPaid = metadata?.flow_type === 'agency_byon';
    const isClientPaid = metadata?.flow_type === 'client_byon';
    const subscriptionId = session.subscription as string | null;
    const userId = metadata?.user_id || session.client_reference_id;

    log.info(`🎯 BYON checkout completed (${metadata?.flow_type}) - portal access only, no deployment`, {
      sessionId: session.id,
      userId,
      subscriptionId,
      clientEmail: metadata?.client_email,
      inviteId: metadata?.invite_id,
      invitedBy: metadata?.invited_by,
    });

    if (!userId) {
      log.error('❌ Missing user_id for BYON checkout');
      return;
    }

    // CRITICAL: Only update profile for CLIENT-PAID BYON
    // For agency-paid, the AGENCY is paying but CLIENT gets access via invite
    // Don't overwrite agency's existing subscription!
    if (isClientPaid) {
      if (!subscriptionId) {
        log.error('❌ Missing subscription ID for client-paid BYON');
        return;
      }

      // Update CLIENT's subscription status for portal access
      try {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_id: subscriptionId,
            subscription_status: 'active',
            stripe_subscription_id: subscriptionId,
            stripe_price_id: metadata?.price_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          log.error('❌ Failed to update BYON subscription status:', updateError);
          throw updateError;
        } else {
          log.info(`✅ Client-paid BYON subscription activated for user ${userId} - portal access enabled`);
        }
      } catch (error: any) {
        log.error('❌ BYON subscription update error:', error);
        throw error;
      }
    } else if (isAgencyPaid) {
      // Agency-paid: DON'T update agency's profile
      // Agency already has an existing subscription - we can't overwrite it
      // The BYON subscription just exists in Stripe for billing
      log.info(`✅ Agency-paid BYON subscription created - agency profile unchanged`);
    }

    // Agency-paid BYON: Create invite and send email to client
    if (isAgencyPaid) {
      const clientEmail = metadata?.client_email;
      const agencyName = metadata?.agency_name || 'Your service provider';

      if (!clientEmail) {
        log.error('❌ Missing client_email for agency-paid BYON');
        return;
      }

      try {
        // Create the invite
        const inviteToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiration

        const { data: newInvite, error: inviteError } = await supabaseAdmin
          .from('client_invites')
          .insert({
            email: clientEmail.toLowerCase(),
            token: inviteToken,
            invited_by: userId,
            storage_size_gb: 0, // BYON = 0 storage
            is_external: true, // BYON flag
            allow_full_access: false, // Agency-paid = no full access
            status: 'pending',
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (inviteError) {
          log.error('❌ Failed to create BYON invite:', inviteError);
          throw inviteError;
        }

        log.info(`✅ Created BYON invite for ${clientEmail} (ID: ${newInvite.id})`);

        // Send invitation email via emailService
        const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/accept?token=${inviteToken}`;

        try {
          // For agency-paid BYON, use sendClientAccessGrant since agency already paid
          // Client just needs to accept the invite without payment
          await emailService.sendClientAccessGrant(clientEmail, agencyName, inviteUrl);
          log.info(`✅ Sent BYON invite email to ${clientEmail}`);
        } catch (emailError: any) {
          log.error('❌ Error sending BYON invite email:', emailError);
          // Don't throw - invite is created, email is secondary
        }
      } catch (error: any) {
        log.error('❌ Agency BYON invite creation failed:', error);
        throw error;
      }
    }

    // Client-paid BYON: Mark existing invite as accepted
    if (isClientPaid && metadata?.invite_id) {
      try {
        const { error: inviteError } = await supabaseAdmin
          .from('client_invites')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            accepted_by: userId,
          })
          .eq('id', metadata.invite_id)
          .eq('status', 'pending');

        if (inviteError) {
          log.error('❌ Failed to mark BYON invite as accepted:', inviteError);
        } else {
          log.info(`✅ Marked BYON invite ${metadata.invite_id} as accepted`);
        }
      } catch (error: any) {
        log.error('❌ BYON invite update error:', error);
      }
    }

    // Update subscription metadata for future webhook handling
    if (subscriptionId) {
      try {
        await getStripeWebhook().subscriptions.update(subscriptionId, {
          metadata: {
            flow_type: metadata?.flow_type || '',
            user_id: userId,
            client_email: metadata?.client_email || null,
            invite_id: metadata?.invite_id || null,
            invited_by: metadata?.invited_by || null,
            billing_cycle: metadata?.billing_cycle || null,
            allow_full_access: metadata?.allow_full_access || null,
          },
        });
        log.info(`✅ Updated subscription ${subscriptionId} with BYON metadata`);
      } catch (metaError: any) {
        log.warn(`⚠️ Failed to update subscription metadata:`, metaError.message);
      }
    }

    return; // Exit early - BYON handled, no instance provisioning
  }

  // Check if this is a WhatsApp API checkout
  const isWhatsAppCheckout = metadata?.plan_type === 'whatsapp';

  if (isWhatsAppCheckout) {
    log.info(`📱 WhatsApp API checkout detected (session: ${session.id})`);

    const subscriptionId = session.subscription as string;
    const userId = metadata.user_id || session.client_reference_id;
    const billingCycle = metadata?.billing_cycle || 'monthly';
    const displayName = metadata?.display_name || null;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (!userId) {
      log.error('Missing user_id for WhatsApp checkout');
      throw new Error('Missing user_id for WhatsApp checkout');
    }

    try {
      // Generate unique instance name
      const shortId = Math.random().toString(36).substring(2, 8);
      const instanceName = `wa-${shortId}`;

      // Get active WhatsApp server
      const { data: server, error: serverErr } = await supabaseAdmin
        .from('whatsapp_servers')
        .select('id, evolution_api_url, evolution_api_admin_key, whatsapp_session_count, max_whatsapp_sessions, server_ip')
        .eq('is_accepting_new_sessions', true)
        .is('deleted_at', null)
        .order('whatsapp_session_count', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (serverErr || !server || !server.evolution_api_url || !server.evolution_api_admin_key) {
        log.error('No deployment server configured for WhatsApp');
        throw new Error('No deployment server configured for WhatsApp');
      }

      // Create Evolution API session
      const { createSession, setWebhook } = await import('@/lib/evolutionApi');
      const config = { baseUrl: server.evolution_api_url, apiKey: server.evolution_api_admin_key };
      const evoResult = await createSession(config, instanceName, {
        webhookEvents: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'QRCODE_UPDATED'],
      });

      if (!evoResult.ok || !evoResult.data) {
        log.error('Failed to create Evolution API session:', evoResult.error);
        throw new Error(`Evolution API session creation failed: ${evoResult.error}`);
      }

      // Set webhook URL with secret (first 16 chars of session hash) for validation
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
      const webhookSecret = evoResult.data.hash.substring(0, 16);
      const webhookUrl = `${appUrl}/api/whatsapp/webhook-receiver?instance=${encodeURIComponent(instanceName)}&secret=${encodeURIComponent(webhookSecret)}`;
      await setWebhook(config, instanceName, webhookUrl, ['CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'QRCODE_UPDATED']);

      // Insert whatsapp_instances row
      const { error: insertErr } = await supabaseAdmin
        .from('whatsapp_instances')
        .insert({
          team_id: userId,
          user_id: userId,
          instance_name: instanceName,
          display_name: displayName,
          session_token: evoResult.data.hash,
          server_url: server.evolution_api_url,
          deployment_server_id: server.id,
          server_ip: server.server_ip,
          stripe_subscription_id: subscriptionId || null,
          stripe_customer_id: customerId || null,
          billing_cycle: billingCycle,
          status: 'pending_scan',
        });

      if (insertErr) {
        log.error('Failed to insert WhatsApp instance:', insertErr);
        throw new Error(`Failed to insert WhatsApp instance: ${insertErr.message}`);
      }

      // Increment server count
      await supabaseAdmin.rpc('increment_whatsapp_session_count', { p_server_id: server.id });

      // Update subscription metadata
      if (subscriptionId) {
        try {
          await getStripeWebhook().subscriptions.update(subscriptionId, {
            metadata: {
              plan_type: 'whatsapp',
              instance_name: instanceName,
              user_id: userId,
              supabase_user_id: userId,
            },
          });
        } catch (metaError: any) {
          log.error('Failed to update subscription metadata:', metaError.message);
        }
      }

      log.info(`WhatsApp instance created: ${instanceName} for user ${userId}`);
    } catch (error: any) {
      log.error('WhatsApp provisioning failed:', error);
      throw error;
    }

    return; // Exit early
  }

  // CRITICAL: Check if this is an instance add-on (NOT a membership!)
  const isInstanceFromMetadata = metadata?.plan_type === 'pay_per_instance';

  if (isInstanceFromMetadata) {
    log.info(`🚀 Instance add-on checkout detected (session: ${session.id}) - provisioning pay-per-instance`);

    const instanceName = metadata?.instance_name;
    const storageLimit = parseInt(metadata?.storage_limit || '10');
    const subscriptionId = session.subscription as string;
    const userId = metadata.user_id || session.client_reference_id;
    const billingCycle = metadata?.billing_cycle || 'monthly'; // ✅ Get from metadata (works for $0 checkouts)
    const priceId = metadata?.price_id; // ✅ Get from metadata
    const invitedByUserId = metadata?.client_invited_by; // Agency who invited client (if from client-paid invite)

    log.info(`🔍 Pay-per-instance checkout data:`, {
      instanceName,
      storageLimit,
      subscriptionId,
      userId,
      billingCycle,
      priceId,
      invitedByUserId,
      sessionId: session.id,
      amountTotal: session.amount_total,
    });

    if (!instanceName || !storageLimit || !userId) {
      log.error('❌ Missing required metadata for instance add-on:', { instanceName, storageLimit, userId });
      throw new Error('Missing required metadata for instance add-on: instanceName, storageLimit, or userId');
    }

    // Provision the instance via the instance provisioning endpoint
    // ✅ Works even if subscriptionId is null (for $0 checkouts)
    // Subscription ID will be updated later when customer.subscription.created fires
    try {
      const provisionResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/n8n/provision-instance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          userId,
          storageLimit,
          instanceName,
          billingCycle,
          stripeSubscriptionId: subscriptionId || null, // ✅ OK if null for $0 checkouts
          stripePriceId: priceId,
          invitedByUserId: invitedByUserId || null, // Agency who invited client (if from client-paid invite)
          skipProvisioning: true, // Create pending_deploy record; user chooses when to deploy
        }),
      });

      if (!provisionResponse.ok) {
        const errorData = await provisionResponse.json();
        throw new Error(`Provisioning failed: ${errorData.error || 'Unknown error'}`);
      }

      const provisionData = await provisionResponse.json();
      log.info(`✅ Instance add-on pending_deploy record created: ${instanceName} (${storageLimit}GB, ${billingCycle})`);
      log.info(`✅ User membership unchanged - instance is an add-on`);

      // Mark client invite as accepted if this was from an invite
      const clientInviteId = metadata?.client_invite_id;
      const clientInvitedBy = metadata?.client_invited_by;

      if (clientInviteId) {
        try {
          // CRITICAL: Mark invite as accepted with proper error handling
          const { data: updatedInvite, error: inviteUpdateError } = await supabaseAdmin
            .from('client_invites')
            .update({
              status: 'accepted',
              accepted_by: userId,
            })
            .eq('id', clientInviteId)
            .eq('status', 'pending')
            .select()
            .maybeSingle();

          if (inviteUpdateError) {
            log.error('⚠️ Failed to mark invite as accepted (DB error):', inviteUpdateError.message);
          } else if (!updatedInvite) {
            // No rows updated - invite might not be pending anymore
            log.error(`⚠️ Failed to mark invite ${clientInviteId} as accepted - invite not found or not pending`);

            // Check current invite status
            const { data: currentInvite } = await supabaseAdmin
              .from('client_invites')
              .select('status')
              .eq('id', clientInviteId)
              .maybeSingle();

            log.error(`⚠️ Current invite status: ${currentInvite?.status || 'NOT FOUND'}`);
          } else {
            log.info(`✅ Marked client invite ${clientInviteId} as accepted`);
          }

          // CRITICAL FIX: Create client_instances record for backwards compatibility
          // This allows the agency to see the client in their dashboard
          if (provisionData.instance?.id) {
            // Get invited_by from metadata or fetch from invite
            const invitedBy = clientInvitedBy || (await supabaseAdmin
              .from('client_invites')
              .select('invited_by, allow_full_access')
              .eq('id', clientInviteId)
              .maybeSingle()
            ).data?.invited_by;

            const allowFullAccess = (await supabaseAdmin
              .from('client_invites')
              .select('allow_full_access')
              .eq('id', clientInviteId)
              .maybeSingle()
            ).data?.allow_full_access ?? true; // Default to true for client-paid instances

            if (invitedBy) {
              const { error: clientInstanceError } = await supabaseAdmin
                .from('client_instances')
                .upsert(
                  {
                    team_id: invitedBy,
                    client_id: userId,
                    instance_id: provisionData.instance.id,
                    user_id: userId,
                    invited_by: invitedBy,
                    assigned_by: invitedBy,
                    access_level: allowFullAccess ? 'edit' : 'view',
                  },
                  { onConflict: 'instance_id', ignoreDuplicates: false }
                );

              if (clientInstanceError) {
                log.error('⚠️ Failed to create client_instances record:', clientInstanceError.message);
              } else {
                log.info(`✅ Created client_instances record for user ${userId}, instance ${provisionData.instance.id}`);
              }
            } else {
              log.error('⚠️ Could not find invited_by for invite:', clientInviteId);
            }
          }
        } catch (inviteError: any) {
          log.error('⚠️ Error updating invite status:', inviteError.message);
        }
      }

      // CRITICAL: Update subscription metadata so future webhooks recognize this as instance
      if (subscriptionId) {
        try {
          await getStripeWebhook().subscriptions.update(subscriptionId, {
            metadata: {
              plan_type: 'pay_per_instance',
              instance_name: instanceName,
              storage_limit: storageLimit.toString(),
              user_id: userId,
              supabase_user_id: userId,
            },
          });
          log.info(`✅ Updated subscription ${subscriptionId} with pay_per_instance metadata`);
        } catch (metaError: any) {
          log.error(`⚠️ Failed to update subscription metadata (non-critical):`, metaError.message);
        }
      }
    } catch (error: any) {
      log.error('❌ Instance provisioning failed:', error);
      throw error;
    }

    return; // Exit early - NEVER process instance add-ons as memberships!
  }

  // Handle subscriptions: activate immediately even if first invoice is $0
  if (metadata?.type === 'subscription') {
    const userId = metadata.user_id || session.client_reference_id;

    log.info(`🎯 Processing subscription checkout for user ${userId}`);

    // Fetch subscription if attached (may be missing for $0 invoice at this instant)
    const subscriptionResponse = session.subscription
      ? await getStripeWebhook().subscriptions.retrieve(session.subscription as string)
      : undefined;
    const subscription = subscriptionResponse as unknown as Stripe.Subscription | undefined;

    if (!userId) {
      log.error('Missing user id for subscription activation');
      return;
    }

    // Update profile subscription fields
    try {
      const { data: updateResult, error: updateError } = await retryWithBackoff(
        async () => {
          const response = await supabaseAdmin
            .from('profiles')
            .update({
              subscription_id: subscription?.id ?? null,
              subscription_status: subscription?.status ?? 'active',
              stripe_subscription_id: subscription?.id ?? null,
              stripe_price_id: subscription?.items?.data?.[0]?.price?.id ?? null,
              current_period_start: (subscription as any)?.current_period_start
                ? new Date((subscription as any).current_period_start * 1000).toISOString()
                : null,
              current_period_end: (subscription as any)?.current_period_end
                ? new Date((subscription as any).current_period_end * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)
            .select('id')
            .single();

          if (response.error) {
            throw new Error(response.error.message);
          }

          return response;
        },
        3,
        1000,
        log
      );

      if (updateError) {
        log.error('Failed to activate subscription via direct SQL', { error: updateError });
        throw new Error((updateError as any)?.message || 'Direct SQL update failed');
      }

      log.info(`✅ Activated subscription for user ${userId} (session ${session.id})`);
    } catch (error: any) {
      log.error('💥 Error in subscription activation', {
        error: error.message,
        userId,
        sessionId: session.id,
        subscriptionId: subscription?.id,
      });

      // Fallback: Try direct update if RPC fails
      const { error: fallbackError } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_id: subscription?.id ?? null,
          subscription_status: subscription?.status ?? 'active',
          stripe_subscription_id: subscription?.id ?? null,
          stripe_price_id: subscription?.items?.data?.[0]?.price?.id ?? null,
          current_period_start: (subscription as any)?.current_period_start
            ? new Date((subscription as any).current_period_start * 1000).toISOString()
            : null,
          current_period_end: (subscription as any)?.current_period_end
            ? new Date((subscription as any).current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (fallbackError) {
        log.error('❌ Fallback update also failed', { error: fallbackError });
      } else {
        log.info(`⚠️ Used fallback update for user ${userId}`);
      }
    }
  }
}

// Handle subscription created/updated events
async function handleSubscriptionChange(subscription: Stripe.Subscription, log: any) {
  const metadata = subscription.metadata;
  let userId: string | undefined = metadata?.user_id;

  log.info(`🔄 Processing subscription change: ${subscription.id}, status: ${subscription.status}`);

  // CRITICAL: Check if this is a daily backup addon subscription
  // These should NOT be processed as memberships or instances
  if (metadata?.addon_type === 'daily_backup') {
    log.info(`📦 Daily backup addon subscription - skipping membership/instance handling`, {
      subscriptionId: subscription.id,
      instanceId: metadata?.instance_id,
      status: subscription.status,
    });
    // Daily backup subscription changes don't affect anything - the checkout handler already set backup_interval_days
    // We might want to handle cancellation in the future, but for now just skip
    return;
  }

  // CRITICAL: Check if this is a BYON (Bring Your Own n8n) subscription
  // These don't need instance provisioning - just subscription tracking
  if (metadata?.flow_type === 'agency_byon' || metadata?.flow_type === 'client_byon') {
    const isAgencyPaid = metadata?.flow_type === 'agency_byon';
    const isClientPaid = metadata?.flow_type === 'client_byon';

    log.info(`🎯 BYON subscription detected (${metadata?.flow_type}) - no deployment needed`, {
      subscriptionId: subscription.id,
      userId: userId,
      clientEmail: metadata?.client_email,
      inviteId: metadata?.invite_id,
      invitedBy: metadata?.invited_by,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    // CRITICAL: Only update profile for CLIENT-PAID BYON subscriptions
    // Agency-paid subscriptions should NOT update the agency's profile
    if (isClientPaid && userId) {
      try {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_id: subscription.id,
            subscription_status: subscription.status,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
            current_period_start: (subscription as any).current_period_start
              ? new Date((subscription as any).current_period_start * 1000).toISOString()
              : null,
            current_period_end: (subscription as any).current_period_end
              ? new Date((subscription as any).current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          log.error('❌ Failed to update client-paid BYON subscription status:', updateError);
        } else {
          log.info(`✅ Client-paid BYON subscription updated for user ${userId} (status: ${subscription.status})`);
        }
      } catch (error: any) {
        log.error('❌ Client-paid BYON subscription update error:', error);
      }

      // Mark the invite as accepted if needed
      if (metadata?.invite_id) {
        try {
          const { error: inviteError } = await supabaseAdmin
            .from('client_invites')
            .update({
              status: 'accepted',
              accepted_at: new Date().toISOString(),
            })
            .eq('id', metadata.invite_id);

          if (inviteError) {
            log.error('❌ Failed to update invite status:', inviteError);
          } else {
            log.info(`✅ Marked invite ${metadata.invite_id} as accepted`);
          }
        } catch (error: any) {
          log.error('❌ Invite update error:', error);
        }
      }
    } else if (isAgencyPaid) {
      // Agency-paid BYON: subscription tracked in Stripe only, agency profile unchanged
      log.info(`✅ Agency-paid BYON subscription ${subscription.id} tracked in Stripe - agency profile unchanged`);

      // If subscription is canceled, we may want to mark the invite as revoked in the future
      if (subscription.cancel_at_period_end || subscription.status === 'canceled') {
        log.warn(`⚠️ Agency-paid BYON subscription ${subscription.id} canceled - client will lose access at period end`);
      }
    }

    return; // Exit early - BYON handled, no instance provisioning needed
  }

  // CRITICAL: WhatsApp API subscriptions don't need membership/instance handling
  if (metadata?.plan_type === 'whatsapp') {
    log.info(`📱 WhatsApp API subscription update - skipping membership/instance handling`, {
      subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
    return;
  }

  // CRITICAL: Check if this is an instance add-on (NOT a membership!)
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const isInstanceFromPrice = isInstancePrice(priceId);
  const isInstanceFromMetadata = metadata?.plan_type === 'pay_per_instance';

  // Also check by price ID in case metadata is missing
  if (isWhatsAppPrice(priceId)) {
    log.info(`📱 WhatsApp API subscription detected via price ID - skipping membership/instance handling`, {
      subscriptionId: subscription.id,
      priceId,
    });
    return;
  }

  log.info(`🔍 Subscription detection: priceId=${priceId}, isInstanceFromPrice=${isInstanceFromPrice}, isInstanceFromMetadata=${isInstanceFromMetadata}, cancel_at_period_end=${subscription.cancel_at_period_end}`);
  log.info(`🔍 Subscription metadata:`, metadata);
  log.info(`🔍 Instance price IDs configured:`, {
    monthly_10gb: process.env.NEXT_PUBLIC_STRIPE_10GB_MONTHLY_PRICE_ID,
    annual_10gb: process.env.NEXT_PUBLIC_STRIPE_10GB_ANNUAL_PRICE_ID,
    monthly_50gb: process.env.NEXT_PUBLIC_STRIPE_50GB_MONTHLY_PRICE_ID,
    annual_50gb: process.env.NEXT_PUBLIC_STRIPE_50GB_ANNUAL_PRICE_ID,
  });

  if (isInstanceFromPrice || isInstanceFromMetadata) {
    log.info(`✅ INSTANCE SUBSCRIPTION DETECTED: ${subscription.id} (price: ${priceId})`);

    // Check if instance already exists by subscription ID
    let { data: existingInstance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, status, stripe_subscription_id, instance_name, coolify_service_id, storage_limit_gb')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    // If not found, check by user+name (for instances with NULL subscription_id from $0 checkouts)
    if (!existingInstance && metadata?.user_id && metadata?.instance_name) {
      log.info(`🔍 No instance found by subscription ID, checking by user+name...`);
      const { data: instanceByName } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, status, stripe_subscription_id, instance_name, coolify_service_id, storage_limit_gb')
        .eq('user_id', metadata.user_id)
        .eq('instance_name', metadata.instance_name)
        .is('stripe_subscription_id', null) // Find instances with NULL subscription ID
        .is('deleted_at', null)
        .single();

      if (instanceByName) {
        log.info(`✅ Found instance with NULL subscription ID, updating to: ${subscription.id}`);
        existingInstance = instanceByName;
      }
    }

    if (existingInstance) {
      log.info(`🔍 Found existing instance: ${existingInstance.instance_name} (status: ${existingInstance.status})`);

      // CRITICAL: If subscription is set to cancel, immediately soft-delete the instance
      if (subscription.cancel_at_period_end && !existingInstance.status.includes('delet')) {
        log.info(`🔴 CANCELLATION DETECTED - cancel_at_period_end=true`);
        log.info(`🔴 Soft-deleting instance: ${existingInstance.instance_name} (ID: ${existingInstance.id})`);

        const { error: deleteError } = await supabaseAdmin
          .from('pay_per_instance_deployments')
          .update({
            status: 'deleting',
            subscription_status: subscription.status,
            cancel_at_period_end: true,
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingInstance.id);

        if (deleteError) {
          log.error('❌ CRITICAL: Failed to soft-delete instance in database', {
            error: deleteError,
            instanceId: existingInstance.id,
            instanceName: existingInstance.instance_name
          });
          throw new Error(`Failed to soft-delete instance: ${deleteError.message}`);
        } else {
          log.info(`✅ SUCCESS: Instance ${existingInstance.instance_name} marked as deleted in database`);
          log.info(`✅ Real-time subscription will now remove it from UI`);
        }

        // Instance marked as deleted in DB - external hosting provider handles actual shutdown

        log.info(`✅ INSTANCE CANCELLATION COMPLETE - returning early to protect membership`);
        return; // Exit - instance has been handled
      }

      // Instance exists - just update subscription details (e.g., status change)
      const updates: any = {
        subscription_status: subscription.status,
        current_period_start: (subscription as any).current_period_start
          ? new Date((subscription as any).current_period_start * 1000).toISOString()
          : null,
        current_period_end: (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        updated_at: new Date().toISOString(),
      };

      // If this instance had NULL subscription ID, update it to the real one
      if (!existingInstance.stripe_subscription_id) {
        log.info(`🔄 Updating NULL subscription ID to: ${subscription.id}`);
        updates.stripe_subscription_id = subscription.id;
      }

      const { error: updateError } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .update(updates)
        .eq('id', existingInstance.id); // Use ID instead of subscription_id for temp cases

      if (updateError) {
        log.error('❌ Failed to update instance deployment:', updateError);
        // Don't throw - this is not critical
      } else {
        log.info(`✅ Instance add-on subscription updated - user membership unchanged`);
      }

      // CRITICAL: Ensure subscription has metadata for future webhooks
      if (!metadata?.plan_type) {
        log.info(`🔄 Subscription ${subscription.id} missing plan_type metadata - updating now`);
        try {
          await getStripeWebhook().subscriptions.update(subscription.id, {
            metadata: {
              plan_type: 'pay_per_instance',
              instance_name: existingInstance.instance_name,
              storage_limit: existingInstance.storage_limit_gb?.toString() || '10',
              user_id: subscription.customer as string,
            },
          });
          log.info(`✅ Updated subscription ${subscription.id} with pay_per_instance metadata`);
        } catch (metaError: any) {
          log.error(`⚠️ Failed to update subscription metadata (non-critical):`, metaError.message);
        }
      }
    } else {
      // Instance doesn't exist - this is a NEW subscription (likely from 100% discount checkout)
      log.info('🚀 New pay-per-instance subscription detected - provisioning now');

      const instanceName = metadata?.instance_name;
      const storageLimit = parseInt(metadata?.storage_limit || '10');
      const userId = metadata?.supabase_user_id || metadata?.user_id;
      const invitedByUserId = metadata?.client_invited_by; // Agency who invited client (if from client-paid invite)

      if (!instanceName || !storageLimit || !userId) {
        log.error('❌ Missing metadata for instance provisioning:', { instanceName, storageLimit, userId, metadata });
        return; // Exit - can't provision without metadata
      }

      const billingCycle = (subscription as any).items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly';

      // Provision the instance
      try {
        const provisionResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/n8n/provision-instance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userId,
            storageLimit,
            instanceName,
            billingCycle,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            invitedByUserId: invitedByUserId || null, // Agency who invited client (if from client-paid invite)
            skipProvisioning: true, // Create pending_deploy record; user chooses when to deploy
          }),
        });

        if (!provisionResponse.ok) {
          const errorData = await provisionResponse.json();
          log.error('❌ Instance pending_deploy creation failed:', errorData);
        } else {
          const provisionData = await provisionResponse.json();
          log.info(`✅ Pay-per-instance pending_deploy record created from subscription webhook: ${instanceName} (${storageLimit}GB, ${billingCycle})`);

          // Mark client invite as accepted if this was from an invite
          const clientInviteId = metadata?.client_invite_id;
          const clientInvitedBy = metadata?.client_invited_by;

          if (clientInviteId) {
            try {
              // CRITICAL: Mark invite as accepted with proper error handling
              const { data: updatedInvite, error: inviteUpdateError } = await supabaseAdmin
                .from('client_invites')
                .update({
                  status: 'accepted',
                  accepted_by: userId,
                })
                .eq('id', clientInviteId)
                .eq('status', 'pending')
                .select()
                .maybeSingle();

              if (inviteUpdateError) {
                log.error('⚠️ Failed to mark invite as accepted (DB error):', inviteUpdateError.message);
              } else if (!updatedInvite) {
                // No rows updated - invite might not be pending anymore
                log.error(`⚠️ Failed to mark invite ${clientInviteId} as accepted - invite not found or not pending`);

                // Check current invite status
                const { data: currentInvite } = await supabaseAdmin
                  .from('client_invites')
                  .select('status')
                  .eq('id', clientInviteId)
                  .maybeSingle();

                log.error(`⚠️ Current invite status: ${currentInvite?.status || 'NOT FOUND'}`);
              } else {
                log.info(`✅ Marked client invite ${clientInviteId} as accepted`);
              }

              // CRITICAL FIX: Create client_instances record for backwards compatibility
              // This allows the agency to see the client in their dashboard
              if (provisionData.instance?.id) {
                // Get invited_by from metadata or fetch from invite
                const invitedBy = clientInvitedBy || (await supabaseAdmin
                  .from('client_invites')
                  .select('invited_by, allow_full_access')
                  .eq('id', clientInviteId)
                  .maybeSingle()
                ).data?.invited_by;

                const allowFullAccess = (await supabaseAdmin
                  .from('client_invites')
                  .select('allow_full_access')
                  .eq('id', clientInviteId)
                  .maybeSingle()
                ).data?.allow_full_access ?? true; // Default to true for client-paid instances

                if (invitedBy) {
                  const { error: clientInstanceError } = await supabaseAdmin
                    .from('client_instances')
                    .upsert(
                      {
                        team_id: invitedBy,
                        client_id: userId,
                        instance_id: provisionData.instance.id,
                        user_id: userId,
                        invited_by: invitedBy,
                        assigned_by: invitedBy,
                        access_level: allowFullAccess ? 'edit' : 'view',
                      },
                      { onConflict: 'instance_id', ignoreDuplicates: false }
                    );

                  if (clientInstanceError) {
                    log.error('⚠️ Failed to create client_instances record:', clientInstanceError.message);
                  } else {
                    log.info(`✅ Created client_instances record for user ${userId}, instance ${provisionData.instance.id}`);
                  }
                } else {
                  log.error('⚠️ Could not find invited_by for invite:', clientInviteId);
                }
              }
            } catch (inviteError: any) {
              log.error('⚠️ Error updating invite status:', inviteError.message);
            }
          }
        }
      } catch (error: any) {
        log.error('❌ Instance provisioning error:', error);
      }
    }

    // Send payment failure email if status is past_due
    if (subscription.status === 'past_due' && userId) {
      try {
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('email, name')
          .eq('id', userId)
          .single();

        if (user?.email) {
          const instanceName = metadata?.instance_name || existingInstance?.instance_name || null;
          await emailService.sendPaymentFailedNotice(
            user.email,
            user.name || 'there',
            true, // is instance
            instanceName
          );
          log.info(`📧 Payment failed email sent to ${user.email} for instance ${instanceName}`);
        }
      } catch (emailError: any) {
        log.error('Email send failed:', emailError);
        // Don't throw - email failure shouldn't block webhook
      }
    }

    return; // Exit early - NEVER touch user membership for instance add-ons!
  }

  // If no user_id in metadata, try to find user by customer_id
  if (!userId && subscription.customer) {
    try {
      const { data: userInfo } = await supabaseAdmin
        .rpc('get_user_by_stripe_customer', {
          p_customer_id: subscription.customer as string,
        })
        .single();

      userId = (userInfo as UserLookupResult)?.user_id;
      log.info(`🔍 Found user ${userId} via customer lookup for subscription change`);
    } catch (e) {
      log.warn('Failed to lookup user by customer ID for subscription change', {
        customerId: subscription.customer,
      });
    }
  }

  if (!userId) {
    log.error('No user ID found for subscription change', { subscriptionId: subscription.id });
    return;
  }

  log.info(`📋 Processing subscription change with price ID: ${priceId}`);

  // Update profile subscription fields
  try {
    const { error: updateError } = await retryWithBackoff(
      async () => {
        const response = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_id: subscription.id,
            subscription_status: subscription.status,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
            current_period_start: (subscription as any).current_period_start
              ? new Date((subscription as any).current_period_start * 1000).toISOString()
              : null,
            current_period_end: (subscription as any).current_period_end
              ? new Date((subscription as any).current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (response.error) {
          throw new Error(response.error.message);
        }

        return response;
      },
      3,
      1000,
      log
    );

    if (updateError) {
      log.error('Failed to update subscription via direct SQL', { error: updateError });
      throw new Error((updateError as any)?.message || 'Direct SQL update failed');
    }

    log.info(`✅ Updated subscription for user ${userId}, status: ${subscription.status}`);
  } catch (error: any) {
    log.error('💥 Error handling subscription change', {
      error: (error as any)?.message,
      subscriptionId: subscription.id,
      userId,
    });
  }
}

// Handles downgrading a user to the free tier when their subscription is canceled.
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, log: any) {
  let userId: string | undefined = subscription.metadata?.user_id;
  log.info(`🗑️ Processing subscription deletion for: ${subscription.id}`);

  // Handle daily backup addon cancellation
  const isDailyBackupAddon = subscription.metadata?.addon_type === 'daily_backup';
  if (isDailyBackupAddon) {
    const instanceId = subscription.metadata?.instance_id;
    const subUserId = subscription.metadata?.supabase_user_id;

    log.info(`🔄 Daily backup addon cancellation detected`, {
      instanceId,
      userId: subUserId,
      subscriptionId: subscription.id,
    });

    if (!instanceId) {
      log.error('❌ Missing instance_id in daily backup subscription metadata');
      return;
    }

    try {
      // Revert instance to weekly backups (try both tables)
      // Note: We keep the backups - only change the interval
      const { error: n8nError } = await supabaseAdmin
        .from('n8n_instances')
        .update({
          backup_interval_days: 7,
          daily_backup_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', instanceId);

      if (n8nError) {
        // Try pay_per_instance_deployments table
        const { error: ppiError } = await supabaseAdmin
          .from('pay_per_instance_deployments')
          .update({
            backup_interval_days: 7,
            daily_backup_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', instanceId);

        if (ppiError) {
          log.error('❌ Failed to revert backup interval in both tables:', { n8nError, ppiError });
          throw new Error('Failed to revert backup interval');
        }
      }

      log.info(`✅ Daily backup addon cancelled - reverted instance ${instanceId} to weekly backups`);
      log.info(`📦 Note: Existing backups are preserved on the server`);
    } catch (error: any) {
      log.error('❌ Daily backup addon cancellation failed:', error);
      throw error;
    }

    return; // Exit early - daily backup addon handled, don't touch membership
  }

  // Check if this is a WhatsApp API subscription cancellation
  const isWhatsAppFromMetadata = subscription.metadata?.plan_type === 'whatsapp';
  if (isWhatsAppFromMetadata) {
    log.info(`📱 WhatsApp API subscription deletion detected: ${subscription.id}`);

    const instanceName = subscription.metadata?.instance_name;

    // Find the WhatsApp instance
    const { data: waInstance, error: findErr } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, instance_name, session_token, server_url, deployment_server_id')
      .eq('stripe_subscription_id', subscription.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (findErr || !waInstance) {
      log.error(`WhatsApp instance not found for subscription ${subscription.id}`);
      return;
    }

    // Delete session from Evolution API using admin key (session hash may not have delete permission)
    if (waInstance.server_url && waInstance.deployment_server_id) {
      try {
        const { data: server } = await supabaseAdmin
          .from('whatsapp_servers')
          .select('evolution_api_admin_key')
          .eq('id', waInstance.deployment_server_id)
          .maybeSingle();

        if (server?.evolution_api_admin_key) {
          const { deleteSession } = await import('@/lib/evolutionApi');
          const config = { baseUrl: waInstance.server_url, apiKey: server.evolution_api_admin_key };
          await deleteSession(config, waInstance.instance_name);
          log.info(`Evolution API session deleted: ${waInstance.instance_name}`);
        } else {
          log.warn(`No admin key found for server ${waInstance.deployment_server_id}, skipping Evolution API deletion`);
        }
      } catch (evoErr: any) {
        log.error(`Failed to delete Evolution API session: ${evoErr.message}`);
      }
    }

    // Soft-delete in DB
    await supabaseAdmin
      .from('whatsapp_instances')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', waInstance.id);

    // Decrement server count
    if (waInstance.deployment_server_id) {
      await supabaseAdmin.rpc('decrement_whatsapp_session_count', {
        p_server_id: waInstance.deployment_server_id,
      });
    }

    log.info(`WhatsApp instance deleted: ${waInstance.instance_name}`);
    return; // Exit early
  }

  // CRITICAL: Check if this is an instance add-on (NOT a membership!)
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const isInstanceFromPrice = isInstancePrice(priceId);
  const isInstanceFromMetadata = subscription.metadata?.plan_type === 'pay_per_instance';
  const isDailyBackupFromPrice = isDailyBackupPrice(priceId);
  const isWhatsAppFromPrice = isWhatsAppPrice(priceId);

  log.info(`🔍 Deletion detection: priceId=${priceId}, isInstanceFromPrice=${isInstanceFromPrice}, isInstanceFromMetadata=${isInstanceFromMetadata}, isDailyBackupFromPrice=${isDailyBackupFromPrice}, isWhatsAppFromPrice=${isWhatsAppFromPrice}`);
  log.info(`🔍 Subscription metadata:`, subscription.metadata);
  log.info(`🔍 Instance price IDs configured:`, {
    monthly_10gb: process.env.NEXT_PUBLIC_STRIPE_10GB_MONTHLY_PRICE_ID,
    annual_10gb: process.env.NEXT_PUBLIC_STRIPE_10GB_ANNUAL_PRICE_ID,
    monthly_50gb: process.env.NEXT_PUBLIC_STRIPE_50GB_MONTHLY_PRICE_ID,
    annual_50gb: process.env.NEXT_PUBLIC_STRIPE_50GB_ANNUAL_PRICE_ID,
    daily_backup: process.env.STRIPE_DAILY_BACKUP_PRICE_ID,
  });

  // Handle daily backup by price ID (fallback if metadata missing)
  if (isDailyBackupFromPrice) {
    log.info(`🔄 Daily backup addon detected via price ID (metadata may be missing)`);
    // Find instance with this daily backup subscription
    const { data: instanceWithBackup } = await supabaseAdmin
      .from('n8n_instances')
      .select('id')
      .eq('daily_backup_subscription_id', subscription.id)
      .single();

    if (!instanceWithBackup) {
      // Try pay_per_instance_deployments
      const { data: ppiWithBackup } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id')
        .eq('daily_backup_subscription_id', subscription.id)
        .single();

      if (ppiWithBackup) {
        await supabaseAdmin
          .from('pay_per_instance_deployments')
          .update({
            backup_interval_days: 7,
            daily_backup_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ppiWithBackup.id);
        log.info(`✅ Reverted pay_per_instance ${ppiWithBackup.id} to weekly backups`);
      }
    } else {
      await supabaseAdmin
        .from('n8n_instances')
        .update({
          backup_interval_days: 7,
          daily_backup_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', instanceWithBackup.id);
      log.info(`✅ Reverted n8n_instance ${instanceWithBackup.id} to weekly backups`);
    }
    return; // Exit early - daily backup handled, don't touch membership
  }

  // Handle WhatsApp by price ID (fallback if metadata missing)
  if (isWhatsAppFromPrice) {
    log.info(`📱 WhatsApp API subscription detected via price ID (metadata may be missing): ${subscription.id}`);

    const { data: waInstance, error: findErr } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, instance_name, session_token, server_url, deployment_server_id')
      .eq('stripe_subscription_id', subscription.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (findErr || !waInstance) {
      log.error(`WhatsApp instance not found for subscription ${subscription.id} (price fallback)`);
      return;
    }

    if (waInstance.server_url && waInstance.deployment_server_id) {
      try {
        const { data: server } = await supabaseAdmin
          .from('whatsapp_servers')
          .select('evolution_api_admin_key')
          .eq('id', waInstance.deployment_server_id)
          .maybeSingle();

        if (server?.evolution_api_admin_key) {
          const { deleteSession } = await import('@/lib/evolutionApi');
          const config = { baseUrl: waInstance.server_url, apiKey: server.evolution_api_admin_key };
          await deleteSession(config, waInstance.instance_name);
          log.info(`Evolution API session deleted: ${waInstance.instance_name}`);
        }
      } catch (evoErr: any) {
        log.error(`Failed to delete Evolution API session: ${evoErr.message}`);
      }
    }

    await supabaseAdmin
      .from('whatsapp_instances')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', waInstance.id);

    if (waInstance.deployment_server_id) {
      await supabaseAdmin.rpc('decrement_whatsapp_session_count', {
        p_server_id: waInstance.deployment_server_id,
      });
    }

    log.info(`WhatsApp instance deleted (price fallback): ${waInstance.instance_name}`);
    return; // Exit early - don't touch membership
  }

  if (isInstanceFromPrice || isInstanceFromMetadata) {
    log.info(`✅ INSTANCE SUBSCRIPTION DELETION DETECTED: ${subscription.id} (price: ${priceId})`);

    // Find the instance in pay_per_instance_deployments
    const { data: instance, error: findError } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, coolify_service_id, instance_name, status')
      .eq('stripe_subscription_id', subscription.id)
      .is('deleted_at', null)
      .single();

    if (findError || !instance) {
      log.error(`❌ CRITICAL: Failed to find instance for subscription ${subscription.id}`, {
        error: findError,
        subscriptionId: subscription.id
      });
      return;
    }

    log.info(`🔍 Found instance to delete: ${instance.instance_name} (ID: ${instance.id}, Coolify: ${instance.coolify_service_id})`);

    // Mark instance as deleted in database (soft delete)
    const { error: deleteError } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .update({
        status: 'deleting',
        subscription_status: 'canceled',
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', instance.id);

    if (deleteError) {
      log.error(`❌ CRITICAL: Failed to mark instance as deleted in database`, {
        error: deleteError,
        instanceId: instance.id,
        instanceName: instance.instance_name
      });
      throw new Error(`Failed to delete instance: ${deleteError.message}`);
    } else {
      log.info(`✅ SUCCESS: Instance ${instance.instance_name} marked as deleted in database`);
      log.info(`✅ Real-time subscription will now remove it from UI`);
    }

    // Instance marked as deleted in DB - external hosting provider handles actual shutdown

    log.info(`✅ INSTANCE DELETION COMPLETE - returning early to protect membership`);

    // Send cancellation email with 30-day restoration notice
    if (userId) {
      try {
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('email, name')
          .eq('id', userId)
          .single();

        if (user?.email) {
          await emailService.sendSubscriptionCanceledNotice(
            user.email,
            user.name || 'there',
            true, // is instance
            instance.instance_name
          );
          log.info(`📧 Cancellation email sent to ${user.email} for instance ${instance.instance_name}`);
        }
      } catch (emailError: any) {
        log.error('Email send failed:', emailError);
      }
    }

    return; // Exit early - NEVER downgrade user when cancelling instance add-ons!
  }

  if (!userId && subscription.customer) {
    try {
      const { data: userInfo } = await supabaseAdmin
        .rpc('get_user_by_stripe_customer', { p_customer_id: subscription.customer as string })
        .single();
      userId = (userInfo as UserLookupResult)?.user_id;
    } catch (e) {
      log.warn('Failed to find user by customer ID for subscription deletion.', { customerId: subscription.customer });
    }
  }

  if (!userId) {
    log.error('No user ID found for subscription deletion.', { subscriptionId: subscription.id });
    return;
  }

  log.info(`🔄 Processing subscription cancellation for user ${userId}, subscription ${subscription.id}`);

  try {
    // Update user's profile subscription status to canceled
    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_id: null,
        subscription_status: 'canceled',
        stripe_price_id: null,
      })
      .eq('id', userId);

    log.info(`✅ Cleared subscription fields for user ${userId}`);

    // Clean up WhatsApp instances — cancel their Stripe subscriptions and remove Evolution API sessions
    try {
      const { data: waInstances } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('id, instance_name, server_url, deployment_server_id, stripe_subscription_id')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (waInstances && waInstances.length > 0) {
        log.info(`📱 Found ${waInstances.length} active WhatsApp instance(s) for cancelled user ${userId} — cleaning up`);

        for (const wa of waInstances) {
          // Cancel the per-instance Stripe subscription if it exists (this prevents future charges)
          if (wa.stripe_subscription_id) {
            try {
              await getStripeWebhook().subscriptions.cancel(wa.stripe_subscription_id);
              log.info(`💳 Cancelled WhatsApp Stripe subscription ${wa.stripe_subscription_id}`);
            } catch (stripeErr: any) {
              // Already cancelled or doesn't exist — that's fine
              log.warn(`⚠️ Could not cancel WhatsApp subscription ${wa.stripe_subscription_id}: ${stripeErr.message}`);
            }
          }

          // Delete Evolution API session
          if (wa.server_url && wa.deployment_server_id) {
            try {
              const { data: server } = await supabaseAdmin
                .from('whatsapp_servers')
                .select('evolution_api_admin_key')
                .eq('id', wa.deployment_server_id)
                .maybeSingle();

              if (server?.evolution_api_admin_key) {
                const { deleteSession } = await import('@/lib/evolutionApi');
                const config = { baseUrl: wa.server_url, apiKey: server.evolution_api_admin_key };
                await deleteSession(config, wa.instance_name);
                log.info(`🗑️ Deleted Evolution API session: ${wa.instance_name}`);
              }
            } catch (evoErr: any) {
              log.error(`Failed to delete Evolution session ${wa.instance_name}: ${evoErr.message}`);
            }
          }

          // Soft-delete in DB
          await supabaseAdmin
            .from('whatsapp_instances')
            .update({ status: 'deleted', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', wa.id);

          // Decrement server count
          if (wa.deployment_server_id) {
            await supabaseAdmin.rpc('decrement_whatsapp_session_count', { p_server_id: wa.deployment_server_id });
          }

          log.info(`✅ WhatsApp instance ${wa.instance_name} cleaned up`);
        }
      }
    } catch (waCleanupErr: any) {
      log.error(`⚠️ WhatsApp cleanup failed (non-critical): ${waCleanupErr.message}`);
    }

    // Clean up n8n instances
    try {
      const cleanupN8nInstance = async (table: string, instance: any) => {
        // Cancel per-instance Stripe subscription if it exists
        if (instance.stripe_subscription_id) {
          try {
            await getStripeWebhook().subscriptions.cancel(instance.stripe_subscription_id);
            log.info(`💳 Cancelled n8n Stripe subscription ${instance.stripe_subscription_id}`);
          } catch (stripeErr: any) {
            log.warn(`⚠️ Could not cancel n8n subscription ${instance.stripe_subscription_id}: ${stripeErr.message}`);
          }
        }

        // Soft-delete in DB
        await supabaseAdmin
          .from(table)
          .update({
            status: 'deleting',
            subscription_status: 'canceled',
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', instance.id);

        log.info(`✅ n8n instance ${instance.instance_name || instance.subdomain} cleaned up from ${table}`);
      };

      // Clean up membership instances (n8n_instances table)
      const { data: membershipInstances } = await supabaseAdmin
        .from('n8n_instances')
        .select('id, subdomain, coolify_service_id, stripe_subscription_id')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (membershipInstances && membershipInstances.length > 0) {
        log.info(`📦 Found ${membershipInstances.length} n8n instance(s) for cancelled user ${userId}`);
        for (const inst of membershipInstances) {
          await cleanupN8nInstance('n8n_instances', inst);
        }
      }

      // Clean up pay-per-instance add-ons (pay_per_instance_deployments table)
      const { data: ppiInstances } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, instance_name, coolify_service_id, stripe_subscription_id')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (ppiInstances && ppiInstances.length > 0) {
        log.info(`📦 Found ${ppiInstances.length} pay-per-instance deployment(s) for cancelled user ${userId}`);
        for (const inst of ppiInstances) {
          await cleanupN8nInstance('pay_per_instance_deployments', inst);
        }
      }
    } catch (n8nCleanupErr: any) {
      log.error(`⚠️ n8n cleanup failed (non-critical): ${n8nCleanupErr.message}`);
    }

    log.info(`✅ Successfully processed subscription cancellation for user ${userId}`);
  } catch (error: any) {
    log.error(`💥 Error processing subscription cancellation for user ${userId}`, { error: error.message });
  }
}

// Handle subscription schedule completed event
// This fires when a scheduled subscription change is executed (e.g., downgrade at period end)
async function handleSubscriptionScheduleCompleted(schedule: Stripe.SubscriptionSchedule, log: any) {
  log.info(`📅 Subscription schedule completed: ${schedule.id}, status: ${schedule.status}`);

  // Get the subscription that was updated
  const subscriptionId = schedule.subscription as string;
  if (!subscriptionId) {
    log.error('❌ No subscription ID in schedule completion event');
    return;
  }

  try {
    // Fetch the updated subscription from Stripe
    const subscription = await getStripeWebhook().subscriptions.retrieve(subscriptionId);
    log.info(`🔄 Fetched updated subscription after schedule completion: ${subscription.id}, status: ${subscription.status}`);

    // Get current phase to see what price was applied
    const currentPhaseIndex = (schedule as any).current_phase || 0;
    const currentPhase = schedule.phases?.[currentPhaseIndex];
    const newPriceId = currentPhase?.items?.[0]?.price;
    log.info(`📋 Schedule completed - subscription now on price: ${newPriceId}`);

    // Process the subscription change through the normal handler
    await handleSubscriptionChange(subscription, log);

    log.info(`✅ Successfully processed scheduled subscription change for subscription ${subscription.id}`);
  } catch (error: any) {
    log.error(`❌ Error handling subscription schedule completion`, {
      error: error.message,
      scheduleId: schedule.id,
      subscriptionId: subscriptionId,
    });
    throw error;
  }
}

// Handle subscription schedule canceled event
// This fires when a user cancels a pending scheduled change (e.g., cancels a scheduled downgrade)
async function handleSubscriptionScheduleCanceled(schedule: Stripe.SubscriptionSchedule, log: any) {
  log.info(`📅 Subscription schedule canceled: ${schedule.id}, status: ${schedule.status}`);

  // Get the subscription
  const subscriptionId = schedule.subscription as string;
  if (!subscriptionId) {
    log.error('❌ No subscription ID in schedule cancellation event');
    return;
  }

  try {
    // Fetch the subscription from Stripe
    const subscription = await getStripeWebhook().subscriptions.retrieve(subscriptionId);
    log.info(`🔄 Schedule canceled for subscription: ${subscription.id}, status: ${subscription.status}`);

    // When a schedule is canceled, the subscription remains on its current plan
    // We just log this for monitoring - no profile changes needed
    const currentPriceId = subscription.items?.data?.[0]?.price?.id;
    log.info(`✅ Schedule canceled - subscription ${subscription.id} will remain on current price: ${currentPriceId}`);

    // EDGE CASE: Verify the user's profile is still in sync with their current subscription
    // This ensures that if there was any data inconsistency, we fix it
    const userId = subscription.metadata?.user_id;
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_price_id, stripe_subscription_id')
        .eq('id', userId)
        .single();

      if (profile) {
        // If profile doesn't match current subscription, sync it
        if (profile.stripe_price_id !== currentPriceId || profile.stripe_subscription_id !== subscription.id) {
          log.warn(`⚠️ Profile out of sync after schedule cancellation - resyncing user ${userId}`);
          await handleSubscriptionChange(subscription, log);
        } else {
          log.info(`✅ Profile already in sync for user ${userId}`);
        }
      }
    }
  } catch (error: any) {
    log.error(`❌ Error handling subscription schedule cancellation`, {
      error: error.message,
      scheduleId: schedule.id,
      subscriptionId: subscriptionId,
    });
    // Don't throw - cancellation handling is informational
  }
}
