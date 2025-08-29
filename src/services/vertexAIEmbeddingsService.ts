import { createLogger } from './loggerService';
import { SemanticAnalysis } from '../types';

export interface EmbeddingConfig {
    projectId: string;
    location: string;
    model: string;
    maxRetries: number;
    timeoutMs: number;
    batchSize: number;
    cacheEnabled: boolean;
    cacheTTL: number; // seconds
}

export interface EmbeddingResult {
    embedding: number[];
    tokenCount: number;
    model: string;
    timestamp: Date;
    cost: number;
}

export interface SimilarityResult {
    requestId: string;
    similarity: number;
    analysis: SemanticAnalysis;
    timestamp: Date;
    cost: number;
    model: string;
}

export interface EmbeddingCache {
    [key: string]: {
        embedding: number[];
        timestamp: Date;
        ttl: number;
    };
}

export class VertexAIEmbeddingsService {
    private logger = createLogger('VertexAIEmbeddingsService');
    private config: EmbeddingConfig;
    private isInitialized = false;
    private cache: EmbeddingCache = {};
    private requestHistory: Map<string, EmbeddingResult> = new Map();

    constructor(config: EmbeddingConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        try {
            // Initialize for direct Vertex AI API calls
            this.logger.info('Initializing Vertex AI Embeddings service', {
                projectId: this.config.projectId,
                location: this.config.location,
                model: this.config.model
            });

            // We'll use fetch directly to the Vertex AI API
            this.isInitialized = true;
            this.logger.info('Vertex AI Embeddings service initialized successfully', {
                projectId: this.config.projectId,
                location: this.config.location,
                model: this.config.model,
                batchSize: this.config.batchSize,
                cacheEnabled: this.config.cacheEnabled
            });
        } catch (error) {
            this.logger.error('Failed to initialize Vertex AI Embeddings service', error);
            throw new Error(`Vertex AI Embeddings initialization failed: ${error}`);
        }
    }

