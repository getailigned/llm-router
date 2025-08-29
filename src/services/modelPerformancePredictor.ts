// =============================================================================
// LLM Router Service - Model Performance Predictor
// =============================================================================

import { createLogger } from './loggerService';
import { Model, RequestMetrics } from '../types';

// =============================================================================
// MODEL PERFORMANCE PREDICTOR SERVICE
// =============================================================================

export interface PerformancePrediction {
    modelId: string;
    predictedLatency: number;
    predictedQuality: number;
    predictedSuccessRate: number;
    confidence: number;
    factors: string[];
    recommendations: string[];
}

export interface ModelHealthScore {
    modelId: string;
    overallScore: number;
    latencyScore: number;
    qualityScore: number;
    availabilityScore: number;
    costScore: number;
    trend: 'improving' | 'stable' | 'declining';
    lastUpdated: Date;
}

export class ModelPerformancePredictor {
    private logger = createLogger('ModelPerformancePredictor');
    private performanceHistory: Map<string, RequestMetrics[]> = new Map();
    private healthScores: Map<string, ModelHealthScore> = new Map();
    private predictionModels: Map<string, any> = new Map();

    constructor() {
        this.logger.info('Model performance predictor initialized');
    }

    // =============================================================================
    // MAIN PREDICTION METHODS
    // =============================================================================

    /**
     * Predict performance for a specific model and request type
     */
    async predictPerformance(
        modelId: string,
        _requestType: string,
        _complexity: string,
        _expectedTokens: number
    ): Promise<PerformancePrediction> {
        try {
            const historicalData = this.performanceHistory.get(modelId) || [];
            const healthScore = this.healthScores.get(modelId);

            if (!healthScore) {
                return this.generateDefaultPrediction(modelId);
            }

            // Use ML model if available, otherwise use statistical prediction
            const prediction = await this.generateMLPrediction(
                modelId,
                _requestType,
                _complexity,
                _expectedTokens,
                historicalData
            );

            // Generate recommendations
            const recommendations = this.generateRecommendations(prediction, healthScore);

            return {
                ...prediction,
                recommendations
            };

        } catch (error) {
            this.logger.error('Failed to predict performance', error, { modelId });
            return this.generateDefaultPrediction(modelId);
        }
    }

    /**
     * Calculate comprehensive health score for a model
     */
    async calculateModelHealthScore(model: Model, recentMetrics: RequestMetrics[]): Promise<ModelHealthScore> {
        try {
            // Calculate individual component scores
            const latencyScore = this.calculateLatencyScore(recentMetrics);
            const qualityScore = this.calculateQualityScore(recentMetrics);
            const availabilityScore = this.calculateAvailabilityScore(model);
            const costScore = this.calculateCostScore(model, recentMetrics);

            // Calculate overall score with weighted components
            const overallScore = this.calculateWeightedScore({
                latency: latencyScore,
                quality: qualityScore,
                availability: availabilityScore,
                cost: costScore
            });

            // Determine trend
            const trend = this.calculateTrend(recentMetrics);

            const healthScore: ModelHealthScore = {
                modelId: model.id,
                overallScore,
                latencyScore,
                qualityScore,
                availabilityScore,
                costScore,
                trend,
                lastUpdated: new Date()
            };

            // Cache the health score
            this.healthScores.set(model.id, healthScore);

            return healthScore;

        } catch (error) {
            this.logger.error('Failed to calculate health score', error, { modelId: model.id });
            throw error;
        }
    }

    /**
     * Update performance history with new metrics
     */
    async updatePerformanceHistory(modelId: string, metrics: RequestMetrics): Promise<void> {
        try {
            if (!this.performanceHistory.has(modelId)) {
                this.performanceHistory.set(modelId, []);
            }

            const history = this.performanceHistory.get(modelId)!;
            history.push(metrics);

            // Keep only last 1000 metrics per model
            if (history.length > 1000) {
                history.splice(0, history.length - 1000);
            }

            // Update health score if we have enough data
            if (history.length >= 10) {
                await this.updateModelHealthScore(modelId);
            }

        } catch (error) {
            this.logger.error('Failed to update performance history', error, { modelId });
        }
    }

