import { createLogger } from './loggerService';
import { DiscoveredModel } from './dynamicModelDiscoveryService';


export interface UseCaseProfile {
    useCase: string;
    confidence: number;
    reasoning: string[];
    performanceScore: number;
    costScore: number;
    capabilityScore: number;
    overallScore: number;
}

export interface ModelUseCaseMapping {
    modelId: string;
    displayName: string;
    provider: string;
    primaryUseCases: UseCaseProfile[];
    secondaryUseCases: UseCaseProfile[];
    specializedUseCases: UseCaseProfile[];
    avoidUseCases: string[];
    recommendations: string[];
}

export class UseCaseAnalysisService {
    private logger = createLogger('UseCaseAnalysisService');

    // Define all possible use cases with their requirements
    private readonly USE_CASES = {
        // High-complexity reasoning tasks
        'complex-reasoning': {
            requirements: ['complex-reasoning', 'advanced-rag', 'high-quality'],
            minQuality: 0.9,
            maxLatency: 15000,
            costTolerance: 'high',
            description: 'Complex analytical tasks requiring deep reasoning'
        },

        // Strategic planning and analysis
        'strategic-planning': {
            requirements: ['complex-reasoning', 'rag', 'high-quality'],
            minQuality: 0.85,
            maxLatency: 20000,
            costTolerance: 'medium',
            description: 'Strategic decision making and long-term planning'
        },

        // Research and analysis
        'research-analysis': {
            requirements: ['rag', 'complex-reasoning', 'high-quality'],
            minQuality: 0.8,
            maxLatency: 25000,
            costTolerance: 'medium',
            description: 'Deep research and comprehensive analysis'
        },

        // General business intelligence
        'business-intelligence': {
            requirements: ['rag', 'general-analysis', 'balanced'],
            minQuality: 0.75,
            maxLatency: 15000,
            costTolerance: 'medium',
            description: 'Business insights and data analysis'
        },

        // Document processing and analysis
        'document-processing': {
            requirements: ['rag', 'text-generation', 'balanced'],
            minQuality: 0.7,
            maxLatency: 20000,
            costTolerance: 'low',
            description: 'Document analysis and information extraction'
        },

        // Code generation and analysis
        'code-generation': {
            requirements: ['code-generation', 'code-analysis', 'balanced'],
            minQuality: 0.8,
            maxLatency: 30000,
            costTolerance: 'medium',
            description: 'Software development and code analysis'
        },

        // Fast response tasks
        'fast-response': {
            requirements: ['low-latency', 'balanced'],
            minQuality: 0.6,
            maxLatency: 5000,
            costTolerance: 'low',
            description: 'Quick responses with acceptable quality'
        },

        // Cost-sensitive operations
        'cost-sensitive': {
            requirements: ['low-cost', 'acceptable-quality'],
            minQuality: 0.5,
            maxLatency: 30000,
            costTolerance: 'very-low',
            description: 'Operations where cost is the primary concern'
        },

        // Multimodal tasks
        'multimodal': {
            requirements: ['multimodal', 'image-analysis', 'balanced'],
            minQuality: 0.7,
            maxLatency: 20000,
            costTolerance: 'medium',
            description: 'Tasks involving images, text, and other media'
        },

        // RAG operations
        'rag-operations': {
            requirements: ['rag', 'context-handling', 'balanced'],
            minQuality: 0.7,
            maxLatency: 25000,
            costTolerance: 'low',
            description: 'Retrieval-augmented generation tasks'
        },

        // Creative content generation
        'creative-generation': {
            requirements: ['text-generation', 'creative', 'balanced'],
            minQuality: 0.7,
            maxLatency: 20000,
            costTolerance: 'medium',
            description: 'Creative writing and content generation'
        },

        // Technical documentation
        'technical-docs': {
            requirements: ['code-generation', 'documentation', 'balanced'],
            minQuality: 0.75,
            maxLatency: 25000,
            costTolerance: 'low',
            description: 'Technical writing and documentation'
        }
    };

