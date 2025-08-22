// =============================================================================
// LLM Router Service - Config Controller (Placeholder)
// =============================================================================

import { Router, Request, Response } from 'express';
import { createLogger } from '../services/loggerService';

const router = Router();
const logger = createLogger('ConfigController');

router.get('/current', async (_req: Request, res: Response) => {
  logger.info('Config endpoint called (placeholder)');
  res.status(501).json({
    message: 'Config functionality not yet implemented',
    timestamp: new Date().toISOString()
  });
});

export { router as configController };