    /**
     * Get model recommendations based on current performance
     */
    async getModelRecommendations(
        _requestType: string,
        _complexity: string,
        _budget: number
    ): Promise<{
        primary: string[];
        fallback: string[];
        avoid: string[];
        reasoning: string;
    }> {
        try {
            const allModels = Array.from(this.healthScores.values());

            // Filter models by requirements
            const suitableModels = allModels.filter(model =>
                model.overallScore > 0.6 &&
                model.costScore > 0.5
            );

            // Sort by overall score
            const sortedModels = suitableModels.sort((a, b) => b.overallScore - a.overallScore);

            // Select primary models (top 2)
            const primary = sortedModels.slice(0, 2).map(m => m.modelId);

            // Select fallback models (next 3)
            const fallback = sortedModels.slice(2, 5).map(m => m.modelId);

            // Identify models to avoid (low scores or declining trends)
            const avoid = allModels
                .filter(m => m.overallScore < 0.4 || m.trend === 'declining')
                .map(m => m.modelId);

            const reasoning = this.generateRecommendationReasoning(primary, fallback, avoid);

            return {
                primary,
                fallback,
                avoid,
                reasoning
            };

        } catch (error) {
            this.logger.error('Failed to get model recommendations', error);
            return {
                primary: [],
                fallback: [],
                avoid: [],
                reasoning: 'Unable to generate recommendations due to insufficient data'
            };
        }
    }

    // =============================================================================
    // PREDICTION GENERATION METHODS
    // =============================================================================

    /**
     * Generate ML-based performance prediction
     */
    private async generateMLPrediction(
        modelId: string,
        _requestType: string,
        _complexity: string,
        _expectedTokens: number,
        _historicalData: RequestMetrics[]
    ): Promise<PerformancePrediction> {
        try {
            // Check if we have a trained ML model for this model
            if (this.predictionModels.has(modelId)) {
                return await this.useTrainedModel(
                    modelId,
                    _requestType,
                    _complexity,
                    _expectedTokens,
                    _historicalData
                );
            }

            // Fall back to statistical prediction
            return this.generateStatisticalPrediction(
                modelId,
                _requestType,
                _complexity,
                _expectedTokens,
                _historicalData
            );

        } catch (error) {
            this.logger.warn('ML prediction failed, using statistical fallback', error);
            return this.generateStatisticalPrediction(
                modelId,
                _requestType,
                _complexity,
                _expectedTokens,
                _historicalData
            );
        }
    }

    /**
     * Generate statistical performance prediction
     */
    private generateStatisticalPrediction(
        modelId: string,
        _requestType: string,
        _complexity: string,
        _expectedTokens: number,
        historicalData: RequestMetrics[]
    ): PerformancePrediction {
        if (historicalData.length === 0) {
            return this.generateDefaultPrediction(modelId);
        }

        // Filter by request type and complexity if available
        const relevantData = historicalData.filter(metric => {
            if (metric.requestType && metric.requestType !== _requestType) return false;
            if (metric.complexity && metric.complexity !== _complexity) return false;
            return true;
        });

        if (relevantData.length === 0) {
            relevantData.push(...historicalData); // Use all data if no relevant matches
        }

        // Calculate statistical predictions
        const latencies = relevantData.map(m => m.averageLatency).filter(l => l > 0);
        const qualities = relevantData.map(m => m.qualityScore).filter((q): q is number => q !== undefined && q > 0);
        const successRates = relevantData.map(m => m.successRate).filter(s => s > 0);

        const predictedLatency = latencies.length > 0 ?
            this.calculateWeightedAverage(latencies, 0.7) : 5000;

        const predictedQuality = qualities.length > 0 ?
            this.calculateWeightedAverage(qualities, 0.8) : 0.8;

        const predictedSuccessRate = successRates.length > 0 ?
            this.calculateWeightedAverage(successRates, 0.9) : 0.95;

        // Calculate confidence based on data quality
        const confidence = Math.min(0.95, 0.5 + (relevantData.length * 0.05));

        // Identify key factors
        const factors = this.identifyKeyFactors(relevantData, _requestType, _complexity);

        return {
            modelId,
            predictedLatency,
            predictedQuality,
            predictedSuccessRate,
            confidence,
            factors,
            recommendations: []
        };
    }

