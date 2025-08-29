import { EmbeddingConfig } from '../services/vertexAIEmbeddingsService';

export const embeddingsConfig: EmbeddingConfig = {
    projectId: 'getaligned-469514',
    location: 'us-central1', // Using us-central1 where models are available
    model: 'gemini-embedding-001', // Using the proper Gemini embedding model
    maxRetries: 3,
    timeoutMs: 30000,
    batchSize: 5, // Optimize for cost and rate limits
    cacheEnabled: true,
    cacheTTL: 3600 // 1 hour cache TTL
};

// Environment variable overrides
export function getEmbeddingsConfig(): EmbeddingConfig {
    return {
        projectId: process.env['GOOGLE_CLOUD_PROJECT'] || process.env['EMBEDDINGS_PROJECT_ID'] || embeddingsConfig.projectId,
        location: process.env['EMBEDDINGS_LOCATION'] || embeddingsConfig.location,
        model: process.env['EMBEDDINGS_MODEL'] || embeddingsConfig.model,
        maxRetries: parseInt(process.env['EMBEDDINGS_MAX_RETRIES'] || '3'),
        timeoutMs: parseInt(process.env['EMBEDDINGS_TIMEOUT_MS'] || '30000'),
        batchSize: parseInt(process.env['EMBEDDINGS_BATCH_SIZE'] || '5'),
        cacheEnabled: process.env['EMBEDDINGS_CACHE_ENABLED'] !== 'false',
        cacheTTL: parseInt(process.env['EMBEDDINGS_CACHE_TTL'] || '3600')
    };
}

// Cost optimization presets
export const costOptimizedConfig: EmbeddingConfig = {
    ...embeddingsConfig,
    batchSize: 10, // Larger batches for cost efficiency
    cacheTTL: 7200, // 2 hour cache for longer retention
    cacheEnabled: true
};

export const performanceOptimizedConfig: EmbeddingConfig = {
    ...embeddingsConfig,
    batchSize: 3, // Smaller batches for faster response
    cacheTTL: 1800, // 30 minute cache for fresh data
    cacheEnabled: true
};

export const budgetConstrainedConfig: EmbeddingConfig = {
    ...embeddingsConfig,
    batchSize: 20, // Maximum batch size for cost efficiency
    cacheTTL: 14400, // 4 hour cache for maximum reuse
    cacheEnabled: true
};
