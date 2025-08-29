import { logger } from './loggerService';
import { ContextRoutingRequirements } from './contextAwareRoutingService';

export interface FallbackDecision {
    shouldFallback: boolean;
    targetModel: string;
    reason: string;
    confidence: number;
    estimatedCost: number;
    estimatedTime: number;
}

export interface FallbackTrigger {
    triggerType: 'error' | 'timeout' | 'quality_threshold' | 'cost_exceeded' | 'performance_degradation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    threshold: number;
    currentValue: number;
    timestamp: Date;
}

export interface ModelHealth {
    modelId: string;
    availability: number; // 0-1
    averageLatency: number; // milliseconds
    errorRate: number; // 0-1
    qualityScore: number; // 0-1
    costEfficiency: number; // 0-1
    lastUpdated: Date;
}

export interface FallbackStrategy {
    primaryModel: string;
    fallbackChain: string[];
    triggers: FallbackTrigger[];
    maxFallbacks: number;
    qualityThreshold: number;
    costLimit: number;
    timeoutLimit: number;
}

export class IntelligentFallbackService {
    private modelHealthCache: Map<string, ModelHealth>;
    private fallbackHistory: Map<string, FallbackDecision[]>;

    constructor() {
        this.modelHealthCache = new Map();
        this.fallbackHistory = new Map();
    }

    /**
     * Determine if fallback is needed and select the best fallback model
     */
    evaluateFallback(
        currentModel: string,
        context: ContextRoutingRequirements,
        trigger: FallbackTrigger,
        availableModels: string[]
    ): FallbackDecision {
        logger.info('Evaluating fallback decision', {
            context: 'IntelligentFallbackService',
            currentModel,
            triggerType: trigger.triggerType,
            severity: trigger.severity
        });

        // Check if fallback is appropriate
        if (!this.shouldTriggerFallback(trigger, context)) {
            return {
                shouldFallback: false,
                targetModel: currentModel,
                reason: 'Fallback not required',
                confidence: 1.0,
                estimatedCost: 0,
                estimatedTime: 0
            };
        }

        // Select best fallback model
        const fallbackModel = this.selectBestFallbackModel(
            currentModel,
            context,
            availableModels
        );

        if (!fallbackModel) {
            return {
                shouldFallback: false,
                targetModel: currentModel,
                reason: 'No suitable fallback model available',
                confidence: 0.0,
                estimatedCost: 0,
                estimatedTime: 0
            };
        }

        const decision: FallbackDecision = {
            shouldFallback: true,
            targetModel: fallbackModel,
            reason: this.generateFallbackReason(trigger, fallbackModel),
            confidence: this.calculateFallbackConfidence(fallbackModel, context),
            estimatedCost: this.estimateFallbackCost(fallbackModel),
            estimatedTime: this.estimateFallbackTime(fallbackModel)
        };

        // Log fallback decision
        logger.info('Fallback decision made', {
            context: 'IntelligentFallbackService',
            currentModel,
            fallbackModel,
            reason: decision.reason,
            confidence: decision.confidence
        });

        // Store fallback history
        this.storeFallbackHistory(currentModel, decision);

        return decision;
    }

    /**
     * Create intelligent fallback strategy based on context
     */
    createFallbackStrategy(context: ContextRoutingRequirements): FallbackStrategy {
        const strategy: FallbackStrategy = {
            primaryModel: 'claude-4-sonnet',
            fallbackChain: this.buildFallbackChain(context),
            triggers: this.createFallbackTriggers(context),
            maxFallbacks: this.determineMaxFallbacks(context),
            qualityThreshold: this.determineQualityThreshold(context),
            costLimit: context.costConstraints.maxCostPerRequest,
            timeoutLimit: this.determineTimeoutLimit(context)
        };

        logger.info('Fallback strategy created', {
            context: 'IntelligentFallbackService',
            primaryModel: strategy.primaryModel,
            fallbackChain: strategy.fallbackChain,
            maxFallbacks: strategy.maxFallbacks
        });

        return strategy;
    }

    /**
     * Update model health information
     */
    updateModelHealth(modelId: string, health: Partial<ModelHealth>): void {
        const currentHealth = this.modelHealthCache.get(modelId) || {
            modelId,
            availability: 1.0,
            averageLatency: 1000,
            errorRate: 0.0,
            qualityScore: 0.9,
            costEfficiency: 0.8,
            lastUpdated: new Date()
        };

        const updatedHealth: ModelHealth = {
            ...currentHealth,
            ...health,
            lastUpdated: new Date()
        };

        this.modelHealthCache.set(modelId, updatedHealth);

        logger.debug('Model health updated', {
            context: 'IntelligentFallbackService',
            modelId,
            health: updatedHealth
        });
    }

