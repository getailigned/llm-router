import { GoogleGenerativeAIConfig } from '../services/googleGenerativeAIService';

export const googleGenerativeAIConfig: GoogleGenerativeAIConfig = {
    apiKey: process.env['GOOGLE_GENERATIVE_AI_API_KEY'] || '',
    model: 'gemini-1.5-flash',
    maxRetries: 3,
    timeoutMs: 30000
};

// Environment variable overrides
export function getGoogleGenerativeAIConfig(): GoogleGenerativeAIConfig {
    return {
        apiKey: process.env['GOOGLE_GENERATIVE_AI_API_KEY'] || process.env['GOOGLE_API_KEY'] || googleGenerativeAIConfig.apiKey,
        model: process.env['GOOGLE_GENERATIVE_AI_MODEL'] || googleGenerativeAIConfig.model,
        maxRetries: parseInt(process.env['GOOGLE_GENERATIVE_AI_MAX_RETRIES'] || '3'),
        timeoutMs: parseInt(process.env['GOOGLE_GENERATIVE_AI_TIMEOUT_MS'] || '30000')
    };
}