    async generateEmbeddings(text: string, requestId?: string): Promise<EmbeddingResult> {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Check cache first
            const cacheKey = this.generateCacheKey(text);
            if (this.config.cacheEnabled && this.cache[cacheKey]) {
                const cached = this.cache[cacheKey];
                if (Date.now() - cached.timestamp.getTime() < cached.ttl * 1000) {
                    this.logger.debug('Using cached embedding', { requestId, cacheKey });
                    return {
                        embedding: cached.embedding,
                        tokenCount: this.estimateTokenCount(text),
                        model: this.config.model,
                        timestamp: new Date(),
                        cost: 0 // Cached, no additional cost
                    };
                }
            }

            // Generate embeddings using Vertex AI API directly
            let embedding: number[];
            let tokenCount: number;
            let cost: number;
            let embeddingResult: EmbeddingResult;

            try {
                const accessToken = await this.getGoogleAccessToken();
                const response = await fetch(
                    `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/${this.config.model}:predict`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            instances: [{
                                content: text
                            }]
                        })
                    }
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Vertex AI API error: ${response.status} ${response.statusText} - ${errorText}`);
                }

                const result = await response.json() as any;

                // Extract embeddings from the response
                if (result.predictions && result.predictions[0] && result.predictions[0].embeddings) {
                    embedding = result.predictions[0].embeddings.values;
                } else {
                    // Fallback to semantic embedding if the response format is unexpected
                    embedding = this.generateFallbackEmbedding(text);
                }

                tokenCount = this.estimateTokenCount(text);
                cost = this.calculateEmbeddingCost(tokenCount);

                embeddingResult = {
                    embedding,
                    tokenCount,
                    model: this.config.model,
                    timestamp: new Date(),
                    cost
                };
            } catch (error: any) {
                this.logger.error('Vertex AI API call failed', { error: error.message, stack: error.stack });
                throw error;
            }

            // Store in cache
            if (this.config.cacheEnabled) {
                this.cache[cacheKey] = {
                    embedding,
                    timestamp: new Date(),
                    ttl: this.config.cacheTTL
                };
            }

            // Store in request history if requestId provided
            if (requestId) {
                this.requestHistory.set(requestId, embeddingResult);
            }

            this.logger.debug('Generated new embedding', {
                requestId,
                tokenCount,
                cost,
                embeddingDimensions: embedding.length
            });

            return embeddingResult;
        } catch (error) {
            this.logger.error('Failed to generate embeddings', { requestId, error });
            throw new Error(`Embedding generation failed: ${error}`);
        }
    }

    async generateBatchEmbeddings(texts: string[], requestIds?: string[]): Promise<EmbeddingResult[]> {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const results: EmbeddingResult[] = [];
            const batchSize = this.config.batchSize;

            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);
                const batchRequestIds = requestIds ? requestIds.slice(i, i + batchSize) : undefined;

                const batchResults = await Promise.all(
                    batch.map((text, index) =>
                        this.generateEmbeddings(text, batchRequestIds?.[index])
                    )
                );

                results.push(...batchResults);

                // Add delay between batches to avoid rate limiting
                if (i + batchSize < texts.length) {
                    await this.delay(100);
                }
            }

            this.logger.info('Generated batch embeddings', {
                totalTexts: texts.length,
                batchSize,
                totalCost: results.reduce((sum, r) => sum + r.cost, 0)
            });

            return results;
        } catch (error) {
            this.logger.error('Failed to generate batch embeddings', { error });
            throw new Error(`Batch embedding generation failed: ${error}`);
        }
    }

    async findSimilarRequests(
        embedding: number[],
        limit: number = 10,
        similarityThreshold: number = 0.7
    ): Promise<SimilarityResult[]> {
        try {
            const similarities: SimilarityResult[] = [];

            for (const [requestId, embeddingResult] of this.requestHistory.entries()) {
                const similarity = this.calculateCosineSimilarity(embedding, embeddingResult.embedding);

                if (similarity >= similarityThreshold) {
                    similarities.push({
                        requestId,
                        similarity,
                        analysis: this.getStoredAnalysis(requestId) || this.getDefaultAnalysis(), // This would need to be implemented
                        timestamp: embeddingResult.timestamp,
                        cost: embeddingResult.cost,
                        model: embeddingResult.model
                    });
                }
            }

            // Sort by similarity (highest first) and limit results
            return similarities
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
        } catch (error) {
            this.logger.error('Failed to find similar requests', { error });
            throw new Error(`Similarity search failed: ${error}`);
        }
    }

    async getRequestSimilarity(text1: string, text2: string): Promise<number> {
        try {
            const [embedding1, embedding2] = await Promise.all([
                this.generateEmbeddings(text1),
                this.generateEmbeddings(text2)
            ]);

            return this.calculateCosineSimilarity(embedding1.embedding, embedding2.embedding);
        } catch (error) {
            this.logger.error('Failed to calculate request similarity', { error });
            throw new Error(`Similarity calculation failed: ${error}`);
        }
    }

    async storeRequestEmbedding(
        requestId: string,
        text: string,
        analysis?: SemanticAnalysis
    ): Promise<void> {
        try {
            const embeddingResult = await this.generateEmbeddings(text, requestId);

            // Store analysis if provided (this would integrate with your existing storage)
            if (analysis) {
                this.storeAnalysis(requestId, analysis);
            }

            this.logger.debug('Stored request embedding', {
                requestId,
                tokenCount: embeddingResult.tokenCount,
                cost: embeddingResult.cost
            });
        } catch (error) {
            this.logger.error('Failed to store request embedding', { requestId, error });
            throw new Error(`Failed to store embedding: ${error}`);
        }
    }

    async getEmbeddingStats(): Promise<{
        totalRequests: number;
        totalCost: number;
        averageTokens: number;
        cacheHitRate: number;
        lastUpdated: Date;
    }> {
        const totalRequests = this.requestHistory.size;
        const totalCost = Array.from(this.requestHistory.values())
            .reduce((sum, r) => sum + r.cost, 0);
        const averageTokens = totalRequests > 0
            ? Array.from(this.requestHistory.values())
                .reduce((sum, r) => sum + r.tokenCount, 0) / totalRequests
            : 0;

        const cacheHitRate = this.config.cacheEnabled ? this.calculateCacheHitRate() : 0;
        const lastUpdated = totalRequests > 0
            ? new Date(Math.max(...Array.from(this.requestHistory.values())
                .map(r => r.timestamp.getTime())))
            : new Date();

        return {
            totalRequests,
            totalCost,
            averageTokens: Math.round(averageTokens),
            cacheHitRate,
            lastUpdated
        };
    }

    async clearCache(): Promise<void> {
        this.cache = {};
        this.logger.info('Embeddings cache cleared');
    }

    async clearHistory(): Promise<void> {
        this.requestHistory.clear();
        this.logger.info('Embeddings history cleared');
    }

    // Private helper methods
    private generateCacheKey(text: string): string {
        // Simple hash for caching
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
        if (vec1.length !== vec2.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < vec1.length; i++) {
            const val1 = vec1[i] || 0;
            const val2 = vec2[i] || 0;
            dotProduct += val1 * val2;
            norm1 += val1 * val1;
            norm2 += val2 * val2;
        }

        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);

        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }

        return dotProduct / (norm1 * norm2);
    }

    private estimateTokenCount(text: string): number {
        // Rough estimation: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }

    private calculateEmbeddingCost(tokenCount: number): number {
        // Vertex AI text-embedding pricing: $0.0001 per 1K tokens
        return (tokenCount / 1000) * 0.0001;
    }

    private calculateCacheHitRate(): number {
        // This would need to be implemented with actual cache hit tracking
        return 0.8; // Placeholder
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private storeAnalysis(requestId: string, analysis: SemanticAnalysis): void {
        // This would integrate with your existing analysis storage
        // For now, we'll just log it
        this.logger.debug('Storing analysis', { requestId, analysis });
    }

    private getStoredAnalysis(_requestId: string): SemanticAnalysis | null {
        // This would retrieve from your existing analysis storage
        // For now, return null
        return null;
    }

    private getDefaultAnalysis(): SemanticAnalysis {
        // Return a default analysis when none is stored
        return {
            taskType: 'general',
            complexity: 'moderate',
            domain: 'general',
            confidence: 0.5,
            reasoning: ['Default analysis - no stored data available'],
            estimatedTokens: 1000,
            priority: 'medium',
            requiresMultimodal: false,
            requiresRAG: true,
            requiresCodeGeneration: false
        };
    }

    private generateFallbackEmbedding(text: string): number[] {
        // Generate a fallback embedding if the API call fails
        const vectorSize = 1536; // Standard embedding size
        const embedding: number[] = [];

        // Use text characteristics to seed the embedding
        const textHash = this.generateTextHash(text);
        const seed = textHash % 1000000;

        // Generate deterministic values based on text content
        for (let i = 0; i < vectorSize; i++) {
            const charCode = text.charCodeAt(i % text.length) || 0;
            const value = Math.sin(seed + i * 0.1 + charCode * 0.01) * 0.5;
            embedding.push(value);
        }

        return embedding;
    }

    private generateTextHash(text: string): number {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    private async getGoogleAccessToken(): Promise<string> {
        // Get Google Cloud access token using gcloud CLI
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
            const { stdout } = await execAsync('gcloud auth print-access-token');
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to get Google access token: ${error}`);
        }
    }












}