    /**
     * Use trained ML model for prediction
     */
    private async useTrainedModel(
        modelId: string,
        _requestType: string,
        _complexity: string,
        _expectedTokens: number,
        _historicalData: RequestMetrics[]
    ): Promise<PerformancePrediction> {
        // This would integrate with a real ML service
        // For now, return a placeholder
        return {
            modelId,
            predictedLatency: 3000,
            predictedQuality: 0.85,
            predictedSuccessRate: 0.92,
            confidence: 0.88,
            factors: ['ML model prediction', 'Historical patterns', 'Request characteristics'],
            recommendations: []
        };
    }

    /**
     * Generate default prediction for unknown models
     */
    private generateDefaultPrediction(modelId: string): PerformancePrediction {
        return {
            modelId,
            predictedLatency: 5000,
            predictedQuality: 0.8,
            predictedSuccessRate: 0.9,
            confidence: 0.5,
            factors: ['Default values', 'Insufficient data'],
            recommendations: ['Collect more performance data', 'Monitor model behavior']
        };
    }

    // =============================================================================
    // HEALTH SCORE CALCULATION METHODS
    // =============================================================================

    /**
     * Calculate latency score based on recent metrics
     */
    private calculateLatencyScore(metrics: RequestMetrics[]): number {
        if (metrics.length === 0) return 0.5;

        const recentMetrics = metrics.slice(-50); // Last 50 requests
        const latencies = recentMetrics.map(m => m.averageLatency).filter(l => l > 0);

        if (latencies.length === 0) return 0.5;

        const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

        // Score based on latency thresholds (lower is better)
        if (avgLatency < 1000) return 1.0;      // Excellent: < 1s
        if (avgLatency < 3000) return 0.9;      // Good: 1-3s
        if (avgLatency < 5000) return 0.7;      // Fair: 3-5s
        if (avgLatency < 10000) return 0.5;     // Poor: 5-10s
        return 0.3;                              // Very poor: > 10s
    }

    /**
     * Calculate quality score based on recent metrics
     */
    private calculateQualityScore(metrics: RequestMetrics[]): number {
        if (metrics.length === 0) return 0.5;

        const recentMetrics = metrics.slice(-50); // Last 50 requests
        const qualities = recentMetrics.map(m => m.qualityScore).filter((q): q is number => q !== undefined && q > 0);

        if (qualities.length === 0) return 0.5;

        const avgQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;

        // Quality score is already 0-1, just return it
        return avgQuality;
    }

    /**
     * Calculate availability score based on model status
     */
    private calculateAvailabilityScore(model: Model): number {
        return model.availability.uptime;
    }

    /**
     * Calculate cost score based on model pricing and usage
     */
    private calculateCostScore(_model: Model, metrics: RequestMetrics[]): number {
        if (metrics.length === 0) return 0.5;

        const recentMetrics = metrics.slice(-100); // Last 100 requests
        const totalCost = recentMetrics.reduce((sum, m) => sum + (m.totalCost || 0), 0);
        const avgCostPerRequest = totalCost / recentMetrics.length;

        // Score based on cost per request (lower is better)
        if (avgCostPerRequest < 0.01) return 1.0;     // Excellent: < $0.01
        if (avgCostPerRequest < 0.05) return 0.9;     // Good: $0.01-0.05
        if (avgCostPerRequest < 0.10) return 0.7;     // Fair: $0.05-0.10
        if (avgCostPerRequest < 0.25) return 0.5;     // Poor: $0.10-0.25
        return 0.3;                                   // Very poor: > $0.25
    }

    /**
     * Calculate weighted overall score
     */
    private calculateWeightedScore(scores: {
        latency: number;
        quality: number;
        availability: number;
        cost: number;
    }): number {
        // Weighted scoring with business priorities
        const weights = {
            latency: 0.25,      // 25% - User experience
            quality: 0.35,      // 35% - Output quality
            availability: 0.25, // 25% - Reliability
            cost: 0.15          // 15% - Cost efficiency
        };

        return (
            scores.latency * weights.latency +
            scores.quality * weights.quality +
            scores.availability * weights.availability +
            scores.cost * weights.cost
        );
    }

