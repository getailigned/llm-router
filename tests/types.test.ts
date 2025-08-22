import { 
  LLMRequest, 
  LLMResponse, 
  Model, 
  RoutingDecision,
  LLMRouterError 
} from '../src/types';

describe('LLM Router Types', () => {
  describe('LLMRequest', () => {
    it('should have required properties', () => {
      const request: LLMRequest = {
        id: 'test-123',
        serviceId: 'service-1',
        serviceName: 'test-service',
        content: 'Test content',
        timestamp: new Date(),
      };

      expect(request.id).toBe('test-123');
      expect(request.serviceId).toBe('service-1');
      expect(request.serviceName).toBe('test-service');
      expect(request.content).toBe('Test content');
      expect(request.timestamp).toBeInstanceOf(Date);
    });

    it('should allow optional properties', () => {
      const request: LLMRequest = {
        id: 'test-123',
        serviceId: 'service-1',
        serviceName: 'test-service',
        content: 'Test content',
        timestamp: new Date(),
        useCase: 'testing',
        complexity: 'simple',
        securityLevel: 'public',
        maxTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
        priority: 1,
        budget: 0.01,
        correlationId: 'corr-123',
      };

      expect(request.useCase).toBe('testing');
      expect(request.complexity).toBe('simple');
      expect(request.securityLevel).toBe('public');
      expect(request.maxTokens).toBe(1000);
      expect(request.temperature).toBe(0.7);
      expect(request.topP).toBe(0.9);
      expect(request.priority).toBe(1);
      expect(request.budget).toBe(0.01);
      expect(request.correlationId).toBe('corr-123');
    });
  });

  describe('LLMResponse', () => {
    it('should have required properties', () => {
      const response: LLMResponse = {
        id: 'resp-123',
        requestId: 'req-123',
        model: 'gpt-4',
        content: 'Response content',
        tokens: {
          input: 10,
          output: 20,
          total: 30,
        },
        cost: 0.05,
        latency: 1500,
        quality: 0.95,
        timestamp: new Date(),
      };

      expect(response.id).toBe('resp-123');
      expect(response.requestId).toBe('req-123');
      expect(response.model).toBe('gpt-4');
      expect(response.content).toBe('Response content');
      expect(response.tokens.total).toBe(30);
      expect(response.cost).toBe(0.05);
      expect(response.latency).toBe(1500);
      expect(response.quality).toBe(0.95);
      expect(response.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Model', () => {
    it('should have required properties', () => {
      const model: Model = {
        id: 'model-1',
        name: 'GPT-4',
        provider: 'google',
        capabilities: [
          {
            type: 'text-generation',
            level: 'advanced',
            supportedFormats: ['text'],
            maxInputSize: 8192,
            maxOutputSize: 4096,
          },
        ],
        performance: {
          averageLatency: 1000,
          throughput: 100,
          successRate: 0.99,
          qualityScore: 0.95,
          lastUpdated: new Date(),
        },
        pricing: {
          inputTokensPer1K: 0.03,
          outputTokensPer1K: 0.06,
          baseCost: 0.01,
          currency: 'USD',
        },
        availability: {
          status: 'online',
          region: 'us-east1',
          uptime: 0.999,
          lastCheck: new Date(),
        },
        security: {
          dataRetention: '30 days',
          encryption: 'AES-256',
          compliance: ['SOC2', 'GDPR'],
          auditLogging: true,
        },
        enabled: true,
      };

      expect(model.id).toBe('model-1');
      expect(model.name).toBe('GPT-4');
      expect(model.provider).toBe('google');
      expect(model.capabilities).toHaveLength(1);
      expect(model.enabled).toBe(true);
    });
  });

  describe('RoutingDecision', () => {
    it('should have required properties', () => {
      const decision: RoutingDecision = {
        requestId: 'req-123',
        selectedModel: 'model-1',
        confidence: 0.95,
        reasoning: ['Best performance', 'Lowest cost'],
        alternatives: ['model-2', 'model-3'],
        estimatedCost: 0.05,
        estimatedLatency: 1000,
        timestamp: new Date(),
      };

      expect(decision.requestId).toBe('req-123');
      expect(decision.selectedModel).toBe('model-1');
      expect(decision.confidence).toBe(0.95);
      expect(decision.reasoning).toHaveLength(2);
      expect(decision.alternatives).toHaveLength(2);
      expect(decision.estimatedCost).toBe(0.05);
      expect(decision.estimatedLatency).toBe(1000);
    });
  });

  describe('LLMRouterError', () => {
    it('should have required properties', () => {
      // Create a mock error that implements the interface
      const error = {
        code: 'ROUTING_ERROR',
        message: 'Failed to route request',
        timestamp: new Date(),
        statusCode: 500,
        requestId: 'req-123',
        serviceId: 'service-1',
      } as LLMRouterError & { code: string; message: string; timestamp: Date };

      expect(error.statusCode).toBe(500);
      expect(error.requestId).toBe('req-123');
      expect(error.serviceId).toBe('service-1');
      expect(error.code).toBe('ROUTING_ERROR');
      expect(error.message).toBe('Failed to route request');
      expect(error.timestamp).toBeInstanceOf(Date);
    });
  });
});