    /**
     * Get current model health status
     */
    getModelHealth(modelId: string): ModelHealth | undefined {
        return this.modelHealthCache.get(modelId);
    }

    /**
     * Get fallback recommendations for a specific context
     */
    getFallbackRecommendations(context: ContextRoutingRequirements): string[] {
        const recommendations: string[] = [];

        // High accuracy requirements prefer Claude models
        if (context.requiredAccuracy === 'critical') {
            recommendations.push('claude-3-5-sonnet', 'claude-4-sonnet');
        }

        // Cost-sensitive contexts prefer Gemini models
        if (context.costConstraints.costOptimizationLevel === 'cost-first') {
            recommendations.push('gemini-pro', 'gemini-flash', 'gemini-lite');
        }

        // Creative contexts prefer Gemini models
        if (context.modelPreferences.includes('gemini-2-5')) {
            recommendations.push('gemini-pro', 'gemini-flash');
        }

        // Remove duplicates and return
        return [...new Set(recommendations)];
    }

    private shouldTriggerFallback(trigger: FallbackTrigger, context: ContextRoutingRequirements): boolean {
        // Critical contexts are more sensitive to triggers
        const sensitivityMultiplier = context.requiredAccuracy === 'critical' ? 0.5 : 1.0;

        switch (trigger.triggerType) {
            case 'error':
                return trigger.severity === 'high' || trigger.severity === 'critical';

            case 'timeout':
                const timeoutThreshold = context.requiredPerformance === 'critical' ? 15000 : 30000;
                return trigger.currentValue > timeoutThreshold * sensitivityMultiplier;

            case 'quality_threshold':
                const qualityThreshold = context.requiredAccuracy === 'critical' ? 0.8 : 0.6;
                return trigger.currentValue < qualityThreshold;

            case 'cost_exceeded':
                return trigger.currentValue > context.costConstraints.maxCostPerRequest;

            case 'performance_degradation':
                return trigger.severity === 'high' || trigger.severity === 'critical';

            default:
                return false;
        }
    }

    private selectBestFallbackModel(
        currentModel: string,
        context: ContextRoutingRequirements,
        availableModels: string[]
    ): string | null {
        // Get fallback recommendations
        const recommendations = this.getFallbackRecommendations(context);

        // Filter available models
        const candidateModels = availableModels.filter(model =>
            model !== currentModel &&
            recommendations.includes(model)
        );

        if (candidateModels.length === 0) {
            return null;
        }

        // Score models based on context requirements
        const scoredModels = candidateModels.map(modelId => ({
            modelId,
            score: this.calculateModelScore(modelId, context)
        }));

        // Sort by score and return best
        scoredModels.sort((a, b) => b.score - a.score);
        return scoredModels[0]?.modelId || null;
    }

    private calculateModelScore(
        modelId: string,
        context: ContextRoutingRequirements
    ): number {
        let score = 0;
        const health = this.getModelHealth(modelId);

        if (!health) {
            return 0; // No health data available
        }

        // Availability score (30%)
        score += health.availability * 30;

        // Quality score (25%)
        if (context.requiredAccuracy === 'critical') {
            score += health.qualityScore * 25;
        } else {
            score += health.qualityScore * 20;
        }

        // Performance score (20%)
        if (context.requiredPerformance === 'critical') {
            score += (1 - health.averageLatency / 10000) * 20;
        } else {
            score += (1 - health.averageLatency / 10000) * 15;
        }

        // Cost efficiency score (15%)
        if (context.costConstraints.costOptimizationLevel === 'cost-first') {
            score += health.costEfficiency * 20;
        } else {
            score += health.costEfficiency * 10;
        }

        // Error rate penalty (10%)
        score -= health.errorRate * 10;

        return Math.max(0, score);
    }

    private buildFallbackChain(context: ContextRoutingRequirements): string[] {
        const chain: string[] = [];

        if (context.requiredAccuracy === 'critical') {
            // Critical accuracy: Claude models only
            chain.push('claude-3-5-sonnet', 'claude-4-sonnet');
        } else if (context.requiredAccuracy === 'high') {
            // High accuracy: Claude + Gemini Pro
            chain.push('claude-3-5-sonnet', 'gemini-pro', 'gemini-2-5');
        } else {
            // Medium/Low accuracy: Gemini models
            chain.push('gemini-pro', 'gemini-2-5', 'gemini-flash', 'gemini-lite');
        }

        return chain;
    }