    /**
     * Calculate performance trend
     */
    private calculateTrend(metrics: RequestMetrics[]): 'improving' | 'stable' | 'declining' {
        if (metrics.length < 20) return 'stable';

        const recent = metrics.slice(-20);
        const older = metrics.slice(-40, -20);

        if (recent.length === 0 || older.length === 0) return 'stable';

        const recentAvgLatency = recent.reduce((sum, m) => sum + m.averageLatency, 0) / recent.length;
        const olderAvgLatency = older.reduce((sum, m) => sum + m.averageLatency, 0) / older.length;

        const recentAvgQuality = recent.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / recent.length;
        const olderAvgQuality = older.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / older.length;

        // Calculate improvement percentage
        const latencyImprovement = (olderAvgLatency - recentAvgLatency) / olderAvgLatency;
        const qualityImprovement = (recentAvgQuality - olderAvgQuality) / olderAvgQuality;

        const overallImprovement = (latencyImprovement + qualityImprovement) / 2;

        if (overallImprovement > 0.1) return 'improving';
        if (overallImprovement < -0.1) return 'declining';
        return 'stable';
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Calculate weighted average with recency bias
     */
    private calculateWeightedAverage(values: number[], recencyWeight: number): number {
        if (values.length === 0) return 0;

        let totalWeight = 0;
        let weightedSum = 0;

        for (let i = 0; i < values.length; i++) {
            const weight = Math.pow(recencyWeight, values.length - i - 1);
            if (values[i] !== undefined) {
                weightedSum += (values[i] || 0) * weight;
            }
            totalWeight += weight;
        }

        return weightedSum / totalWeight;
    }

    /**
     * Identify key factors affecting performance
     */
    private identifyKeyFactors(
        metrics: RequestMetrics[],
        requestType: string,
        complexity: string
    ): string[] {
        const factors: string[] = [];

        if (metrics.length > 0) {
            const avgLatency = metrics.reduce((sum, m) => sum + m.averageLatency, 0) / metrics.length;
            const avgQuality = metrics.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / metrics.length;

            if (avgLatency > 5000) factors.push('High latency detected');
            if (avgQuality < 0.7) factors.push('Quality issues observed');
            if (metrics.some(m => (m.errorRate || 0) > 0.1)) factors.push('Error rate concerns');
        }

        if (requestType) factors.push(`Request type: ${requestType}`);
        if (complexity) factors.push(`Complexity: ${complexity}`);

        return factors;
    }

    /**
     * Generate recommendations based on prediction and health
     */
    private generateRecommendations(
        prediction: PerformancePrediction,
        healthScore: ModelHealthScore
    ): string[] {
        const recommendations: string[] = [];

        if (prediction.predictedLatency > 8000) {
            recommendations.push('Consider using a faster model for time-sensitive requests');
        }

        if (prediction.predictedQuality < 0.7) {
            recommendations.push('Quality may be insufficient for complex tasks');
        }

        if (healthScore.trend === 'declining') {
            recommendations.push('Model performance is declining, consider alternatives');
        }

        if (healthScore.overallScore < 0.6) {
            recommendations.push('Model health is poor, monitor closely');
        }

        if (recommendations.length === 0) {
            recommendations.push('Model appears suitable for this request type');
        }

        return recommendations;
    }

    /**
     * Generate reasoning for model recommendations
     */
    private generateRecommendationReasoning(
        primary: string[],
        fallback: string[],
        avoid: string[]
    ): string {
        let reasoning = '';

        if (primary.length > 0) {
            reasoning += `Primary models (${primary.join(', ')}) selected for best performance and reliability. `;
        }

        if (fallback.length > 0) {
            reasoning += `Fallback models (${fallback.join(', ')}) available as alternatives. `;
        }

        if (avoid.length > 0) {
            reasoning += `Models to avoid (${avoid.join(', ')}) due to performance issues or declining health.`;
        }

        return reasoning;
    }

    /**
     * Update model health score
     */
    private async updateModelHealthScore(modelId: string): Promise<void> {
        try {
            const history = this.performanceHistory.get(modelId) || [];
            if (history.length < 10) return;

            // This would require access to the full model object
            // For now, we'll skip this update
            this.logger.debug('Skipping health score update - model object not available', { modelId });

        } catch (error) {
            this.logger.warn('Failed to update model health score', { error: error instanceof Error ? error.message : String(error), modelId });
        }
    }
}

// Export singleton instance
export const modelPerformancePredictor = new ModelPerformancePredictor();