    /**
     * Analyze all discovered models and assign optimal use cases
     */
    async analyzeModelUseCases(models: Map<string, DiscoveredModel>): Promise<Map<string, ModelUseCaseMapping>> {
        const analysis = new Map<string, ModelUseCaseMapping>();

        this.logger.info(`Analyzing use cases for ${models.size} models`);

        for (const [modelId, model] of models) {
            try {
                const useCaseMapping = await this.analyzeSingleModel(model);
                analysis.set(modelId, useCaseMapping);

                this.logger.info(`Analyzed ${model.displayName}: ${useCaseMapping.primaryUseCases.length} primary use cases`);
            } catch (error) {
                this.logger.error(`Failed to analyze use cases for ${model.displayName}`, error);
            }
        }

        return analysis;
    }

    /**
     * Analyze a single model and determine its optimal use cases
     */
    private async analyzeSingleModel(model: DiscoveredModel): Promise<ModelUseCaseMapping> {
        const useCaseScores = new Map<string, UseCaseProfile>();

        // Score each use case for this model
        for (const [useCaseName, useCaseDef] of Object.entries(this.USE_CASES)) {
            const profile = this.scoreUseCaseForModel(model, useCaseName, useCaseDef);
            if (profile.overallScore > 0.3) { // Only include viable use cases
                useCaseScores.set(useCaseName, profile);
            }
        }

        // Sort use cases by overall score
        const sortedUseCases = Array.from(useCaseScores.entries())
            .sort(([, a], [, b]) => b.overallScore - a.overallScore);

        // Categorize use cases
        const primaryUseCases = sortedUseCases.slice(0, 3).map(([, profile]) => profile);
        const secondaryUseCases = sortedUseCases.slice(3, 6).map(([, profile]) => profile);
        const specializedUseCases = sortedUseCases.slice(6).map(([, profile]) => profile);

        // Determine use cases to avoid
        const avoidUseCases = this.determineAvoidUseCases(model, sortedUseCases);

        // Generate recommendations
        const recommendations = this.generateRecommendations(model, primaryUseCases, avoidUseCases);

        return {
            modelId: model.modelId,
            displayName: model.displayName,
            provider: model.provider,
            primaryUseCases,
            secondaryUseCases,
            specializedUseCases,
            avoidUseCases,
            recommendations
        };
    }

    /**
     * Score how well a model fits a specific use case
     */
    private scoreUseCaseForModel(
        model: DiscoveredModel,
        useCaseName: string,
        useCaseDef: any
    ): UseCaseProfile {
        const reasoning: string[] = [];

        // 1. Capability Score (0-1)
        const capabilityScore = this.calculateCapabilityScore(model, useCaseDef.requirements, reasoning);

        // 2. Performance Score (0-1)
        const performanceScore = this.calculatePerformanceScore(model, useCaseDef, reasoning);

        // 3. Cost Score (0-1)
        const costScore = this.calculateCostScore(model, useCaseDef.costTolerance, reasoning);

        // 4. Overall Score (weighted average)
        const overallScore = (capabilityScore * 0.4) + (performanceScore * 0.35) + (costScore * 0.25);

        // 5. Confidence based on data quality
        const confidence = this.calculateConfidence(model, reasoning);

        return {
            useCase: useCaseName,
            confidence,
            reasoning,
            performanceScore,
            costScore,
            capabilityScore,
            overallScore
        };
    }

