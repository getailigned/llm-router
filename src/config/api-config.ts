// =============================================================================
// API Configuration for Real LLM Service Integration
// =============================================================================

export interface APIConfig {
    // Google Cloud / Vertex AI
    googleCloud: {
        projectId: string;
        location: string;
        credentials: string;
        enableRealAPI: boolean;
    };

    // Anthropic
    anthropic: {
        apiKey: string;
        enableRealAPI: boolean;
        baseURL: string;
    };

    // OpenAI
    openai: {
        apiKey: string;
        enableRealAPI: boolean;
        baseURL: string;
    };

    // General Settings
    general: {
        timeoutMs: number;
        maxRetries: number;
        enableFallback: boolean;
        mockMode: boolean;
    };
}

export const apiConfig: APIConfig = {
    googleCloud: {
        projectId: process.env['GOOGLE_CLOUD_PROJECT_ID'] || 'getaligned-469514',
        location: process.env['GOOGLE_CLOUD_LOCATION'] || 'us-central1',
        credentials: process.env['GOOGLE_APPLICATION_CREDENTIALS'] || '',
        enableRealAPI: process.env['ENABLE_GOOGLE_REAL_API'] === 'true'
    },

    anthropic: {
        apiKey: process.env['ANTHROPIC_API_KEY'] || '',
        enableRealAPI: process.env['ENABLE_ANTHROPIC_REAL_API'] === 'true',
        baseURL: process.env['ANTHROPIC_BASE_URL'] || 'https://api.anthropic.com'
    },

    openai: {
        apiKey: process.env['OPENAI_API_KEY'] || '',
        enableRealAPI: process.env['ENABLE_OPENAI_REAL_API'] === 'true',
        baseURL: process.env['OPENAI_BASE_URL'] || 'https://api.openai.com'
    },

    general: {
        timeoutMs: parseInt(process.env['API_TIMEOUT_MS'] || '30000'),
        maxRetries: parseInt(process.env['API_MAX_RETRIES'] || '3'),
        enableFallback: process.env['ENABLE_API_FALLBACK'] !== 'false',
        mockMode: process.env['MOCK_MODE'] === 'true'
    }
};

export default apiConfig;
