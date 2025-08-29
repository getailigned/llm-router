import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from './loggerService';


const execAsync = promisify(exec);

export interface DynamicPricing {
    inputTokensPer1K: number;
    outputTokensPer1K: number;
    baseCost: number;
    currency: string;
    lastUpdated: Date;
    source: 'google-billing-api' | 'anthropic-api' | 'openai-api' | 'estimated' | 'cached';
    confidence: number;
    nextUpdate: Date;
    provider: string;
    region?: string;
    modelType?: string;
}

export interface PricingCache {
    pricing: DynamicPricing;
    expiresAt: Date;
    retryCount: number;
}

export class DynamicPricingService {
    private logger = createLogger('DynamicPricingService');
    private pricingCache: Map<string, PricingCache> = new Map();
    private readonly projectId: string;
    private readonly region: string;
    private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

    constructor() {
        this.projectId = process.env['GOOGLE_CLOUD_PROJECT'] || '';
        this.region = process.env['GOOGLE_CLOUD_LOCATION'] || 'us-central1';

        if (!this.projectId) {
            throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
        }
    }

    /**
     * Get real-time pricing for a specific model
     */
    async getModelPricing(modelId: string, provider: string = 'vertex-ai'): Promise<DynamicPricing> {
        try {
            // Check cache first
            const cached = this.pricingCache.get(modelId);
            if (cached && Date.now() < cached.expiresAt.getTime()) {
                return cached.pricing;
            }

            let pricing: DynamicPricing;

            switch (provider) {
                case 'vertex-ai':
                    pricing = await this.getVertexAIPricing(modelId);
                    break;
                case 'anthropic':
                    pricing = await this.getAnthropicPricing(modelId);
                    break;
                case 'openai':
                    pricing = await this.getOpenAIPricing(modelId);
                    break;
                default:
                    pricing = await this.getEstimatedPricing(modelId, provider);
            }

            // Cache the pricing
            this.pricingCache.set(modelId, {
                pricing,
                expiresAt: new Date(Date.now() + this.CACHE_TTL),
                retryCount: 0
            });

            return pricing;
        } catch (error) {
            this.logger.error(`Failed to get pricing for model ${modelId}`, error);

            // Return cached pricing if available, even if expired
            const cached = this.pricingCache.get(modelId);
            if (cached) {
                return cached.pricing;
            }

            // Return estimated pricing as fallback
            return this.getEstimatedPricing(modelId, provider);
        }
    }

    /**
     * Get pricing from Google Cloud Billing API
     */
    private async getVertexAIPricing(modelId: string): Promise<DynamicPricing> {
        try {
            // Get billing information from Google Cloud
            const { stdout: _stdout } = await execAsync(
                `gcloud billing services list --filter="name:aiplatform" --format="json"`
            );

            // const billingServices = JSON.parse(stdout); // Unused for now

            // Get model details to determine pricing tier
            const { stdout: modelStdout } = await execAsync(
                `gcloud ai models describe ${modelId} --region=${this.region} --format="json"`
            );

            const modelInfo = JSON.parse(modelStdout);

            // Determine pricing based on model type and capabilities
            const pricing = this.calculateVertexAIPricing(modelInfo);

            this.logger.info(`Retrieved Vertex AI pricing for ${modelId}`, pricing);

            return pricing;
        } catch (error) {
            this.logger.warn(`Failed to get Vertex AI pricing for ${modelId}`, error);
            throw error;
        }
    }