    /**
     * Calculate capability score based on model capabilities
     */
    private calculateCapabilityScore(model: DiscoveredModel, requirements: string[], reasoning: string[]): number {
        let score = 0;
        let matchedRequirements = 0;

        for (const requirement of requirements) {
            if (this.modelMeetsRequirement(model, requirement)) {
                matchedRequirements++;
                score += 1;
            } else {
                reasoning.push(`Missing capability: ${requirement}`);
            }
        }

        const capabilityScore = matchedRequirements / requirements.length;

        if (capabilityScore > 0.8) {
            reasoning.push(`Excellent capability match: ${matchedRequirements}/${requirements.length} requirements met`);
        } else if (capabilityScore > 0.5) {
            reasoning.push(`Good capability match: ${matchedRequirements}/${requirements.length} requirements met`);
        } else {
            reasoning.push(`Limited capability match: ${matchedRequirements}/${requirements.length} requirements met`);
        }

        return capabilityScore;
    }

    /**
     * Check if model meets a specific requirement
     */
    private modelMeetsRequirement(model: DiscoveredModel, requirement: string): boolean {
        const capabilities = model.capabilities.map(c => c.type || c);
        const name = model.displayName.toLowerCase();

        switch (requirement) {
            case 'complex-reasoning':
                return name.includes('opus') || name.includes('4.1') || capabilities.includes('complex-reasoning');

            case 'advanced-rag':
                return name.includes('opus') || name.includes('4.1') || capabilities.includes('advanced-rag');

            case 'high-quality':
                return model.performance.qualityScore >= 0.85;

            case 'balanced':
                return model.performance.qualityScore >= 0.7 && model.performance.qualityScore < 0.85;

            case 'low-latency':
                return model.performance.averageLatency <= 2000;

            case 'low-cost':
                const avgCost = (model.pricing.inputTokensPer1K + model.pricing.outputTokensPer1K) / 2;
                return avgCost <= 0.001;

            case 'multimodal':
                return capabilities.includes('multimodal') || capabilities.includes('image-analysis');

            case 'image-analysis':
                return capabilities.includes('image-analysis') || name.includes('vision');

            case 'code-generation':
                return capabilities.includes('code-generation');

            case 'code-analysis':
                return capabilities.includes('code-analysis') || capabilities.includes('code-generation');

            case 'rag':
                return capabilities.includes('rag') || capabilities.includes('advanced-rag');

            case 'context-handling':
                return capabilities.includes('rag') || capabilities.includes('advanced-rag');

            case 'creative':
                return capabilities.includes('text-generation') && !capabilities.includes('code-generation');

            case 'documentation':
                return capabilities.includes('text-generation') || capabilities.includes('code-generation');

            default:
                // Check if requirement is a valid capability type
                return capabilities.includes(requirement as any) || name.includes(requirement);
        }
    }

    /**
     * Calculate performance score based on use case requirements
     */
    private calculatePerformanceScore(model: DiscoveredModel, useCaseDef: any, reasoning: string[]): number {
        let score = 0;
        let factors = 0;

        // Quality score
        if (model.performance.qualityScore >= useCaseDef.minQuality) {
            score += 1;
            reasoning.push(`Quality requirement met: ${model.performance.qualityScore} >= ${useCaseDef.minQuality}`);
        } else {
            reasoning.push(`Quality requirement not met: ${model.performance.qualityScore} < ${useCaseDef.minQuality}`);
        }
        factors++;

        // Latency score
        if (model.performance.averageLatency <= useCaseDef.maxLatency) {
            score += 1;
            reasoning.push(`Latency requirement met: ${model.performance.averageLatency}ms <= ${useCaseDef.maxLatency}ms`);
        } else {
            reasoning.push(`Latency requirement not met: ${model.performance.averageLatency}ms > ${useCaseDef.maxLatency}ms`);
        }
        factors++;

        // Success rate
        if (model.performance.successRate >= 0.95) {
            score += 0.5;
            reasoning.push(`High success rate: ${(model.performance.successRate * 100).toFixed(1)}%`);
        } else if (model.performance.successRate >= 0.9) {
            score += 0.25;
            reasoning.push(`Good success rate: ${(model.performance.successRate * 100).toFixed(1)}%`);
        } else {
            reasoning.push(`Low success rate: ${(model.performance.successRate * 100).toFixed(1)}%`);
        }
        factors += 0.5;

        return score / factors;
    }

