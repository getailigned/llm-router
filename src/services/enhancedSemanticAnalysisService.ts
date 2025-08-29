import { createLogger } from './loggerService';
import { SemanticAnalysis, AttachmentAnalysis } from '../types';
import { VertexAISemanticAnalysisService } from './vertexAISemanticAnalysisService';
import { GoogleGenerativeAISemanticAnalysisService } from './googleGenerativeAIService';
import { VertexAIEmbeddingsService, EmbeddingConfig } from './vertexAIEmbeddingsService';

export interface EnhancedAnalysisConfig {
    // Primary analysis method
    primaryMethod: 'vertex-ai' | 'google-generative-ai' | 'hybrid';

    // Embeddings configuration
    embeddingsEnabled: boolean;
    embeddingsConfig: EmbeddingConfig;

    // Cost optimization
    maxCostPerRequest: number;
    enableFallback: boolean;

    // Analysis thresholds
    confidenceThreshold: number;
    similarityThreshold: number;

    // Caching
    enableAnalysisCache: boolean;
    analysisCacheTTL: number;
}

export interface EnhancedAnalysisResult extends SemanticAnalysis {
    // Enhanced fields
    embeddingGenerated: boolean;
    similarRequestsFound: number;
    analysisMethod: string;
    totalCost: number;
    confidenceBoost: number;
    reasoning: string[];
}

export class EnhancedSemanticAnalysisService {
    private logger = createLogger('EnhancedSemanticAnalysisService');
    private config: EnhancedAnalysisConfig;

    // Services
    private vertexAIService?: VertexAISemanticAnalysisService;
    private googleGenerativeAIService?: GoogleGenerativeAISemanticAnalysisService;
    private embeddingsService?: VertexAIEmbeddingsService;

    // Cache for analysis results
    private analysisCache: Map<string, { result: EnhancedAnalysisResult; timestamp: Date }> = new Map();

    constructor(config: EnhancedAnalysisConfig) {
        this.config = config;
        this.initializeServices();
    }

    private async initializeServices(): Promise<void> {
        try {
            // Initialize embeddings service if enabled
            if (this.config.embeddingsEnabled) {
                this.embeddingsService = new VertexAIEmbeddingsService(this.config.embeddingsConfig);
                await this.embeddingsService.initialize();
                this.logger.info('Embeddings service initialized successfully');
            }

            // Initialize primary analysis service
            if (this.config.primaryMethod === 'vertex-ai') {
                // This would need the Vertex AI config
                this.logger.info('Vertex AI service will be initialized on first use');
            } else if (this.config.primaryMethod === 'google-generative-ai') {
                // This would need the Google Generative AI config
                this.logger.info('Google Generative AI service will be initialized on first use');
            }

            this.logger.info('Enhanced semantic analysis service initialized', {
                primaryMethod: this.config.primaryMethod,
                embeddingsEnabled: this.config.embeddingsEnabled,
                maxCostPerRequest: this.config.maxCostPerRequest
            });
        } catch (error) {
            this.logger.error('Failed to initialize enhanced semantic analysis service', error);
            throw error;
        }
    }

