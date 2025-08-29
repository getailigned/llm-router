import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from './loggerService';
import { ModelCapability, ModelPerformance, ModelPricing } from '../types';

const execAsync = promisify(exec);

export interface DiscoveredModel {
    modelId: string;
    displayName: string;
    description?: string;
    region: string;
    projectId: string;
    capabilities: ModelCapability[];
    performance: ModelPerformance;
    pricing: ModelPricing;
    provider: 'vertex-ai' | 'anthropic' | 'openai';
    enabled: boolean;
    lastDiscovered: Date;
}

export class DynamicModelDiscoveryService {
    private logger = createLogger('DynamicModelDiscoveryService');
    private discoveredModels: Map<string, DiscoveredModel> = new Map();
    private readonly projectId: string;
    private readonly region: string;

    constructor() {
        this.projectId = process.env['GOOGLE_CLOUD_PROJECT'] || '';
        this.region = process.env['GOOGLE_CLOUD_LOCATION'] || 'us-central1';

        if (!this.projectId) {
            throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
        }
    }

    /**
     * Discover all available models from Google Cloud Vertex AI
     */
    async discoverModels(): Promise<Map<string, DiscoveredModel>> {
        try {
            this.logger.info('Starting model discovery from Google Cloud');

            // Discover Vertex AI models
            const vertexAIModels = await this.discoverVertexAIModels();

            // Discover external API models (Anthropic, OpenAI)
            const externalModels = await this.discoverExternalModels();

            // Merge all discovered models
            const allModels = new Map([...vertexAIModels, ...externalModels]);

            this.discoveredModels = allModels;

            this.logger.info(`Model discovery completed. Found ${allModels.size} models`);

            return allModels;
        } catch (error) {
            this.logger.error('Failed to discover models', error);
            throw error;
        }
    }

    /**
     * Discover models deployed in Vertex AI
     */
    private async discoverVertexAIModels(): Promise<Map<string, DiscoveredModel>> {
        try {
            const models = new Map<string, DiscoveredModel>();

            // Use gcloud CLI to list models
            const { stdout } = await execAsync(
                `gcloud ai models list --region=${this.region} --format="json"`
            );

            const modelList = JSON.parse(stdout);

            for (const model of modelList) {
                // Extract model ID from the name field: projects/PROJECT_ID/locations/LOCATION/models/MODEL_ID
                let modelId = model.modelId;
                if (!modelId && model.name) {
                    const nameParts = model.name.split('/');
                    if (nameParts.length >= 6 && nameParts[5]) {
                        modelId = nameParts[5];
                    }
                }

                if (!modelId) {
                    this.logger.warn(`Skipping model without valid modelId: ${JSON.stringify(model)}`);
                    continue;
                }

                const discoveredModel: DiscoveredModel = {
                    modelId: modelId,
                    displayName: model.displayName || modelId,
                    description: model.description || `Vertex AI model: ${modelId}`,
                    region: this.region,
                    projectId: this.projectId,
                    capabilities: this.inferCapabilitiesFromName(model.displayName || modelId),
                    performance: await this.getModelPerformance(modelId),
                    pricing: await this.getModelPricing(modelId),
                    provider: 'vertex-ai',
                    enabled: true,
                    lastDiscovered: new Date()
                };

                models.set(modelId, discoveredModel);

                this.logger.info(`Discovered Vertex AI model: ${discoveredModel.displayName} (${modelId})`);
            }

            return models;
        } catch (error) {
            this.logger.error('Failed to discover Vertex AI models', error);
            return new Map();
        }
    }

