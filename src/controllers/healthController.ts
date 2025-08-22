// =============================================================================
// LLM Router Service - Health Controller
// =============================================================================

import { Router, Request, Response } from 'express';
import { logger } from '../services/loggerService';

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
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'HTMA LLM Router',
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    };

    logger.info('Health check requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/health/ready
 * Readiness probe endpoint
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check if all required services are ready
    const readinessChecks = {
      database: true, // TODO: Implement actual database check
      cache: true,    // TODO: Implement actual cache check
      vertexAI: true, // TODO: Implement actual Vertex AI check
      config: true    // TODO: Implement actual config check
    };

    const allReady = Object.values(readinessChecks).every(check => check);

    if (allReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: readinessChecks
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: readinessChecks
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', error);
    res.status(500).json({
      status: 'error',
      error: 'Readiness check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/health/live
 * Liveness probe endpoint
 */
router.get('/live', async (_req: Request, res: Response) => {
  try {
    // Simple liveness check - just check if the process is running
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Liveness check failed', error);
    res.status(500).json({
      status: 'error',
      error: 'Liveness check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/health/detailed
 * Detailed health check with service status
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'HTMA LLM Router',
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      uptime: process.uptime(),
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid
      },
      env: {
        NODE_ENV: process.env['NODE_ENV'],
        PORT: process.env['PORT'],
        LOG_LEVEL: process.env['LOG_LEVEL']
      }
    };

    logger.info('Detailed health check requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json(detailedHealth);
  } catch (error) {
    logger.error('Detailed health check failed', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Detailed health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as healthController };
