import { createLogger } from './loggerService';
import { SemanticAnalysis, AttachmentAnalysis } from '../types';

export interface GoogleGenerativeAIConfig {
    apiKey: string;
    model: string;
    maxRetries: number;
    timeoutMs: number;
}

export class GoogleGenerativeAISemanticAnalysisService {
    private logger = createLogger('GoogleGenerativeAIService');
    private config: GoogleGenerativeAIConfig;
    private isInitialized = false;

    constructor(config: GoogleGenerativeAIConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        try {
            // Check if API key is available
            if (!this.config.apiKey) {
                throw new Error('Google Generative AI API key is required');
            }

            this.isInitialized = true;
            this.logger.info('Google Generative AI service initialized successfully', {
                model: this.config.model,
                hasApiKey: !!this.config.apiKey
            });
        } catch (error) {
            this.logger.error('Failed to initialize Google Generative AI service', error);
            throw new Error(`Google Generative AI initialization failed: ${error}`);
        }
    }

    async analyzeRequest(content: string, _metadata?: any, attachments?: any[]): Promise<SemanticAnalysis> {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Use Google Generative AI for semantic analysis
            const analysis = await this.classifyWithGenerativeAI(content, attachments);

            // Validate and transform the response
            return this.validateAndTransform(analysis, content, attachments);
        } catch (error) {
            this.logger.warn('Google Generative AI analysis failed, falling back to rule-based', error);
            return this.fallbackRuleBasedAnalysis(content, attachments);
        }
    }

    private async classifyWithGenerativeAI(content: string, attachments?: any[]): Promise<any> {
        try {
            // Use fetch to call the Google Generative AI API directly
            const prompt = this.buildClassificationPrompt(content, attachments);

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 1000,
                        topP: 0.8,
                        topK: 40
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Google Generative AI API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json() as any;
            const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!responseText) {
                throw new Error('No response text from Google Generative AI API');
            }

            this.logger.debug('Google Generative AI response received', { responseLength: responseText.length });

            try {
                // Extract JSON from response
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No JSON found in response');
                }

                const analysis = JSON.parse(jsonMatch[0]);
                this.logger.debug('Parsed Google Generative AI analysis', { analysis });
                return analysis;
            } catch (parseError) {
                this.logger.error('Failed to parse Google Generative AI response', {
                    response: responseText,
                    error: parseError
                });
                throw new Error('Failed to parse Google Generative AI response');
            }
        } catch (error) {
            this.logger.error('Google Generative AI API call failed', error);
            throw error;
        }
    }

    private buildClassificationPrompt(content: string, attachments?: any[]): string {
        const attachmentInfo = attachments && attachments.length > 0
            ? `\nAttachments: ${attachments.map(a => `${a.filename} (${a.contentType}, ${(a.size / 1024 / 1024).toFixed(1)}MB)`).join(', ')}`
            : '\nAttachments: None';

        return `You are an expert at classifying requests for an AI routing system. Analyze the following request and classify it into the appropriate categories.

Request Content: "${content}"${attachmentInfo}

Please classify this request and respond with ONLY a valid JSON object in the following format:

{
  "domain": "technical|financial|legal|healthcare|creative|research|general",
  "taskType": "code-generation|complex-reasoning|research-analysis|creative-generation|rag-operations|strategic-planning|general",
  "complexity": "simple|moderate|complex|expert",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this classification was chosen",
  "estimatedTokens": 1500,
  "priority": "low|medium|high|critical",
  "requiresMultimodal": false,
  "requiresRAG": true,
  "requiresCodeGeneration": false
}

Guidelines:
- Domain: Choose the most specific domain that applies
- Task Type: Identify the primary action being requested
- Complexity: Consider content length, technical terms, and attachment size
- Confidence: 0.9+ for clear cases, 0.7-0.9 for ambiguous cases
- Priority: Look for urgent/important indicators
- Capabilities: Set based on content and attachment analysis

Respond with ONLY the JSON object, no additional text.`;
    }

    private validateAndTransform(geminiAnalysis: any, content: string, attachments?: any[]): SemanticAnalysis {
        // Validate required fields
        const requiredFields = ['domain', 'taskType', 'complexity', 'confidence'];
        for (const field of requiredFields) {
            if (!geminiAnalysis[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Validate enum values
        const validDomains = ['technical', 'financial', 'legal', 'healthcare', 'creative', 'research', 'general'];
        const validTaskTypes = ['code-generation', 'complex-reasoning', 'research-analysis', 'creative-generation', 'rag-operations', 'strategic-planning', 'general'];
        const validComplexities = ['simple', 'moderate', 'complex', 'expert'];
        const validPriorities = ['low', 'medium', 'high', 'critical'];

        if (!validDomains.includes(geminiAnalysis.domain)) {
            geminiAnalysis.domain = 'general';
        }
        if (!validTaskTypes.includes(geminiAnalysis.taskType)) {
            geminiAnalysis.taskType = 'general';
        }
        if (!validComplexities.includes(geminiAnalysis.complexity)) {
            geminiAnalysis.complexity = 'moderate';
        }
        if (!validPriorities.includes(geminiAnalysis.priority)) {
            geminiAnalysis.priority = 'medium';
        }

        // Ensure confidence is a number between 0 and 1
        geminiAnalysis.confidence = Math.max(0, Math.min(1, Number(geminiAnalysis.confidence) || 0.5));

        // Analyze attachments if provided
        let attachmentAnalysis: AttachmentAnalysis[] = [];
        if (attachments && attachments.length > 0) {
            attachmentAnalysis = this.analyzeAttachments(attachments, geminiAnalysis.domain);
        }

        return {
            taskType: geminiAnalysis.taskType,
            complexity: geminiAnalysis.complexity,
            domain: geminiAnalysis.domain,
            confidence: geminiAnalysis.confidence,
            reasoning: [geminiAnalysis.reasoning || 'Analysis provided by Google Generative AI'],
            estimatedTokens: geminiAnalysis.estimatedTokens || this.estimateTokens(content, geminiAnalysis.complexity),
            priority: geminiAnalysis.priority,
            requiresMultimodal: geminiAnalysis.requiresMultimodal || false,
            requiresRAG: geminiAnalysis.requiresRAG || false,
            requiresCodeGeneration: geminiAnalysis.requiresCodeGeneration || false,
            attachments: attachmentAnalysis
        };
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
                confidence: 0.9, // High confidence for file-based analysis
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

        return 'internal'; // Default to internal
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

        // Strong domain indicators in filename
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

        // Fall back to request domain
        return requestDomain;
    }

    private estimateAttachmentTokens(size: number, fileType: string): number {
        const sizeMB = size / (1024 * 1024);

        // Rough token estimation based on file type and size
        const baseTokensPerMB = {
            'text': 500000,    // ~500K tokens per MB for text
            'code': 300000,    // ~300K tokens per MB for code
            'document': 400000, // ~400K tokens per MB for documents
            'data': 200000,    // ~200K tokens per MB for structured data
            'image': 1000000,  // ~1M tokens per MB for images (multimodal)
            'unknown': 300000  // Default fallback
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

    private fallbackRuleBasedAnalysis(content: string, attachments?: any[]): SemanticAnalysis {
        this.logger.info('Using fallback rule-based analysis');

        // Simple fallback logic
        const domain = this.simpleDomainDetection(content);
        const taskType = this.simpleTaskDetection(content);
        const complexity = this.simpleComplexityDetection(content, attachments);

        return {
            taskType,
            complexity,
            domain,
            confidence: 0.3, // Low confidence for fallback
            reasoning: ['Fallback analysis due to Google Generative AI failure'],
            estimatedTokens: this.estimateTokens(content, complexity),
            priority: 'medium',
            requiresMultimodal: attachments?.some(a => a.contentType?.startsWith('image/')) || false,
            requiresRAG: true, // Default to true for safety
            requiresCodeGeneration: taskType === 'code-generation',
            attachments: attachments ? this.analyzeAttachments(attachments, domain) : []
        };
    }

    private simpleDomainDetection(content: string): string {
        const contentLower = content.toLowerCase();
        if (contentLower.includes('code') || contentLower.includes('technical')) return 'technical';
        if (contentLower.includes('financial') || contentLower.includes('revenue')) return 'financial';
        if (contentLower.includes('legal') || contentLower.includes('contract')) return 'legal';
        if (contentLower.includes('medical') || contentLower.includes('clinical')) return 'healthcare';
        return 'general';
    }

    private simpleTaskDetection(content: string): string {
        const contentLower = content.toLowerCase();
        if (contentLower.includes('code') || contentLower.includes('program')) return 'code-generation';
        if (contentLower.includes('analyze') || contentLower.includes('research')) return 'research-analysis';
        if (contentLower.includes('create') || contentLower.includes('design')) return 'creative-generation';
        return 'general';
    }

    private simpleComplexityDetection(content: string, attachments?: any[]): 'simple' | 'moderate' | 'complex' | 'expert' {
        const wordCount = content.split(/\s+/).length;
        const hasLargeAttachments = attachments?.some(a => (a.size / 1024 / 1024) > 5);

        if (hasLargeAttachments) return 'expert';
        if (wordCount > 100) return 'complex';
        if (wordCount > 50) return 'moderate';
        return 'simple';
    }
}