    /**
     * Calculate cost score based on cost tolerance
     */
    private calculateCostScore(model: DiscoveredModel, costTolerance: string, reasoning: string[]): number {
        const avgCost = (model.pricing.inputTokensPer1K + model.pricing.outputTokensPer1K) / 2;

        let score = 0;

        switch (costTolerance) {
            case 'very-low':
                if (avgCost <= 0.0005) {
                    score = 1;
                    reasoning.push(`Excellent for very-low cost tolerance: $${avgCost.toFixed(6)}/token`);
                } else if (avgCost <= 0.001) {
                    score = 0.8;
                    reasoning.push(`Good for very-low cost tolerance: $${avgCost.toFixed(6)}/token`);
                } else {
                    score = 0.2;
                    reasoning.push(`Too expensive for very-low cost tolerance: $${avgCost.toFixed(6)}/token`);
                }
                break;

            case 'low':
                if (avgCost <= 0.001) {
                    score = 1;
                    reasoning.push(`Excellent for low cost tolerance: $${avgCost.toFixed(6)}/token`);
                } else if (avgCost <= 0.005) {
                    score = 0.8;
                    reasoning.push(`Good for low cost tolerance: $${avgCost.toFixed(6)}/token`);
                } else {
                    score = 0.4;
                    reasoning.push(`Moderate for low cost tolerance: $${avgCost.toFixed(6)}/token`);
                }
                break;

            case 'medium':
                if (avgCost <= 0.01) {
                    score = 1;
                    reasoning.push(`Excellent for medium cost tolerance: $${avgCost.toFixed(6)}/token`);
                } else if (avgCost <= 0.05) {
                    score = 0.8;
                    reasoning.push(`Good for medium cost tolerance: $${avgCost.toFixed(6)}/token`);
                } else {
                    score = 0.6;
                    reasoning.push(`Acceptable for medium cost tolerance: $${avgCost.toFixed(6)}/token`);
                }
                break;

            case 'high':
                if (avgCost <= 0.05) {
                    score = 1;
                    reasoning.push(`Excellent for high cost tolerance: $${avgCost.toFixed(6)}/token`);
                } else if (avgCost <= 0.1) {
                    score = 0.8;
                    reasoning.push(`Good for high cost tolerance: $${avgCost.toFixed(6)}/token`);
                } else {
                    score = 0.7;
                    reasoning.push(`Acceptable for high cost tolerance: $${avgCost.toFixed(6)}/token`);
                }
                break;

            default:
                score = 0.5;
                reasoning.push(`Unknown cost tolerance: ${costTolerance}`);
        }

        return score;
    }

    /**
     * Calculate confidence in the analysis
     */
    private calculateConfidence(model: DiscoveredModel, reasoning: string[]): number {
        let confidence = 0.5; // Base confidence

        // Boost confidence based on data quality
        if (model.performance.lastUpdated) {
            const daysSinceUpdate = (Date.now() - model.performance.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate < 1) confidence += 0.2;
            else if (daysSinceUpdate < 7) confidence += 0.1;
        }

        // Boost confidence based on pricing source
        if (model.pricing.source === 'anthropic-api' || model.pricing.source === 'openai-api') {
            confidence += 0.1;
        } else if (model.pricing.source === 'google-billing-api') {
            confidence += 0.15;
        }

        // Reduce confidence if we have many reasoning points (indicating uncertainty)
        if (reasoning.length > 5) confidence -= 0.1;

        return Math.min(1, Math.max(0, confidence));
    }