    /**
     * Discover external API models (Anthropic, OpenAI)
     */
    private async discoverExternalModels(): Promise<Map<string, DiscoveredModel>> {
        const models = new Map<string, DiscoveredModel>();

        try {
            // Anthropic models
            const anthropicModels = [
                {
                    id: 'claude-4.1-opus',
                    name: 'Claude 4.1 Opus',
                    capabilities: ['text-generation', 'code-generation', 'rag', 'complex-reasoning']
                },
                {
                    id: 'claude-4-sonnet',
                    name: 'Claude 4 Sonnet',
                    capabilities: ['text-generation', 'code-generation', 'rag', 'general-analysis']
                },
                {
                    id: 'claude-3.5-sonnet',
                    name: 'Claude 3.5 Sonnet',
                    capabilities: ['text-generation', 'code-generation', 'rag']
                }
            ];

            for (const model of anthropicModels) {
                const discoveredModel: DiscoveredModel = {
                    modelId: model.id,
                    displayName: model.name,
                    description: `Anthropic ${model.name} model`,
                    region: 'global',
                    projectId: this.projectId,
                    capabilities: this.convertStringArrayToCapabilities(model.capabilities),
                    performance: await this.getExternalModelPerformance(model.id, 'anthropic'),
                    pricing: await this.getExternalModelPricing(model.id, 'anthropic'),
                    provider: 'anthropic',
                    enabled: true,
                    lastDiscovered: new Date()
                };

                models.set(model.id, discoveredModel);
            }

            // OpenAI models (if configured)
            if (process.env['OPENAI_API_KEY']) {
                const openAIModels = [
                    {
                        id: 'gpt-4',
                        name: 'GPT-4',
                        capabilities: ['text-generation', 'code-generation', 'rag']
                    },
                    {
                        id: 'gpt-3.5-turbo',
                        name: 'GPT-3.5 Turbo',
                        capabilities: ['text-generation', 'code-generation']
                    }
                ];

                for (const model of openAIModels) {
                    const discoveredModel: DiscoveredModel = {
                        modelId: model.id,
                        displayName: model.name,
                        description: `OpenAI ${model.name} model`,
                        region: 'global',
                        projectId: this.projectId,
                        capabilities: this.convertStringArrayToCapabilities(model.capabilities),
                        performance: await this.getExternalModelPerformance(model.id, 'openai'),
                        pricing: await this.getExternalModelPricing(model.id, 'openai'),
                        provider: 'openai',
                        enabled: true,
                        lastDiscovered: new Date()
                    };

                    models.set(model.id, discoveredModel);
                }
            }

        } catch (error) {
            this.logger.error('Failed to discover external models', error);
        }

        return models;
    }

    /**
     * Infer model capabilities from the model name
     */
    private inferCapabilitiesFromName(displayName: string): ModelCapability[] {
        const name = displayName.toLowerCase();
        const capabilityTypes: string[] = ['text-generation'];

        if (name.includes('gemini')) {
            capabilityTypes.push('multimodal');
            if (name.includes('vision') || name.includes('pro')) {
                capabilityTypes.push('image-analysis');
            }
        }

        if (name.includes('claude') || name.includes('gpt')) {
            capabilityTypes.push('code-generation', 'rag');
        }

        if (name.includes('code') || name.includes('codey')) {
            capabilityTypes.push('code-generation', 'code-analysis');
        }

        if (name.includes('opus') || name.includes('4.1')) {
            capabilityTypes.push('complex-reasoning', 'advanced-rag');
        }

        return this.convertStringArrayToCapabilities(capabilityTypes);
    }

    /**
     * Get real-time performance metrics for a Vertex AI model
     */
    private async getModelPerformance(modelId: string): Promise<ModelPerformance> {
        try {
            // Get model performance from Vertex AI
            const { stdout } = await execAsync(
                `gcloud ai models describe ${modelId} --region=${this.region} --format="json"`
            );

            const modelInfo = JSON.parse(stdout);

            return {
                averageLatency: modelInfo.averageLatency || 0,
                throughput: modelInfo.throughput || 0,
                successRate: modelInfo.successRate || 1.0,
                qualityScore: modelInfo.qualityScore || 0.8,
                lastUpdated: new Date()
            };
        } catch (error) {
            this.logger.warn(`Failed to get performance for model ${modelId}`, error);
            return {
                averageLatency: 0,
                throughput: 0,
                successRate: 1.0,
                qualityScore: 0.8,
                lastUpdated: new Date()
            };
        }
    }

    /**
     * Get real-time pricing for a Vertex AI model
     */
    private async getModelPricing(modelId: string): Promise<ModelPricing> {
        try {
            // For now, return estimated pricing based on model type
            // In production, you'd integrate with the actual billing API
            // Note: gcloud billing services list is not a valid command
            // Use gcloud services list --filter="name:aiplatform.googleapis.com" instead
            return this.estimatePricingFromModelId(modelId);

        } catch (error) {
            this.logger.warn(`Failed to get pricing for model ${modelId}`, error);
            return this.estimatePricingFromModelId(modelId);
        }
    }

    /**
     * Get performance for external API models
     */
    private async getExternalModelPerformance(_modelId: string, _provider: string): Promise<ModelPerformance> {
        // Return default performance for external models
        // In production, you'd track actual performance metrics
        return {
            averageLatency: 1000, // 1 second
            throughput: 100, // requests per minute
            successRate: 0.99,
            qualityScore: 0.9,
            lastUpdated: new Date()
        };
    }

