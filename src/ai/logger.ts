/**
 * Structured Logging Module
 * 
 * Provides consistent logging format across all AI modules with
 * performance metrics, error tracking, and context information.
 */

export interface LogContext {
  module: string;
  operation: string;
  requestId?: string;
  userId?: string;
  teamId?: string;
  model?: string;
  executionTime?: number;
  cacheHit?: boolean;
  toolName?: string;
  intent?: string;
  confidence?: number;
  reasoning?: string;
  error?: string;
  success?: boolean;
  messageCount?: number;
  toolCount?: number;
  query?: string;
  resultsFound?: number;
  tools?: string[];
  metadata?: Record<string, any>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class AILogger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private formatLog(level: LogLevel, message: string, context: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...context
    };
    
    return JSON.stringify(logEntry);
  }
  
  debug(message: string, context: LogContext): void {
    if (this.isDevelopment) {
      console.log(this.formatLog('debug', message, context));
    }
  }
  
  info(message: string, context: LogContext): void {
    console.log(this.formatLog('info', message, context));
  }
  
  warn(message: string, context: LogContext): void {
    console.warn(this.formatLog('warn', message, context));
  }
  
  error(message: string, context: LogContext): void {
    console.error(this.formatLog('error', message, context));
  }
  
  // Performance tracking helper
  trackPerformance<T>(
    operation: string,
    module: string,
    fn: () => Promise<T>,
    additionalContext?: Partial<LogContext>
  ): Promise<T> {
    const startTime = Date.now();
    const context: LogContext = {
      module,
      operation,
      ...additionalContext
    };
    
    this.debug(`Starting ${operation}`, context);
    
    return fn()
      .then(result => {
        const executionTime = Date.now() - startTime;
        this.info(`Completed ${operation}`, {
          ...context,
          executionTime,
          success: true
        });
        return result;
      })
      .catch(error => {
        const executionTime = Date.now() - startTime;
        this.error(`Failed ${operation}`, {
          ...context,
          executionTime,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      });
  }
}

export const logger = new AILogger();

// Metrics tracking
class MetricsTracker {
  private metrics = new Map<string, {
    count: number;
    totalTime: number;
    errors: number;
    lastUpdated: number;
  }>();
  
  track(operation: string, executionTime: number, success: boolean): void {
    const key = operation;
    const existing = this.metrics.get(key) || {
      count: 0,
      totalTime: 0,
      errors: 0,
      lastUpdated: Date.now()
    };
    
    existing.count++;
    existing.totalTime += executionTime;
    if (!success) existing.errors++;
    existing.lastUpdated = Date.now();
    
    this.metrics.set(key, existing);
  }
  
  getMetrics(): Record<string, {
    count: number;
    averageTime: number;
    errorRate: number;
    lastUpdated: number;
  }> {
    const result: Record<string, any> = {};
    
    this.metrics.forEach((value, key) => {
      result[key] = {
        count: value.count,
        averageTime: value.totalTime / value.count,
        errorRate: value.errors / value.count,
        lastUpdated: value.lastUpdated
      };
    });
    
    return result;
  }
  
  // Cache hit rate tracking
  private cacheMetrics = new Map<string, { hits: number; misses: number }>();
  
  trackCacheHit(cacheType: string, hit: boolean): void {
    const existing = this.cacheMetrics.get(cacheType) || { hits: 0, misses: 0 };
    
    if (hit) {
      existing.hits++;
    } else {
      existing.misses++;
    }
    
    this.cacheMetrics.set(cacheType, existing);
  }
  
  getCacheMetrics(): Record<string, { hitRate: number; total: number }> {
    const result: Record<string, any> = {};
    
    this.cacheMetrics.forEach((value, key) => {
      const total = value.hits + value.misses;
      result[key] = {
        hitRate: total > 0 ? value.hits / total : 0,
        total
      };
    });
    
    return result;
  }
}

export const metrics = new MetricsTracker();