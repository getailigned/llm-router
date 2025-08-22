// =============================================================================
// LLM Router Service - Routing Service
// =============================================================================

import { createLogger } from './loggerService';
import { LLMRequest, LLMResponse, Model, RoutingConfiguration, RequestMetrics, ModelPriority, TaskRoutingRules } from '../types';
import { vertexAIService } from './vertexAIService';

export class RoutingService {
  private logger = createLogger('RoutingService');
  private routingConfig: RoutingConfiguration | null = null;
  private requestHistory: RequestMetrics[] = [];

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing routing service...');
      
      // Load routing configuration
      await this.loadRoutingConfiguration();
      
      // Initialize performance monitoring
      await this.initializePerformanceMonitoring();
      
      this.logger.info('Routing service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize routing service', error);
      throw error;
    }
  }

  private async loadRoutingConfiguration(): Promise<void> {
    try {
      // Load from Vertex AI service which has the config
      const models = await vertexAIService.listModels();
      
      // Create routing configuration based on available models
      this.routingConfig = {
        priorities: this.calculateModelPriorities(models),
        taskRouting: this.createTaskRoutingRules(models),
        costOptimization: {
          enabled: true,
          maxBudget: 100.0, // $100 max budget
          dailyLimit: 10.0, // $10 daily limit
          priorityModels: ['claude-4-sonnet', 'gemini-pro'], // Cost-effective models
          costThresholds: {
            'claude-4.1-opus': 0.15,
            'claude-4-sonnet': 0.03,
            'gemini-pro': 0.001
          }
        },
        fallbackStrategies: [
          {
            name: 'performance-fallback',
            conditions: ['high-latency', 'low-quality'],
            actions: ['switch-model', 'reduce-complexity'],
            priority: 1
          },
          {
            name: 'cost-fallback',
            conditions: ['high-cost', 'budget-exceeded'],
            actions: ['use-cheaper-model', 'limit-tokens'],
            priority: 2
          }
        ]
      };
      
      this.logger.info('Routing configuration loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load routing configuration', error);
      throw error;
    }
  }

  private calculateModelPriorities(models: Model[]): ModelPriority[] {
    const priorities: ModelPriority[] = [];
    
    for (const model of models) {
      let priority = 0;
      
      // Base priority on performance score
      priority += model.performance.qualityScore * 10;
      
      // Boost for high availability
      priority += model.availability.uptime * 5;
      
      // Reduce priority for high cost
      const avgCost = (model.pricing.inputTokensPer1K + model.pricing.outputTokensPer1K) / 2;
      priority -= avgCost * 100; // Penalize expensive models
      
      // Boost for recent performance updates
      const daysSinceUpdate = (Date.now() - model.performance.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) priority += 2; // Recent updates get boost
      
      priorities.push({
        priority: Math.max(0, priority),
        model: model.id,
        weight: model.performance.qualityScore,
        maxCost: avgCost * 1000, // Max cost for 1000 tokens
        enabled: model.enabled,
        useCases: model.capabilities.map(c => c.type),
        fallback: model.fallback || ''
      });
    }
    
    return priorities.sort((a, b) => b.priority - a.priority);
  }

  private createTaskRoutingRules(models: Model[]): TaskRoutingRules {
    const taskRouting: TaskRoutingRules = {};
    
    // Complex reasoning tasks - prefer high-quality models
    const complexReasoningModels = models
      .filter(m => m.performance.qualityScore > 0.8)
      .sort((a, b) => b.performance.qualityScore - a.performance.qualityScore)
      .map(m => m.id);
    
    taskRouting['complex-reasoning'] = {
      primary: complexReasoningModels.slice(0, 2),
      fallback: complexReasoningModels.slice(2),
      minQuality: 0.8,
      maxLatency: 10000, // 10 seconds
      maxCost: 0.10
    };
    
    // RAG operations - prefer models with good context handling
    const ragModels = models
      .filter(m => m.capabilities.some(c => c.type === 'rag'))
      .sort((a, b) => b.performance.qualityScore - a.performance.qualityScore)
      .map(m => m.id);
    
    taskRouting['rag-operations'] = {
      primary: ragModels.slice(0, 2),
      fallback: ragModels.slice(2),
      minQuality: 0.7,
      maxLatency: 15000, // 15 seconds
      maxCost: 0.08
    };
    
    // Fast response tasks - prefer low-latency models
    const fastResponseModels = models
      .filter(m => m.performance.averageLatency < 2000) // < 2 seconds
      .sort((a, b) => a.performance.averageLatency - b.performance.averageLatency)
      .map(m => m.id);
    
    taskRouting['fast-response'] = {
      primary: fastResponseModels.slice(0, 2),
      fallback: fastResponseModels.slice(2),
      minQuality: 0.6,
      maxLatency: 5000, // 5 seconds
      maxCost: 0.05
    };
    
    // Cost-sensitive tasks - prefer affordable models
    const costSensitiveModels = models
      .sort((a, b) => {
        const avgCostA = (a.pricing.inputTokensPer1K + a.pricing.outputTokensPer1K) / 2;
        const avgCostB = (b.pricing.inputTokensPer1K + b.pricing.outputTokensPer1K) / 2;
        return avgCostA - avgCostB;
      })
      .map(m => m.id);
    
    taskRouting['cost-sensitive'] = {
      primary: costSensitiveModels.slice(0, 2),
      fallback: costSensitiveModels.slice(2),
      minQuality: 0.5,
      maxLatency: 20000, // 20 seconds
      maxCost: 0.03
    };
    
    return taskRouting;
  }

  private async initializePerformanceMonitoring(): Promise<void> {
    // Initialize performance tracking
    this.logger.info('Performance monitoring initialized');
  }

  async routeRequest(request: LLMRequest): Promise<LLMResponse> {
    try {
      this.logger.info('Routing request', { 
        requestId: request.id, 
        useCase: request.useCase,
        complexity: request.complexity
      });

      // Start timing the request
      const startTime = Date.now();
      
      // Select the best model for this request
      const selectedModel = await this.selectOptimalModel(request);
      
      if (!selectedModel) {
        throw new Error('No suitable model available for this request');
      }
      
      this.logger.info('Selected model for request', { 
        requestId: request.id, 
        selectedModel: selectedModel.id 
      });

      // Execute the request using the selected model
      const response = await this.executeRequest(request, selectedModel);
      
      // Record metrics
      const duration = Date.now() - startTime;
      this.recordRequestMetrics(request, selectedModel, duration, true);
      
      // Update model performance
      await this.updateModelPerformance(selectedModel.id, duration, true);
      
      return response;
      
    } catch (error) {
      this.logger.error('Failed to route request', { 
        requestId: request.id, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Try fallback strategy
      return await this.handleFallback(request, error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  private async selectOptimalModel(request: LLMRequest): Promise<Model | null> {
    try {
      // Get available models
      const models = await vertexAIService.listModels();
      const availableModels = models.filter(m => m.availability.status === 'online' && m.enabled);
      
      if (availableModels.length === 0) {
        return null;
      }

      // Determine task type based on use case and complexity
      const taskType = this.determineTaskType(request.useCase, request.complexity);
      
      // Get task-specific routing
      const taskConfig = this.routingConfig?.taskRouting[taskType];
      if (taskConfig) {
        // Try primary models first
        for (const modelId of taskConfig.primary) {
          const model = availableModels.find(m => m.id === modelId);
          if (model && this.meetsRequirements(model, taskConfig)) {
            return model;
          }
        }
        
        // Try fallback models
        for (const modelId of taskConfig.fallback) {
          const model = availableModels.find(m => m.id === modelId);
          if (model && this.meetsRequirements(model, taskConfig)) {
            return model;
          }
        }
      }
      
      // Fallback to best available model
      const bestModel = availableModels.sort((a, b) => b.performance.qualityScore - a.performance.qualityScore)[0];
      return bestModel || null;
      
    } catch (error) {
      this.logger.error('Failed to select optimal model', error);
      return null;
    }
  }

  private determineTaskType(useCase?: string, complexity?: string): string {
    if (useCase) {
      if (useCase.includes('analysis') || useCase.includes('reasoning')) {
        return 'complex-reasoning';
      }
      if (useCase.includes('search') || useCase.includes('retrieval')) {
        return 'rag-operations';
      }
      if (useCase.includes('quick') || useCase.includes('urgent')) {
        return 'fast-response';
      }
    }
    
    if (complexity === 'expert' || complexity === 'complex') {
      return 'complex-reasoning';
    }
    
    return 'general';
  }

  private meetsRequirements(model: Model, taskConfig: any): boolean {
    if (taskConfig.minQuality && model.performance.qualityScore < taskConfig.minQuality) {
      return false;
    }
    
    if (taskConfig.maxLatency && model.performance.averageLatency > taskConfig.maxLatency) {
      return false;
    }
    
    if (taskConfig.maxCost) {
      const avgCost = (model.pricing.inputTokensPer1K + model.pricing.outputTokensPer1K) / 2;
      if (avgCost > taskConfig.maxCost) {
        return false;
      }
    }
    
    return true;
  }

  private async executeRequest(request: LLMRequest, model: Model): Promise<LLMResponse> {
    try {
      this.logger.info('Executing request with model', { 
        requestId: request.id, 
        modelId: model.id 
      });

      // Use Vertex AI service to generate response
      const response = await vertexAIService.generateText(request, model.id);

      return {
        id: `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestId: request.id,
        model: model.id,
        content: response.content,
        tokens: response.tokens,
        cost: this.calculateCost(response.tokens, model),
        latency: response.latency,
        quality: response.quality,
        timestamp: new Date(),
        metadata: {
          model: model.id,
          provider: model.provider,
          capabilities: model.capabilities.map(c => c.type)
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to execute request', { 
        requestId: request.id, 
        modelId: model.id, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  private calculateCost(tokens: { input: number; output: number; total: number }, model: Model): number {
    const inputCost = (tokens.input / 1000) * model.pricing.inputTokensPer1K;
    const outputCost = (tokens.output / 1000) * model.pricing.outputTokensPer1K;
    
    return inputCost + outputCost;
  }

  private async handleFallback(request: LLMRequest, originalError: Error): Promise<LLMResponse> {
    try {
      this.logger.info('Attempting fallback strategy', { 
        requestId: request.id, 
        originalError: originalError.message 
      });

      // Get fallback models based on strategy
      const fallbackModels = await this.getFallbackModels();
      
      for (const model of fallbackModels) {
        try {
          this.logger.info('Trying fallback model', { 
            requestId: request.id, 
            fallbackModel: model.id 
          });
          
          const response = await this.executeRequest(request, model);
          this.logger.info('Fallback successful', { 
            requestId: request.id, 
            fallbackModel: model.id 
          });
          
          return response;
          
        } catch (fallbackError) {
          this.logger.warn('Fallback model failed', { 
            requestId: request.id, 
            fallbackModel: model.id, 
            error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          });
          continue;
        }
      }
      
      // All fallbacks failed
      throw new Error('All fallback strategies failed');
      
    } catch (error) {
      this.logger.error('Fallback strategy failed', { 
        requestId: request.id, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Return error response
      return {
        id: `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestId: request.id,
        model: 'none',
        content: 'Service temporarily unavailable. Please try again later.',
        tokens: { input: 0, output: 0, total: 0 },
        cost: 0,
        latency: 0,
        quality: 0,
        timestamp: new Date(),
        metadata: {
          fallbackAttempted: true,
          originalError: originalError.message
        }
      };
    }
  }

  private async getFallbackModels(): Promise<Model[]> {
    try {
      const models = await vertexAIService.listModels();
      const availableModels = models.filter(m => m.availability.status === 'online' && m.enabled);
      
      // Sort by fallback strategy priority
      return availableModels.sort((a, b) => {
        const priorityA = this.routingConfig?.priorities.find(p => p.model === a.id)?.priority || 0;
        const priorityB = this.routingConfig?.priorities.find(p => p.model === b.id)?.priority || 0;
        return priorityB - priorityA;
      });
      
    } catch (error) {
      this.logger.error('Failed to get fallback models', error);
      return [];
    }
  }

  private recordRequestMetrics(_request: LLMRequest, _model: Model, duration: number, success: boolean): void {
    // Create a new metrics entry
    const metrics: RequestMetrics = {
      totalRequests: 1,
      successfulRequests: success ? 1 : 0,
      failedRequests: success ? 0 : 1,
      averageLatency: duration,
      averageCost: 0, // Will be calculated later
      totalCost: 0, // Will be calculated later
      successRate: success ? 1 : 0,
      timeRange: {
        start: new Date(),
        end: new Date()
      }
    };
    
    this.requestHistory.push(metrics);
    
    // Keep only last 1000 requests
    if (this.requestHistory.length > 1000) {
      this.requestHistory = this.requestHistory.slice(-1000);
    }
  }

  private async updateModelPerformance(modelId: string, duration: number, success: boolean): Promise<void> {
    try {
      await vertexAIService.updateModelPerformance(modelId, {
        averageLatency: duration,
        successRate: success ? 1 : 0,
        lastUpdated: new Date()
      });
    } catch (error) {
      this.logger.warn('Failed to update model performance', { 
        modelId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getRoutingStats(): Promise<any> {
    if (this.requestHistory.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        averageLatency: 0,
        modelUsage: {},
        taskTypeDistribution: {},
        recentRequests: []
      };
    }

    const totalRequests = this.requestHistory.length;
    const successfulRequests = this.requestHistory.reduce((sum, r) => sum + r.successfulRequests, 0);
    const totalLatency = this.requestHistory.reduce((sum, r) => sum + r.averageLatency, 0);
    
    return {
      totalRequests,
      successRate: successfulRequests / totalRequests,
      averageLatency: totalLatency / totalRequests,
      modelUsage: this.getModelUsageStats(),
      taskTypeDistribution: this.getTaskTypeDistribution(),
      recentRequests: this.requestHistory.slice(-10)
    };
  }

  private getModelUsageStats(): any {
    // For now, return empty stats since we don't track per-model usage in RequestMetrics
    return {};
  }

  private getTaskTypeDistribution(): any {
    // For now, return empty stats since we don't track task types in RequestMetrics
    return {};
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if routing configuration is loaded
      if (!this.routingConfig) {
        this.logger.warn('Routing configuration not loaded');
        return false;
      }
      
      // Check if we can access models
      const models = await vertexAIService.listModels();
      if (models.length === 0) {
        this.logger.warn('No models available');
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error('Routing service health check failed', error);
      return false;
    }
  }
}

export const routingService = new RoutingService();
export default routingService;
