// =============================================================================
// LLM Router Service - Logger Service
// =============================================================================

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// =============================================================================
// LOGGER CONFIGURATION
// =============================================================================

const logLevel = process.env['LOG_LEVEL'] || 'info';
const logDir = process.env['LOG_DIR'] || 'logs';

// Create logs directory if it doesn't exist
import fs from 'fs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// =============================================================================
// LOG FORMATS
// =============================================================================

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// =============================================================================
// TRANSPORTS
// =============================================================================

const transports: winston.transport[] = [];

// Console transport for development
if (process.env['NODE_ENV'] !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: logLevel
    })
  );
}

// File transports for all environments
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
    level: logLevel
  })
);

// Error log file
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat,
    level: 'error'
  })
);

// =============================================================================
// LOGGER INSTANCE
// =============================================================================

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: {
    service: 'llm-router',
    version: process.env['npm_package_version'] || '1.0.0'
  },
  transports,
  exitOnError: false
});

// =============================================================================
// LOGGER METHODS
// =============================================================================

export class LoggerService {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, meta?: any) {
    logger.info(message, { context: this.context, ...meta });
  }

  warn(message: string, meta?: any) {
    logger.warn(message, { context: this.context, ...meta });
  }

  error(message: string, error?: Error | any, meta?: any) {
    const errorMeta = error instanceof Error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : { error };
    
    logger.error(message, { context: this.context, ...errorMeta, ...meta });
  }

  debug(message: string, meta?: any) {
    logger.debug(message, { context: this.context, ...meta });
  }

  trace(message: string, meta?: any) {
    logger.silly(message, { context: this.context, ...meta });
  }

  // Structured logging for specific events
  logRequest(requestId: string, serviceId: string, action: string, meta?: any) {
    this.info(`Request: ${action}`, {
      requestId,
      serviceId,
      action,
      ...meta
    });
  }

  logResponse(requestId: string, serviceId: string, action: string, status: string, meta?: any) {
    this.info(`Response: ${action}`, {
      requestId,
      serviceId,
      action,
      status,
      ...meta
    });
  }

  logError(requestId: string, serviceId: string, action: string, error: Error | any, meta?: any) {
    this.error(`Error: ${action}`, error, {
      requestId,
      serviceId,
      action,
      ...meta
    });
  }

  logPerformance(requestId: string, serviceId: string, action: string, duration: number, meta?: any) {
    this.info(`Performance: ${action}`, {
      requestId,
      serviceId,
      action,
      duration,
      ...meta
    });
  }

  logSecurity(event: string, serviceId: string, action: string, meta?: any) {
    this.warn(`Security: ${event}`, {
      serviceId,
      action,
      event,
      ...meta
    });
  }

  logRouting(requestId: string, serviceId: string, selectedModel: string, confidence: number, meta?: any) {
    this.info(`Routing: Model selected`, {
      requestId,
      serviceId,
      selectedModel,
      confidence,
      ...meta
    });
  }

  logCost(requestId: string, serviceId: string, model: string, cost: number, tokens: number, meta?: any) {
    this.info(`Cost: Request processed`, {
      requestId,
      serviceId,
      model,
      cost,
      tokens,
      ...meta
    });
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function createLogger(context: string): LoggerService {
  return new LoggerService(context);
}

export function logUnhandledError(error: Error, context?: string) {
  logger.error('Unhandled error occurred', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context: context || 'unknown'
  });
}

export function logPerformanceMetrics(operation: string, duration: number, meta?: any) {
  logger.info(`Performance metric: ${operation}`, {
    operation,
    duration,
    ...meta
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export default logger;