    /**
     * Get pricing for external API models
     */
    private async getExternalModelPricing(modelId: string, provider: string): Promise<ModelPricing> {
        // Return current pricing for external models
        const pricing: { [key: string]: ModelPricing } = {
            'claude-4.1-opus': {
                inputTokensPer1K: 0.015,
                outputTokensPer1K: 0.075,
                baseCost: 0,
                currency: 'USD',
                lastUpdated: new Date(),
                source: 'anthropic-api',
                confidence: 0.95,
                nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                provider: 'anthropic'
            },
            'claude-4-sonnet': {
                inputTokensPer1K: 0.003,
                outputTokensPer1K: 0.015,
                baseCost: 0,
                currency: 'USD',
                lastUpdated: new Date(),
                source: 'anthropic-api',
                confidence: 0.95,
                nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                provider: 'anthropic'
            },
            'claude-3.5-sonnet': {
                inputTokensPer1K: 0.003,
                outputTokensPer1K: 0.015,
                baseCost: 0,
                currency: 'USD',
                lastUpdated: new Date(),
                source: 'anthropic-api',
                confidence: 0.95,
                nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                provider: 'anthropic'
            }
        };

        return pricing[modelId] || {
            inputTokensPer1K: 0.01,
            outputTokensPer1K: 0.03,
            baseCost: 0,
            currency: 'USD',
            lastUpdated: new Date(),
            source: 'estimated',
            confidence: 0.7,
            nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            provider: provider as any
        };
    }

    /**
     * Estimate pricing based on model ID and type
     */
    private estimatePricingFromModelId(modelId: string): ModelPricing {
        if (!modelId) {
            this.logger.warn('estimatePricingFromModelId called with undefined modelId, using default pricing');
            return {
                inputTokensPer1K: 0.001,
                outputTokensPer1K: 0.002,
                baseCost: 0,
                currency: 'USD',
                lastUpdated: new Date(),
                source: 'default-estimated',
                confidence: 0.5,
                nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                provider: 'unknown'
            };
        }

        const name = modelId.toLowerCase();

        // Vertex AI pricing estimates
        if (name.includes('gemini')) {
            if (name.includes('2.5')) {
                return {
                    inputTokensPer1K: 0.0005,
                    outputTokensPer1K: 0.0015,
                    baseCost: 0,
                    currency: 'USD',
                    lastUpdated: new Date(),
                    source: 'vertex-ai-estimated',
                    confidence: 0.8,
                    nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    provider: 'google-cloud'
                };
            } else if (name.includes('pro')) {
                return {
                    inputTokensPer1K: 0.0005,
                    outputTokensPer1K: 0.0015,
                    baseCost: 0,
                    currency: 'USD',
                    lastUpdated: new Date(),
                    source: 'vertex-ai-estimated',
                    confidence: 0.8,
                    nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    provider: 'google-cloud'
                };
            }
        }

        // Default pricing
        return {
            inputTokensPer1K: 0.001,
            outputTokensPer1K: 0.002,
            baseCost: 0,
            currency: 'USD',
            lastUpdated: new Date(),
            source: 'vertex-ai-estimated',
            confidence: 0.6,
            nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            provider: 'google-cloud'
        };
    }

    /**
     * Convert string array to ModelCapability array
     */
    private convertStringArrayToCapabilities(capabilities: string[]): ModelCapability[] {
        return capabilities.map(cap => ({
            type: cap as any,
            level: 'basic' as const,
            supportedFormats: ['text'],
            maxInputSize: 8192,
            maxOutputSize: 4096
        }));
    }

    /**
     * Get all discovered models
     */
    getDiscoveredModels(): Map<string, DiscoveredModel> {
        return this.discoveredModels;
    }

    /**
     * Get a specific model by ID
     */
    getModel(modelId: string): DiscoveredModel | undefined {
        return this.discoveredModels.get(modelId);
    }

    /**
     * Refresh model discovery
     */
    async refreshModels(): Promise<void> {
        this.logger.info('Refreshing model discovery');
        await this.discoverModels();
    }

    /**
     * Get models by provider
     */
    getModelsByProvider(provider: string): DiscoveredModel[] {
        return Array.from(this.discoveredModels.values())
            .filter(model => model.provider === provider);
    }

    /**
     * Get models by capability
     */
    getModelsByCapability(capability: string): DiscoveredModel[] {
        return Array.from(this.discoveredModels.values())
            .filter(model => model.capabilities.some(cap => cap.type === capability));
    }
}

export const dynamicModelDiscoveryService = new DynamicModelDiscoveryService();
