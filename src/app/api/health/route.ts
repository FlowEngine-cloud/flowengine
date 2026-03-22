/**
 * Health Check API Route
 * 
 * Provides system health status and performance metrics
 * for monitoring the AI router system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '../../../ai/logger';

export async function GET(request: NextRequest) {
  // Require authentication for health endpoint
  const authHeader = request.headers.get('authorization');
  const monitoringSecret = process.env.HEALTH_CHECK_SECRET;
  if (monitoringSecret && authHeader !== `Bearer ${monitoringSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startTime = Date.now();
    
    // Basic health checks
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown'
    };
    
    // Get performance metrics
    const performanceMetrics = metrics.getMetrics();
    const cacheMetrics = metrics.getCacheMetrics();
    
    // Check if critical services are responding
    const serviceChecks = await performServiceChecks();
    
    const responseTime = Date.now() - startTime;
    
    const response = {
      ...health,
      responseTime,
      metrics: {
        performance: performanceMetrics,
        cache: cacheMetrics
      },
      services: serviceChecks
    };
    
    // Return 503 if any critical service is down
    const hasFailures = Object.values(serviceChecks).some(check => !check.healthy);
    const statusCode = hasFailures ? 503 : 200;
    
    return NextResponse.json(response, { status: statusCode });
    
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}

async function performServiceChecks() {
  const checks: Record<string, { healthy: boolean; responseTime?: number; error?: string }> = {};
  
  // Check AI provider connectivity
  try {
    const aiBaseUrl = process.env.AI_BASE_URL;
    if (!aiBaseUrl) {
      checks.ai_provider = { healthy: true, error: 'not_configured' } as any;
    } else {
      const startTime = Date.now();
      const response = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.AI_API_KEY}`
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      checks.ai_provider = {
        healthy: response.ok,
        responseTime: Date.now() - startTime
      };

      if (!response.ok) {
        checks.ai_provider.error = `HTTP ${response.status}`;
      }
    }
  } catch (error) {
    checks.ai_provider = {
      healthy: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
  
  // Check filesystem access
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const testPath = path.join(process.cwd(), 'n8n-workflows');
    await fs.access(testPath);
    
    checks.filesystem = { healthy: true };
  } catch (error) {
    checks.filesystem = {
      healthy: false,
      error: 'Cannot access n8n-workflows directory'
    };
  }
  
  // Check workflow prompt file
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const promptPath = path.join(process.cwd(), 'prompts', 'workflow-assistant.md');
    await fs.access(promptPath);
    
    checks.workflowPrompt = { healthy: true };
  } catch (error) {
    checks.workflowPrompt = {
      healthy: false,
      error: 'Cannot access workflow prompt file'
    };
  }
  
  return checks;
}