    async analyzeRequest(
        content: string,
        metadata?: any,
        attachments?: any[],
        requestId?: string
    ): Promise<EnhancedAnalysisResult> {
        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(content, attachments);
            if (this.config.enableAnalysisCache && this.analysisCache.has(cacheKey)) {
                const cached = this.analysisCache.get(cacheKey)!;
                if (Date.now() - cached.timestamp.getTime() < this.config.analysisCacheTTL * 1000) {
                    this.logger.debug('Using cached analysis result', { requestId, cacheKey });
                    return cached.result;
                }
            }

            // Perform enhanced analysis
            const result = await this.performEnhancedAnalysis(content, metadata, attachments, requestId);

            // Store in cache
            if (this.config.enableAnalysisCache) {
                this.analysisCache.set(cacheKey, {
                    result,
                    timestamp: new Date()
                });
            }

            return result;
        } catch (error) {
            this.logger.error('Enhanced analysis failed', { requestId, error });
            throw error;
        }
    }

    private async performEnhancedAnalysis(
        content: string,
        metadata?: any,
        attachments?: any[],
        requestId?: string
    ): Promise<EnhancedAnalysisResult> {
        let baseAnalysis: SemanticAnalysis | undefined;
        let analysisMethod = 'fallback';
        let totalCost = 0;

        try {
            // Step 1: Try primary AI analysis
            if (this.config.primaryMethod === 'vertex-ai') {
                try {
                    // Initialize service if needed
                    if (!this.vertexAIService) {
                        // This would need proper config initialization
                        this.logger.warn('Vertex AI service not properly configured, using fallback');
                        throw new Error('Vertex AI service not configured');
                    }

                    baseAnalysis = await this.vertexAIService.analyzeRequest(content, metadata, attachments);
                    analysisMethod = 'vertex-ai';
                    totalCost += 0.001; // Estimated cost for Vertex AI analysis
                } catch (error) {
                    this.logger.warn('Vertex AI analysis failed, trying Google Generative AI', error);
                    throw error;
                }
            }

            if (this.config.primaryMethod === 'google-generative-ai') {
                try {
                    // Initialize service if needed
                    if (!this.googleGenerativeAIService) {
                        // This would need proper config initialization
                        this.logger.warn('Google Generative AI service not properly configured, using fallback');
                        throw new Error('Google Generative AI service not configured');
                    }

                    baseAnalysis = await this.googleGenerativeAIService.analyzeRequest(content, metadata, attachments);
                    analysisMethod = 'google-generative-ai';
                    totalCost += 0.0005; // Estimated cost for Google Generative AI analysis
                } catch (error) {
                    this.logger.warn('Google Generative AI analysis failed, using fallback', error);
                    throw error;
                }
            }

            // Step 2: Fallback to rule-based analysis
            if (!baseAnalysis) {
                baseAnalysis = await this.performRuleBasedAnalysis(content, attachments);
                analysisMethod = 'rule-based';
                totalCost = 0;
            }

            // Step 3: Generate embeddings if enabled and within cost limits
            let embeddingGenerated = false;
            let similarRequestsFound = 0;
            let confidenceBoost = 0;

            if (this.config.embeddingsEnabled &&
                this.embeddingsService &&
                totalCost < this.config.maxCostPerRequest) {
                try {
                    const embeddingResult = await this.embeddingsService.generateEmbeddings(content, requestId);
                    totalCost += embeddingResult.cost;
                    embeddingGenerated = true;

                    // Find similar requests
                    const similarRequests = await this.embeddingsService.findSimilarRequests(
                        embeddingResult.embedding,
                        5,
                        this.config.similarityThreshold
                    );
                    similarRequestsFound = similarRequests.length;

                    // Boost confidence based on similar requests
                    if (similarRequests.length > 0) {
                        const avgSimilarity = similarRequests.reduce((sum, r) => sum + r.similarity, 0) / similarRequests.length;
                        confidenceBoost = Math.min(0.2, avgSimilarity * 0.3); // Max 20% boost
                    }

                    this.logger.debug('Embeddings analysis completed', {
                        requestId,
                        similarRequestsFound,
                        confidenceBoost,
                        embeddingCost: embeddingResult.cost
                    });
                } catch (error) {
                    this.logger.warn('Embeddings generation failed, continuing without', error);
                }
            }

            // Step 4: Enhance analysis with embeddings insights
            const enhancedAnalysis: EnhancedAnalysisResult = {
                ...baseAnalysis,
                embeddingGenerated,
                similarRequestsFound,
                analysisMethod,
                totalCost,
                confidenceBoost,
                confidence: Math.min(1.0, baseAnalysis.confidence + confidenceBoost),
                reasoning: [
                    ...baseAnalysis.reasoning,
                    `Analysis method: ${analysisMethod}`,
                    `Embeddings generated: ${embeddingGenerated}`,
                    `Similar requests found: ${similarRequestsFound}`,
                    `Confidence boost: ${(confidenceBoost * 100).toFixed(1)}%`
                ]
            };

            this.logger.info('Enhanced analysis completed', {
                requestId,
                method: analysisMethod,
                totalCost,
                confidence: enhancedAnalysis.confidence,
                similarRequestsFound
            });

            return enhancedAnalysis;

        } catch (error) {
            this.logger.error('All analysis methods failed, using basic fallback', error);

            // Ultimate fallback
            const fallbackAnalysis = await this.performRuleBasedAnalysis(content, attachments);

            return {
                ...fallbackAnalysis,
                embeddingGenerated: false,
                similarRequestsFound: 0,
                analysisMethod: 'fallback',
                totalCost: 0,
                confidenceBoost: 0,
                reasoning: [
                    ...fallbackAnalysis.reasoning,
                    'Analysis method: fallback (all methods failed)',
                    'Embeddings generated: false',
                    'Similar requests found: 0'
                ]
            };
        }
    }

    private async performRuleBasedAnalysis(content: string, attachments?: any[]): Promise<SemanticAnalysis> {
        // Simple rule-based analysis as fallback
        const domain = this.detectDomain(content);
        const taskType = this.detectTaskType(content);
        const complexity = this.assessComplexity(content, attachments);

        return {
            taskType,
            complexity,
            domain,
            confidence: 0.3,
            reasoning: ['Rule-based fallback analysis'],
            estimatedTokens: this.estimateTokens(content, complexity),
            priority: 'medium',
            requiresMultimodal: attachments?.some(a => a.contentType?.startsWith('image/')) || false,
            requiresRAG: true,
            requiresCodeGeneration: taskType === 'code-generation',
            attachments: attachments ? this.analyzeAttachments(attachments, domain) : []
        };
    }

    private detectDomain(content: string): string {
        const contentLower = content.toLowerCase();
        if (contentLower.includes('code') || contentLower.includes('technical')) return 'technical';
        if (contentLower.includes('financial') || contentLower.includes('revenue')) return 'financial';
        if (contentLower.includes('legal') || contentLower.includes('contract')) return 'legal';
        if (contentLower.includes('medical') || contentLower.includes('clinical')) return 'healthcare';
        return 'general';
    }

    private detectTaskType(content: string): string {
        const contentLower = content.toLowerCase();
        if (contentLower.includes('code') || contentLower.includes('program')) return 'code-generation';
        if (contentLower.includes('analyze') || contentLower.includes('research')) return 'research-analysis';
        if (contentLower.includes('create') || contentLower.includes('design')) return 'creative-generation';
        return 'general';
    }

    private assessComplexity(content: string, attachments?: any[]): 'simple' | 'moderate' | 'complex' | 'expert' {
        const wordCount = content.split(/\s+/).length;
        const hasLargeAttachments = attachments?.some(a => (a.size / 1024 / 1024) > 5);

        if (hasLargeAttachments) return 'expert';
        if (wordCount > 100) return 'complex';
        if (wordCount > 50) return 'moderate';
        return 'simple';
    }

    private analyzeAttachments(attachments: any[], domain: string): AttachmentAnalysis[] {
        return attachments.map(attachment => {
            const detectedType = this.detectFileType(attachment.filename, attachment.contentType);
            const language = this.detectLanguage(attachment.filename);
            const complexity = this.assessAttachmentComplexity(attachment.size, detectedType);
            const sensitivity = this.assessAttachmentSensitivity(attachment.filename);
            const processingRequirements = this.determineProcessingRequirements(detectedType, domain, sensitivity);

            return {
                id: attachment.id || `att_${Date.now()}`,
                filename: attachment.filename,
                contentType: attachment.contentType,
                detectedType,
                language,
                complexity,
                domain: this.determineAttachmentDomain(attachment.filename, domain),
                sensitivity,
                processingRequirements,
                estimatedTokens: this.estimateAttachmentTokens(attachment.size, detectedType),
                confidence: 0.9,
                reasoning: [`File type: ${detectedType}`, `Size: ${(attachment.size / 1024 / 1024).toFixed(1)}MB`]
            };
        });
    }

    private detectFileType(filename: string, contentType: string): 'text' | 'code' | 'image' | 'document' | 'data' | 'unknown' {
        if (contentType.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff|ico)$/i.test(filename)) {
            return 'image';
        }

        if (/\.(py|js|ts|java|c|cpp|cs|php|rb|go|rs|swift|kt|scala|r|sql|sh|bash|ps1|yaml|yml|json|xml|html|css|vue|jsx|tsx)$/i.test(filename)) {
            return 'code';
        }

        if (/\.(csv|tsv|xlsx|xls|json|xml|sql|db|sqlite|parquet|avro|orc)$/i.test(filename)) {
            return 'data';
        }

        if (/\.(pdf|doc|docx|txt|md|rtf|odt|pages)$/i.test(filename) || contentType.includes('document')) {
            return 'document';
        }

        if (contentType.startsWith('text/')) {
            return 'text';
        }

        return 'unknown';
    }

    private detectLanguage(filename: string): string | undefined {
        const ext = filename.split('.').pop()?.toLowerCase();
        const languageMap: { [key: string]: string } = {
            'py': 'Python', 'js': 'JavaScript', 'ts': 'TypeScript', 'java': 'Java',
            'c': 'C', 'cpp': 'C++', 'cs': 'C#', 'php': 'PHP', 'rb': 'Ruby',
            'go': 'Go', 'rs': 'Rust', 'swift': 'Swift', 'kt': 'Kotlin',
            'scala': 'Scala', 'r': 'R', 'sql': 'SQL', 'sh': 'Shell',
            'bash': 'Bash', 'ps1': 'PowerShell', 'yaml': 'YAML', 'yml': 'YAML',
            'json': 'JSON', 'xml': 'XML', 'html': 'HTML', 'css': 'CSS',
            'vue': 'Vue', 'jsx': 'JSX', 'tsx': 'TSX'
        };

        return languageMap[ext || ''] || undefined;
    }

    private assessAttachmentComplexity(size: number, fileType: string): 'simple' | 'moderate' | 'complex' | 'expert' {
        const sizeMB = size / (1024 * 1024);

        if (fileType === 'image' && sizeMB > 10) return 'expert';
        if (fileType === 'data' && sizeMB > 5) return 'expert';
        if (fileType === 'document' && sizeMB > 8) return 'expert';
        if (fileType === 'code' && sizeMB > 2) return 'complex';

        if (sizeMB > 20) return 'expert';
        if (sizeMB > 10) return 'complex';
        if (sizeMB > 5) return 'moderate';

        return 'simple';
    }

    private assessAttachmentSensitivity(filename: string): 'public' | 'internal' | 'confidential' | 'restricted' {
        const filenameLower = filename.toLowerCase();

        if (filenameLower.includes('confidential') || filenameLower.includes('secret') ||
            filenameLower.includes('private') || filenameLower.includes('restricted')) {
            return 'restricted';
        }

        if (filenameLower.includes('internal') || filenameLower.includes('draft') ||
            filenameLower.includes('working') || filenameLower.includes('temp')) {
            return 'internal';
        }

        if (filenameLower.includes('public') || filenameLower.includes('published') ||
            filenameLower.includes('shared') || filenameLower.includes('open')) {
            return 'public';
        }

        return 'internal';
    }

    private determineProcessingRequirements(fileType: string, domain: string, sensitivity: string): string[] {
        const requirements: string[] = [];

        if (fileType === 'image') {
            requirements.push('image-analysis', 'multimodal-processing');
        }

        if (fileType === 'code') {
            requirements.push('code-analysis', 'syntax-validation');
        }

        if (fileType === 'document' || fileType === 'data') {
            requirements.push('text-extraction', 'document-parsing');
        }

        if (sensitivity === 'restricted' || sensitivity === 'confidential') {
            requirements.push('security-scanning', 'access-control');
        }

        if (domain === 'healthcare') {
            requirements.push('hipaa-compliance', 'data-privacy');
        }

        if (domain === 'legal') {
            requirements.push('compliance-checking', 'audit-trail');
        }

        requirements.push('detailed-analysis', 'error-handling');
        return requirements;
    }

    private determineAttachmentDomain(filename: string, requestDomain: string): string {
        const filenameLower = filename.toLowerCase();

        if (filenameLower.includes('financial') || filenameLower.includes('budget') ||
            filenameLower.includes('revenue') || filenameLower.includes('profit')) {
            return 'financial';
        }

        if (filenameLower.includes('contract') || filenameLower.includes('legal') ||
            filenameLower.includes('compliance') || filenameLower.includes('policy')) {
            return 'legal';
        }

        if (filenameLower.includes('clinical') || filenameLower.includes('medical') ||
            filenameLower.includes('patient') || filenameLower.includes('trial')) {
            return 'healthcare';
        }

        if (filenameLower.includes('code') || filenameLower.includes('api') ||
            filenameLower.includes('system') || filenameLower.includes('architecture')) {
            return 'technical';
        }

        return requestDomain;
    }

    private estimateAttachmentTokens(size: number, fileType: string): number {
        const sizeMB = size / (1024 * 1024);

        const baseTokensPerMB = {
            'text': 500000,
            'code': 300000,
            'document': 400000,
            'data': 200000,
            'image': 1000000,
            'unknown': 300000
        };

        return Math.ceil(sizeMB * (baseTokensPerMB[fileType as keyof typeof baseTokensPerMB] || baseTokensPerMB.unknown));
    }

    private estimateTokens(content: string, complexity: string): number {
        const baseTokens = content.length * 0.75;
        const complexityMultipliers = {
            'simple': 1.0,
            'moderate': 1.5,
            'complex': 2.5,
            'expert': 4.0
        };

        const multiplier = complexityMultipliers[complexity as keyof typeof complexityMultipliers] || 1.0;
        return Math.ceil(baseTokens * multiplier);
    }

    private generateCacheKey(content: string, attachments?: any[]): string {
        const attachmentInfo = attachments?.map(a => `${a.filename}-${a.size}`).join('|') || '';
        const combined = `${content}|${attachmentInfo}`;

        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    // Public methods for service management
    async getServiceStats(): Promise<{
        analysisCacheSize: number;
        embeddingsEnabled: boolean;
        totalCost: number;
        lastAnalysis: Date;
    }> {
        const embeddingsStats = this.embeddingsService ? await this.embeddingsService.getEmbeddingStats() : null;

        return {
            analysisCacheSize: this.analysisCache.size,
            embeddingsEnabled: this.config.embeddingsEnabled,
            totalCost: embeddingsStats?.totalCost || 0,
            lastAnalysis: embeddingsStats?.lastUpdated || new Date()
        };
    }

    async clearAnalysisCache(): Promise<void> {
        this.analysisCache.clear();
        this.logger.info('Analysis cache cleared');
    }
}
