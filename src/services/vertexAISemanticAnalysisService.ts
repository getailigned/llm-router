import { createLogger } from './loggerService';
import { SemanticAnalysis, AttachmentAnalysis } from '../types';

export interface VertexAIConfig {
    projectId: string;
    location: string;
    model: string;
    maxRetries: number;
    timeoutMs: number;
}

export class VertexAISemanticAnalysisService {
    private logger = createLogger('VertexAISemanticAnalysisService');
    private vertexAI: any;
    private model: any;
    private config: VertexAIConfig;
    private isInitialized = false;

    constructor(config: VertexAIConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        try {
            // Dynamic import to avoid build issues
            const { VertexAI } = await import('@google-cloud/vertexai');

            this.vertexAI = new VertexAI({
                project: this.config.projectId,
                location: this.config.location
            });

            // Use the full model path format
            const modelPath = `projects/${this.config.projectId}/locations/${this.config.location}/models/${this.config.model}`;

            this.model = this.vertexAI.preview.getGenerativeModel({
                model: modelPath
            });

            this.isInitialized = true;
            this.logger.info('Vertex AI service initialized successfully', {
                projectId: this.config.projectId,
                location: this.config.location,
                model: this.config.model,
                modelPath
            });
        } catch (error) {
            this.logger.error('Failed to initialize Vertex AI service', error);
            throw new Error(`Vertex AI initialization failed: ${error}`);
        }
    }

    async analyzeRequest(content: string, _metadata?: any, attachments?: any[]): Promise<SemanticAnalysis> {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Use Gemini for semantic analysis
            const analysis = await this.classifyWithGemini(content, attachments);

            // Validate and transform the response
            return this.validateAndTransform(analysis, content, attachments);
        } catch (error) {
            this.logger.warn('Vertex AI analysis failed, falling back to rule-based', error);
            return this.fallbackRuleBasedAnalysis(content, attachments);
        }
    }

    private async classifyWithGemini(content: string, attachments?: any[]): Promise<any> {
        const prompt = this.buildClassificationPrompt(content, attachments);

        const result = await this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1, // Low temperature for consistent classification
                maxOutputTokens: 1000,
                topP: 0.8,
                topK: 40
            }
        });

        const responseText = result.response.text();
        this.logger.debug('Gemini response received', { responseLength: responseText.length });

        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const analysis = JSON.parse(jsonMatch[0]);
            this.logger.debug('Parsed Gemini analysis', { analysis });
            return analysis;
        } catch (parseError) {
            this.logger.error('Failed to parse Gemini response', {
                response: responseText,
                error: parseError
            });
            throw new Error('Failed to parse Gemini response');
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
            reasoning: [geminiAnalysis.reasoning || 'Analysis provided by Gemini AI'],
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
            reasoning: ['Fallback analysis due to Vertex AI failure'],
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
