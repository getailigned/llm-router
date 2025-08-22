// =============================================================================
// LLM Router Service - Admin Controller (Placeholder)
// =============================================================================

import { Router, Request, Response } from 'express';
import { createLogger } from '../services/loggerService';

const router = Router();
const logger = createLogger('AdminController');

router.get('/dashboard', async (_req: Request, res: Response) => {
  logger.info('Admin dashboard endpoint called (placeholder)');
  res.status(501).json({
    message: 'Admin functionality not yet implemented',
    timestamp: new Date().toISOString()
  });
});

export { router as adminController };