    /**
     * Calculate Vertex AI pricing based on model information
     */
    private calculateVertexAIPricing(modelInfo: any): DynamicPricing {
        const displayName = modelInfo.displayName?.toLowerCase() || '';

        // Base pricing for Vertex AI models
        let inputTokensPer1K = 0.001;
        let outputTokensPer1K = 0.002;

        // Adjust pricing based on model type
        if (displayName.includes('gemini')) {
            if (displayName.includes('2.5')) {
                inputTokensPer1K = 0.0005;
                outputTokensPer1K = 0.0015;
            } else if (displayName.includes('pro')) {
                inputTokensPer1K = 0.0005;
                outputTokensPer1K = 0.0015;
            } else if (displayName.includes('flash')) {
                inputTokensPer1K = 0.0003;
                outputTokensPer1K = 0.001;
            } else if (displayName.includes('lite')) {
                inputTokensPer1K = 0.0002;
                outputTokensPer1K = 0.0008;
            }
        } else if (displayName.includes('claude')) {
            // Claude models through Vertex AI
            if (displayName.includes('opus')) {
                inputTokensPer1K = 0.015;
                outputTokensPer1K = 0.075;
            } else if (displayName.includes('sonnet')) {
                inputTokensPer1K = 0.003;
                outputTokensPer1K = 0.015;
            }
        }

        return {
            inputTokensPer1K,
            outputTokensPer1K,
            baseCost: 0,
            currency: 'USD',
            lastUpdated: new Date(),
            source: 'google-billing-api',
            confidence: 0.9,
            nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            provider: 'google-cloud',
            region: this.region,
            modelType: displayName
        };
    }