    private createFallbackTriggers(context: ContextRoutingRequirements): FallbackTrigger[] {
        const triggers: FallbackTrigger[] = [
            {
                triggerType: 'error',
                severity: 'medium',
                threshold: 1,
                currentValue: 0,
                timestamp: new Date()
            },
            {
                triggerType: 'timeout',
                severity: 'medium',
                threshold: context.requiredPerformance === 'critical' ? 15000 : 30000,
                currentValue: 0,
                timestamp: new Date()
            },
            {
                triggerType: 'quality_threshold',
                severity: 'high',
                threshold: context.requiredAccuracy === 'critical' ? 0.8 : 0.6,
                currentValue: 1.0,
                timestamp: new Date()
            },
            {
                triggerType: 'cost_exceeded',
                severity: 'medium',
                threshold: context.costConstraints.maxCostPerRequest,
                currentValue: 0,
                timestamp: new Date()
            }
        ];

        return triggers;
    }

    private determineMaxFallbacks(context: ContextRoutingRequirements): number {
        if (context.requiredAccuracy === 'critical') {
            return 3; // Allow more fallbacks for critical tasks
        } else if (context.costConstraints.costOptimizationLevel === 'cost-first') {
            return 1; // Limit fallbacks for cost-sensitive tasks
        } else {
            return 2; // Default fallback limit
        }
    }

    private determineQualityThreshold(context: ContextRoutingRequirements): number {
        if (context.requiredAccuracy === 'critical') {
            return 0.9;
        } else if (context.requiredAccuracy === 'high') {
            return 0.8;
        } else if (context.requiredAccuracy === 'medium') {
            return 0.7;
        } else {
            return 0.6;
        }
    }

    private determineTimeoutLimit(context: ContextRoutingRequirements): number {
        if (context.requiredPerformance === 'critical') {
            return 15000; // 15 seconds
        } else if (context.requiredPerformance === 'high') {
            return 30000; // 30 seconds
        } else {
            return 60000; // 1 minute
        }
    }

    private generateFallbackReason(trigger: FallbackTrigger, fallbackModel: string): string {
        switch (trigger.triggerType) {
            case 'error':
                return `Primary model failed with ${trigger.severity} error, falling back to ${fallbackModel}`;
            case 'timeout':
                return `Primary model exceeded ${trigger.threshold}ms timeout, falling back to ${fallbackModel}`;
            case 'quality_threshold':
                return `Primary model quality below ${trigger.threshold} threshold, falling back to ${fallbackModel}`;
            case 'cost_exceeded':
                return `Primary model cost exceeded $${trigger.threshold}, falling back to ${fallbackModel}`;
            case 'performance_degradation':
                return `Primary model performance degraded, falling back to ${fallbackModel}`;
            default:
                return `Falling back to ${fallbackModel} due to ${trigger.triggerType}`;
        }
    }

    private calculateFallbackConfidence(fallbackModel: string, context: ContextRoutingRequirements): number {
        const health = this.getModelHealth(fallbackModel);
        if (!health) return 0.5; // Default confidence

        let confidence = 0.5; // Base confidence

        // Availability boost
        confidence += health.availability * 0.2;

        // Quality boost for accuracy requirements
        if (context.requiredAccuracy === 'critical') {
            confidence += health.qualityScore * 0.2;
        }

        // Performance boost for performance requirements
        if (context.requiredPerformance === 'critical') {
            confidence += (1 - health.averageLatency / 10000) * 0.1;
        }

        return Math.min(1.0, confidence);
    }

    private estimateFallbackCost(fallbackModel: string): number {
        // Mock cost estimation based on model type
        if (fallbackModel.includes('claude')) {
            return 0.003; // Claude models are more expensive
        } else if (fallbackModel.includes('gemini-2-5')) {
            return 0.0005; // Gemini 2.5
        } else if (fallbackModel.includes('gemini-pro')) {
            return 0.0005; // Gemini Pro
        } else {
            return 0.00025; // Gemini Flash/Lite
        }
    }

    private estimateFallbackTime(fallbackModel: string): number {
        // Mock time estimation based on model type
        if (fallbackModel.includes('claude')) {
            return 3000; // Claude models are slower but higher quality
        } else if (fallbackModel.includes('gemini-2-5')) {
            return 2000; // Gemini 2.5
        } else if (fallbackModel.includes('gemini-pro')) {
            return 1500; // Gemini Pro
        } else {
            return 1000; // Gemini Flash/Lite
        }
    }

    private storeFallbackHistory(currentModel: string, decision: FallbackDecision): void {
        if (!this.fallbackHistory.has(currentModel)) {
            this.fallbackHistory.set(currentModel, []);
        }

        const history = this.fallbackHistory.get(currentModel)!;
        history.push(decision);

        // Keep only last 10 fallback decisions
        if (history.length > 10) {
            history.shift();
        }
    }
}
