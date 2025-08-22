// =============================================================================
// LLM Router Service - Routing Controller
// =============================================================================

import { Router, Request, Response } from 'express';
import { createLogger } from '../services/loggerService';
import { routingService } from '../services/routingService';
import { LLMRequest, LLMResponse } from '../types';

const router = Router();
const logger = createLogger('RoutingController');

// =============================================================================
// ROUTING ENDPOINTS
// =============================================================================

// Route LLM request to optimal model
router.post('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    logger.info('Routing request received', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type')
    });

    // Validate request body
    const { content, useCase, complexity, maxTokens, temperature, priority, budget } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: content field is required and must be a string',
        timestamp: new Date().toISOString()
      });
    }

    // Create LLM request object
    const llmRequest: LLMRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      serviceId: 'llm-router',
      serviceName: 'HTMA LLM Router',
      content: content.trim(),
      useCase: useCase || undefined,
      complexity: complexity || 'moderate',
      maxTokens: maxTokens || undefined,
      temperature: temperature || undefined,
      priority: priority || 1,
      budget: budget || undefined,
      timestamp: new Date()
    };

    // Add correlationId if present
    if (req.headers['x-correlation-id']) {
      llmRequest.correlationId = req.headers['x-correlation-id'] as string;
    }

    logger.info('Processing LLM request', {
      requestId: llmRequest.id,
      contentLength: llmRequest.content.length,
      useCase: llmRequest.useCase,
      complexity: llmRequest.complexity
    });

    // Route the request using the routing service
    const response: LLMResponse = await routingService.routeRequest(llmRequest);
    
    const duration = Date.now() - startTime;
    
    logger.info('Request processed successfully', {
      requestId: llmRequest.id,
      responseId: response.id,
      model: response.model,
      duration,
      quality: response.quality,
      tokens: response.tokens.total,
      cost: response.cost
    });

    // Return the response
    return res.status(200).json({
      success: true,
      response: {
        id: response.id,
        content: response.content,
        model: response.model,
        tokens: response.tokens,
        cost: response.cost,
        latency: response.latency,
        quality: response.quality,
        timestamp: response.timestamp
      },
      metadata: {
        requestId: llmRequest.id,
        processingTime: duration,
        useCase: llmRequest.useCase,
        complexity: llmRequest.complexity
      }
    });

  } catch (error) {
    logger.error('Failed to process routing request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: req.ip
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId: req.body?.id || 'unknown'
    });
  }
});

// Get routing statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    logger.info('Routing statistics requested');
    
    const stats = await routingService.getRoutingStats();
    
    return res.status(200).json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get routing statistics', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve routing statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// Get available models
router.get('/models', async (_req: Request, res: Response) => {
  try {
    logger.info('Available models requested');
    
    // This would typically come from the Vertex AI service
    // For now, return the models from the routing configuration
    const stats = await routingService.getRoutingStats();
    
    return res.status(200).json({
      success: true,
      models: stats.modelUsage || {},
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get available models', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve available models',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check for routing service
router.get('/health', async (_req: Request, res: Response) => {
  try {
    logger.info('Routing service health check requested');
    
    const isHealthy = await routingService.healthCheck();
    
    if (isHealthy) {
      return res.status(200).json({
        status: 'healthy',
        service: 'routing',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(503).json({
        status: 'unhealthy',
        service: 'routing',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    logger.error('Routing service health check failed', error);
    
    return res.status(503).json({
      status: 'unhealthy',
      service: 'routing',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