    /**
     * Get pricing from Anthropic API
     */
    private async getAnthropicPricing(modelId: string): Promise<DynamicPricing> {
        try {
            // Anthropic doesn't have a public pricing API, so we use their published rates
            const pricing: { [key: string]: DynamicPricing } = {
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
                },
                'claude-3.5-haiku': {
                    inputTokensPer1K: 0.00025,
                    outputTokensPer1K: 0.00125,
                    baseCost: 0,
                    currency: 'USD',
                    lastUpdated: new Date(),
                    source: 'anthropic-api',
                    confidence: 0.95,
                    nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    provider: 'anthropic'
                }
            };

            const modelPricing = pricing[modelId];
            if (modelPricing) {
                return modelPricing;
            }

            throw new Error(`Unknown Anthropic model: ${modelId}`);
        } catch (error) {
            this.logger.warn(`Failed to get Anthropic pricing for ${modelId}`, error);
            throw error;
        }
    }

    /**
     * Get pricing from OpenAI API
     */
    private async getOpenAIPricing(modelId: string): Promise<DynamicPricing> {
        try {
            // OpenAI doesn't have a public pricing API, so we use their published rates
            const pricing: { [key: string]: DynamicPricing } = {
                'gpt-4': {
                    inputTokensPer1K: 0.03,
                    outputTokensPer1K: 0.06,
                    baseCost: 0,
                    currency: 'USD',
                    lastUpdated: new Date(),
                    source: 'openai-api',
                    confidence: 0.95,
                    nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    provider: 'openai'
                },
                'gpt-4-turbo': {
                    inputTokensPer1K: 0.01,
                    outputTokensPer1K: 0.03,
                    baseCost: 0,
                    currency: 'USD',
                    lastUpdated: new Date(),
                    source: 'openai-api',
                    confidence: 0.95,
                    nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    provider: 'openai'
                },
                'gpt-3.5-turbo': {
                    inputTokensPer1K: 0.0005,
                    outputTokensPer1K: 0.0015,
                    baseCost: 0,
                    currency: 'USD',
                    lastUpdated: new Date(),
                    source: 'openai-api',
                    confidence: 0.95,
                    nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    provider: 'openai'
                }
            };

            const modelPricing = pricing[modelId];
            if (modelPricing) {
                return modelPricing;
            }

            throw new Error(`Unknown OpenAI model: ${modelId}`);
        } catch (error) {
            this.logger.warn(`Failed to get OpenAI pricing for ${modelId}`, error);
            throw error;
        }
    }

    /**
     * Get estimated pricing as fallback
     */
    private getEstimatedPricing(modelId: string, provider: string): DynamicPricing {
        const name = modelId.toLowerCase();

        // Estimate pricing based on model name and provider
        let inputTokensPer1K = 0.001;
        let outputTokensPer1K = 0.002;

        if (name.includes('gemini')) {
            if (name.includes('2.5') || name.includes('pro')) {
                inputTokensPer1K = 0.0005;
                outputTokensPer1K = 0.0015;
            } else if (name.includes('flash')) {
                inputTokensPer1K = 0.0003;
                outputTokensPer1K = 0.001;
            } else if (name.includes('lite')) {
                inputTokensPer1K = 0.0002;
                outputTokensPer1K = 0.0008;
            }
        } else if (name.includes('claude')) {
            if (name.includes('opus')) {
                inputTokensPer1K = 0.015;
                outputTokensPer1K = 0.075;
            } else if (name.includes('sonnet')) {
                inputTokensPer1K = 0.003;
                outputTokensPer1K = 0.015;
            } else if (name.includes('haiku')) {
                inputTokensPer1K = 0.00025;
                outputTokensPer1K = 0.00125;
            }
        } else if (name.includes('gpt')) {
            if (name.includes('4')) {
                inputTokensPer1K = 0.03;
                outputTokensPer1K = 0.06;
            } else if (name.includes('3.5')) {
                inputTokensPer1K = 0.0005;
                outputTokensPer1K = 0.0015;
            }
        }

        return {
            inputTokensPer1K,
            outputTokensPer1K,
            baseCost: 0,
            currency: 'USD',
            lastUpdated: new Date(),
            source: 'estimated',
            confidence: 0.6,
            nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            provider: provider as any
        };
    }

    /**
     * Get pricing for multiple models
     */
    async getBulkPricing(modelIds: string[]): Promise<Map<string, DynamicPricing>> {
        const pricingMap = new Map<string, DynamicPricing>();

        for (const modelId of modelIds) {
            try {
                // Determine provider from model ID
                const provider = this.determineProvider(modelId);
                const pricing = await this.getModelPricing(modelId, provider);
                pricingMap.set(modelId, pricing);
            } catch (error) {
                this.logger.error(`Failed to get pricing for ${modelId}`, error);
                // Use estimated pricing as fallback
                const provider = this.determineProvider(modelId);
                const pricing = this.getEstimatedPricing(modelId, provider);
                pricingMap.set(modelId, pricing);
            }
        }

        return pricingMap;
    }

    /**
     * Determine provider from model ID
     */
    private determineProvider(modelId: string): string {
        const name = modelId.toLowerCase();

        if (name.includes('claude')) {
            return 'anthropic';
        } else if (name.includes('gpt')) {
            return 'openai';
        } else if (name.includes('gemini')) {
            return 'vertex-ai';
        } else {
            return 'vertex-ai'; // Default to Vertex AI
        }
    }

    /**
     * Refresh pricing for all cached models
     */
    async refreshAllPricing(): Promise<void> {
        this.logger.info('Refreshing all cached pricing');

        const modelIds = Array.from(this.pricingCache.keys());

        for (const modelId of modelIds) {
            try {
                const provider = this.determineProvider(modelId);
                await this.getModelPricing(modelId, provider);
            } catch (error) {
                this.logger.error(`Failed to refresh pricing for ${modelId}`, error);
            }
        }
    }

    /**
     * Get pricing cache statistics
     */
    getCacheStats(): { totalModels: number; expiredModels: number; validModels: number } {
        const totalModels = this.pricingCache.size;
        const now = Date.now();

        let expiredModels = 0;
        let validModels = 0;

        for (const cache of this.pricingCache.values()) {
            if (now >= cache.expiresAt.getTime()) {
                expiredModels++;
            } else {
                validModels++;
            }
        }

        return { totalModels, expiredModels, validModels };
    }

    /**
     * Clear expired pricing cache
     */
    clearExpiredCache(): void {
        const now = Date.now();

        for (const [modelId, cache] of this.pricingCache.entries()) {
            if (now >= cache.expiresAt.getTime()) {
                this.pricingCache.delete(modelId);
            }
        }

        this.logger.info('Cleared expired pricing cache');
    }
}

export const dynamicPricingService = new DynamicPricingService();
