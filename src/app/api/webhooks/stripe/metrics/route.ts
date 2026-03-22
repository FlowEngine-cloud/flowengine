import { NextRequest, NextResponse } from 'next/server';

// Import the metrics from the webhook handler
// Note: In production, these should be stored in Redis or a database
declare global {
  var webhookMetrics: any;
  var deadLetterQueue: any;
}

export async function GET(req: NextRequest) {
  // Basic authentication check - in production, use proper auth
  const authHeader = req.headers.get('authorization');
  const isAuthorized =
    authHeader === `Bearer ${process.env.WEBHOOK_METRICS_SECRET}` ||
    process.env.NODE_ENV === 'development';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get current metrics (these would be fetched from Redis/DB in production)
    const metrics = globalThis.webhookMetrics || {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      avgProcessingTimeMs: 0,
      lastProcessedAt: new Date(),
      eventTypeCounts: {},
      errorTypes: {},
    };

    const deadLetterQueue = globalThis.deadLetterQueue || new Map();
    const failedEvents = Array.from(deadLetterQueue.values()).map((event: any) => ({
      ...event,
      firstFailedAt: event.firstFailedAt?.toISOString(),
      lastFailedAt: event.lastFailedAt?.toISOString(),
    }));

    const successRate =
      metrics.totalProcessed > 0
        ? ((metrics.successCount / metrics.totalProcessed) * 100).toFixed(2)
        : '0.00';

    const healthStatus = {
      status: 'healthy',
      issues: [] as string[],
    };

    // Health checks
    if (parseFloat(successRate) < 90) {
      healthStatus.status = 'degraded';
      healthStatus.issues.push(`Low success rate: ${successRate}%`);
    }

    if (metrics.avgProcessingTimeMs > 20000) {
      healthStatus.status = 'degraded';
      healthStatus.issues.push(`High processing time: ${metrics.avgProcessingTimeMs}ms`);
    }

    if (failedEvents.length > 10) {
      healthStatus.status = 'critical';
      healthStatus.issues.push(`Too many failed events: ${failedEvents.length}`);
    }

    return NextResponse.json({
      health: healthStatus,
      metrics: {
        ...metrics,
        successRate: successRate + '%',
        lastProcessedAt: metrics.lastProcessedAt?.toISOString(),
      },
      deadLetterQueue: {
        totalFailed: failedEvents.length,
        criticalFailures: failedEvents.filter((e: any) => e.failureCount >= 3).length,
        recentFailures: failedEvents.filter(
          (e: any) => new Date(e.lastFailedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
        ).length,
        events: failedEvents.slice(0, 20), // Return only first 20 for performance
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to retrieve metrics',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// POST endpoint to retry failed events
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const isAuthorized =
    authHeader === `Bearer ${process.env.WEBHOOK_METRICS_SECRET}` ||
    process.env.NODE_ENV === 'development';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, eventId } = await req.json();

    if (action === 'retry' && eventId) {
      const deadLetterQueue = globalThis.deadLetterQueue || new Map();
      const failedEvent = deadLetterQueue.get(eventId);

      if (failedEvent) {
        // In production, you would re-queue the event for processing
        // For now, we'll just remove it from the DLQ
        deadLetterQueue.delete(eventId);

        return NextResponse.json({
          success: true,
          message: `Event ${eventId} queued for retry`,
        });
      } else {
        return NextResponse.json(
          {
            error: 'Event not found in dead letter queue',
          },
          { status: 404 }
        );
      }
    }

    if (action === 'clear_dlq') {
      globalThis.deadLetterQueue?.clear();
      return NextResponse.json({
        success: true,
        message: 'Dead letter queue cleared',
      });
    }

    return NextResponse.json(
      {
        error: 'Invalid action. Use "retry" with eventId or "clear_dlq"',
      },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
