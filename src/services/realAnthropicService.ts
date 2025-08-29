// =============================================================================
// Real Anthropic API Service Integration
// =============================================================================

import { createLogger } from './loggerService';
import { LLMRequest, LLMResponse } from '../types';
import { apiConfig } from '../config/api-config';

export class RealAnthropicService {
    private logger: ReturnType<typeof createLogger>;
    private apiKey: string;
    private baseURL: string;
    private enabled: boolean;

    constructor() {
        this.logger = createLogger('RealAnthropicService');
        this.apiKey = apiConfig.anthropic.apiKey;
        this.baseURL = apiConfig.anthropic.baseURL;
        this.enabled = apiConfig.anthropic.enableRealAPI && !!this.apiKey;

        if (this.enabled) {
            this.logger.info('Real Anthropic API service enabled');
        } else {
            this.logger.warn('Real Anthropic API service disabled - using mock mode');
        }
    }

    /**
     * Generate text using real Anthropic API
     */
    async generateText(request: LLMRequest, modelId: string): Promise<LLMResponse> {
        if (!this.enabled) {
            throw new Error('Real Anthropic API service is disabled');
        }

        try {
            this.logger.info(`Generating text with Anthropic model: ${modelId}`, {
                requestId: request.id,
                contentLength: request.content.length
            });

            const startTime = Date.now();

            // Prepare the API request
            const apiRequest = {
                model: modelId,
                max_tokens: 4000,
                messages: [
                    {
                        role: 'user',
                        content: request.content
                    }
                ],
                temperature: 0.7,
                system: this.getSystemPrompt(request)
            };

            // Make the API call
            const response = await fetch(`${this.baseURL}/v1/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(apiRequest)
            });

            if (!response.ok) {
                throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
            }

            const responseData = await response.json() as any;
            const endTime = Date.now();
            const latency = endTime - startTime;

            // Extract response content
            const content = responseData.content?.[0]?.text || 'No content generated';

            // Estimate token usage (Anthropic doesn't always provide this in response)
            const inputTokens = Math.ceil(request.content.length / 4);
            const outputTokens = Math.ceil(content.length / 4);

            const result: LLMResponse = {
                id: `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                requestId: request.id,
                model: modelId,
                content,
                tokens: {
                    input: inputTokens,
                    output: outputTokens,
                    total: inputTokens + outputTokens
                },
                cost: this.calculateCost(inputTokens, outputTokens, modelId),
                latency,
                metadata: {
                    provider: 'anthropic',
                    apiVersion: '2023-06-01',
                    modelVersion: responseData.model || modelId
                },
                quality: 0.9,
                timestamp: new Date()
            };

            this.logger.info(`Anthropic API text generation completed`, {
                requestId: request.id,
                modelId,
                latency,
                tokens: result.tokens.total
            });

            return result;

        } catch (error) {
            this.logger.error(`Anthropic API text generation failed`, error, {
                requestId: request.id,
                modelId
            });
            throw error;
        }
    }

    /**
     * Get appropriate system prompt based on request context
     */
    private getSystemPrompt(request: LLMRequest): string {
        const basePrompt = 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.';

        // Enhance based on request complexity
        if (request.complexity === 'expert') {
            return `${basePrompt} Provide detailed, expert-level analysis with technical depth.`;
        } else if (request.complexity === 'complex') {
            return `${basePrompt} Provide comprehensive analysis with examples and explanations.`;
        } else if (request.complexity === 'moderate') {
            return `${basePrompt} Provide balanced analysis with key points and practical insights.`;
        } else {
            return `${basePrompt} Provide clear and concise responses.`;
        }
    }

    /**
     * Calculate cost based on token usage and model
     */
    private calculateCost(inputTokens: number, outputTokens: number, modelId: string): number {
        // Anthropic pricing (as of 2024, adjust as needed)
        const pricing = {
            'claude-4-1-opus': { input: 0.015, output: 0.075 },
            'claude-4-sonnet': { input: 0.003, output: 0.015 },
            'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
            'claude-3-haiku': { input: 0.00025, output: 0.00125 }
        };

        const modelPricing = pricing[modelId as keyof typeof pricing] || pricing['claude-3-5-sonnet'];

        return (inputTokens * modelPricing.input / 1000) + (outputTokens * modelPricing.output / 1000);
    }

    /**
     * Check if the service is available
     */
    async healthCheck(): Promise<boolean> {
        if (!this.enabled) return false;

        try {
            const response = await fetch(`${this.baseURL}/v1/models`, {
                method: 'GET',
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            });

            return response.ok;
        } catch (error) {
            this.logger.error('Anthropic API health check failed', error);
            return false;
        }
    }
}

export default RealAnthropicService;
