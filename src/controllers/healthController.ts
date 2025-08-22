// =============================================================================
// LLM Router Service - Health Controller
// =============================================================================

import { Router, Request, Response } from 'express';
import { logger } from '../services/loggerService';
// Temporarily define types locally for CI/CD pipeline
interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  message?: string;
  timestamp: Date;
  details?: any;
}

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  checks: Record<string, HealthCheckResult>;
}

interface ServiceInfo {
  name: string;
  version: string;
  environment: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    external: number;
  };
  cpu: {
    usage: number;
    load: number[];
  };
}

const router = Router();

// =============================================================================
// HEALTH CHECK ENDPOINTS
// =============================================================================

/**
 * GET /api/v1/health
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const healthStatus: HealthCheck = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {
        service: {
          status: 'healthy',
          message: 'HTMA LLM Router is running',
          timestamp: new Date()
        }
      }
    };

    logger.info('Health check requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', error);
    const errorResponse: HealthCheck = {
      status: 'unhealthy',
      timestamp: new Date(),
      checks: {
        service: {
          status: 'unhealthy',
          message: 'Health check failed',
          timestamp: new Date(),
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    };
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/health/ready
 * Readiness probe endpoint
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check if all required services are ready
    const readinessChecks: Record<string, HealthCheckResult> = {
      database: {
        status: 'healthy', // TODO: Implement actual database check
        message: 'Database connection ready',
        timestamp: new Date()
      },
      cache: {
        status: 'healthy', // TODO: Implement actual cache check
        message: 'Cache service ready',
        timestamp: new Date()
      },
      vertexAI: {
        status: 'healthy', // TODO: Implement actual Vertex AI check
        message: 'Vertex AI service ready',
        timestamp: new Date()
      },
      config: {
        status: 'healthy', // TODO: Implement actual config check
        message: 'Configuration loaded',
        timestamp: new Date()
      }
    };

    const allReady = Object.values(readinessChecks).every(check => check.status === 'healthy');

    if (allReady) {
      const readyResponse: HealthCheck = {
        status: 'healthy',
        timestamp: new Date(),
        checks: readinessChecks
      };
      res.status(200).json(readyResponse);
    } else {
      const notReadyResponse: HealthCheck = {
        status: 'degraded',
        timestamp: new Date(),
        checks: readinessChecks
      };
      res.status(503).json(notReadyResponse);
    }
  } catch (error) {
    logger.error('Readiness check failed', error);
    const errorResponse: HealthCheck = {
      status: 'unhealthy',
      timestamp: new Date(),
      checks: {
        readiness: {
          status: 'unhealthy',
          message: 'Readiness check failed',
          timestamp: new Date(),
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    };
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/health/live
 * Liveness probe endpoint
 */
router.get('/live', async (_req: Request, res: Response) => {
  try {
    // Simple liveness check - just check if the process is running
    const livenessResponse: HealthCheck = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {
        process: {
          status: 'healthy',
          message: 'Process is alive',
          timestamp: new Date(),
          details: {
            pid: process.pid,
            uptime: process.uptime()
          }
        }
      }
    };
    res.status(200).json(livenessResponse);
  } catch (error) {
    logger.error('Liveness check failed', error);
    const errorResponse: HealthCheck = {
      status: 'unhealthy',
      timestamp: new Date(),
      checks: {
        process: {
          status: 'unhealthy',
          message: 'Liveness check failed',
          timestamp: new Date(),
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    };
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/health/detailed
 * Detailed health check with service status
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const serviceInfo: ServiceInfo = {
      name: 'HTMA LLM Router',
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      },
      cpu: {
        usage: 0, // TODO: Implement actual CPU usage monitoring
        load: [0, 0, 0] // TODO: Implement actual load monitoring
      }
    };

    const detailedHealth: HealthCheck = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {
        service: {
          status: 'healthy',
          message: 'Service is healthy',
          timestamp: new Date(),
          details: serviceInfo
        },
        system: {
          status: 'healthy',
          message: 'System is healthy',
          timestamp: new Date(),
          details: {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            pid: process.pid
          }
        },
        environment: {
          status: 'healthy',
          message: 'Environment is configured',
          timestamp: new Date(),
          details: {
            NODE_ENV: process.env['NODE_ENV'],
            PORT: process.env['PORT'],
            LOG_LEVEL: process.env['LOG_LEVEL']
          }
        }
      }
    };

    logger.info('Detailed health check requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json(detailedHealth);
  } catch (error) {
    logger.error('Detailed health check failed', error);
    const errorResponse: HealthCheck = {
      status: 'unhealthy',
      timestamp: new Date(),
      checks: {
        service: {
          status: 'unhealthy',
          message: 'Detailed health check failed',
          timestamp: new Date(),
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    };
    res.status(500).json(errorResponse);
  }
});

export { router as healthController };