    /**
     * Determine use cases to avoid for this model
     */
    private determineAvoidUseCases(model: DiscoveredModel, sortedUseCases: [string, UseCaseProfile][]): string[] {
        const avoidUseCases: string[] = [];

        // Avoid use cases where the model scored very low
        for (const [useCaseName, profile] of sortedUseCases) {
            if (profile.overallScore < 0.3) {
                avoidUseCases.push(useCaseName);
            }
        }

        // Avoid use cases that don't match the model's strengths
        // const modelStrengths = this.identifyModelStrengths(model); // Unused for now
        // const modelWeaknesses = this.identifyModelWeaknesses(model); // Unused for now

        for (const [useCaseName, useCaseDef] of Object.entries(this.USE_CASES)) {
            if (avoidUseCases.includes(useCaseName)) continue;

            // Check if use case requires capabilities the model lacks
            const hasRequiredCapabilities = useCaseDef.requirements.every(req =>
                this.modelMeetsRequirement(model, req)
            );

            if (!hasRequiredCapabilities) {
                avoidUseCases.push(useCaseName);
            }
        }

        return avoidUseCases;
    }



    /**
     * Generate recommendations for the model
     */
    private generateRecommendations(
        model: DiscoveredModel,
        primaryUseCases: UseCaseProfile[],
        _avoidUseCases: string[]
    ): string[] {
        const recommendations: string[] = [];

        // Primary use case recommendations
        if (primaryUseCases.length > 0) {
            const topUseCase = primaryUseCases[0];
            if (topUseCase) {
                recommendations.push(`Primary use case: ${topUseCase.useCase} (Score: ${(topUseCase.overallScore * 100).toFixed(1)}%)`);
            }
        }

        // Performance recommendations
        if (model.performance.qualityScore < 0.8) {
            recommendations.push('Consider for less quality-critical tasks');
        }

        if (model.performance.averageLatency > 3000) {
            recommendations.push('Best for non-time-critical operations');
        }

        // Cost recommendations
        const avgCost = (model.pricing.inputTokensPer1K + model.pricing.outputTokensPer1K) / 2;
        if (avgCost > 0.01) {
            recommendations.push('Use for high-value, complex tasks');
        } else if (avgCost < 0.001) {
            recommendations.push('Excellent for high-volume, cost-sensitive operations');
        }

        // Capability recommendations
        if (model.capabilities.length < 3) {
            recommendations.push('Specialized model - use for specific tasks');
        } else {
            recommendations.push('Versatile model - good for multiple use cases');
        }

        return recommendations;
    }

    /**
     * Get optimal model for a specific use case
     */
    getOptimalModelForUseCase(
        useCase: string,
        modelAnalysis: Map<string, ModelUseCaseMapping>
    ): ModelUseCaseMapping | null {
        let bestModel: ModelUseCaseMapping | null = null;
        let bestScore = 0;

        for (const [, analysis] of modelAnalysis) {
            const primaryUseCase = analysis.primaryUseCases.find(uc => uc.useCase === useCase);
            if (primaryUseCase && primaryUseCase.overallScore > bestScore) {
                bestScore = primaryUseCase.overallScore;
                bestModel = analysis;
            }
        }

        return bestModel;
    }

    /**
     * Get all models suitable for a use case
     */
    getModelsForUseCase(
        useCase: string,
        modelAnalysis: Map<string, ModelUseCaseMapping>
    ): ModelUseCaseMapping[] {
        const suitableModels: ModelUseCaseMapping[] = [];

        for (const [, analysis] of modelAnalysis) {
            const useCaseProfile = analysis.primaryUseCases.find(uc => uc.useCase === useCase) ||
                analysis.secondaryUseCases.find(uc => uc.useCase === useCase);

            if (useCaseProfile && useCaseProfile.overallScore > 0.5) {
                suitableModels.push(analysis);
            }
        }

        // Sort by overall score
        return suitableModels.sort((a, b) => {
            const scoreA = a.primaryUseCases.find(uc => uc.useCase === useCase)?.overallScore || 0;
            const scoreB = b.primaryUseCases.find(uc => uc.useCase === useCase)?.overallScore || 0;
            return scoreB - scoreA;
        });
    }
}

export const useCaseAnalysisService = new UseCaseAnalysisService();
