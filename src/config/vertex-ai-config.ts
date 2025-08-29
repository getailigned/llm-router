import { VertexAIConfig } from '../services/vertexAISemanticAnalysisService';

export const vertexAIConfig: VertexAIConfig = {
    projectId: 'getaligned-469514',
    location: 'us-central1',
    model: '3815757247661735936', // gemini-flash model ID
    maxRetries: 3,
    timeoutMs: 30000
};

// Environment variable overrides
export function getVertexAIConfig(): VertexAIConfig {
    return {
        projectId: process.env['GOOGLE_CLOUD_PROJECT'] || process.env['VERTEX_AI_PROJECT_ID'] || vertexAIConfig.projectId,
        location: process.env['VERTEX_AI_LOCATION'] || vertexAIConfig.location,
        model: process.env['VERTEX_AI_MODEL'] || vertexAIConfig.model,
        maxRetries: parseInt(process.env['VERTEX_AI_MAX_RETRIES'] || '3'),
        timeoutMs: parseInt(process.env['VERTEX_AI_TIMEOUT_MS'] || '30000')
    };
}
