import { createLogger } from './loggerService';

export interface SemanticAnalysis {
    taskType: string;
    complexity: 'simple' | 'moderate' | 'complex' | 'expert';
    domain: string;
    confidence: number;
    reasoning: string[];
    estimatedTokens: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    requiresMultimodal: boolean;
    requiresRAG: boolean;
    requiresCodeGeneration: boolean;
    // Attachment analysis
    attachments?: AttachmentAnalysis[];
}

export interface AttachmentAnalysis {
    id: string;
    filename: string;
    contentType: string;
    detectedType: 'text' | 'code' | 'image' | 'document' | 'data' | 'unknown';
    language: string | undefined;
    complexity: 'simple' | 'moderate' | 'complex' | 'expert';
    domain: string;
    sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
    processingRequirements: string[];
    estimatedTokens: number;
    confidence: number;
    reasoning: string[];
}

export interface DomainPattern {
    domain: string;
    keywords: string[];
    patterns: RegExp[];
    complexity: 'simple' | 'moderate' | 'complex' | 'expert';
    taskTypes: string[];
    confidence: number;
}

export class SemanticAnalysisService {
    private logger = createLogger('SemanticAnalysisService');

    // Domain recognition patterns
    private readonly DOMAIN_PATTERNS: DomainPattern[] = [
        {
            domain: 'financial',
            keywords: ['financial', 'revenue', 'profit', 'budget', 'investment', 'stock', 'market', 'forecast', 'modeling'],
            patterns: [
                /financial\s+(analysis|modeling|forecasting|planning)/i,
                /revenue\s+(projection|growth|optimization)/i,
                /budget\s+(allocation|planning|optimization)/i,
                /investment\s+(strategy|portfolio|analysis)/i,
                /stock\s+(market|trading|analysis)/i,
                /profit\s+(margin|optimization|analysis)/i
            ],
            complexity: 'complex',
            taskTypes: ['complex-reasoning', 'strategic-planning', 'financial-analysis'],
            confidence: 0.9
        },
        {
            domain: 'technical',
            keywords: ['technical', 'architecture', 'system', 'infrastructure', 'performance', 'scalability', 'security'],
            patterns: [
                /technical\s+(architecture|design|specification)/i,
                /system\s+(design|architecture|performance)/i,
                /infrastructure\s+(planning|optimization|migration)/i,
                /performance\s+(optimization|testing|monitoring)/i,
                /scalability\s+(planning|analysis|optimization)/i,
                /security\s+(audit|assessment|implementation)/i
            ],
            complexity: 'expert',
            taskTypes: ['complex-reasoning', 'technical-design', 'system-architecture'],
            confidence: 0.95
        },
        {
            domain: 'creative',
            keywords: ['creative', 'story', 'narrative', 'content', 'marketing', 'brand', 'campaign', 'design'],
            patterns: [
                /creative\s+(writing|content|strategy)/i,
                /story\s+(development|narrative|creation)/i,
                /marketing\s+(campaign|strategy|content)/i,
                /brand\s+(identity|strategy|messaging)/i,
                /content\s+(creation|strategy|optimization)/i
            ],
            complexity: 'moderate',
            taskTypes: ['creative-generation', 'content-creation', 'marketing-strategy'],
            confidence: 0.85
        },
        {
            domain: 'research',
            keywords: ['research', 'analysis', 'study', 'investigation', 'exploration', 'discovery'],
            patterns: [
                /research\s+(analysis|study|investigation)/i,
                /market\s+(research|analysis|study)/i,
                /competitive\s+(analysis|research|intelligence)/i,
                /trend\s+(analysis|research|forecasting)/i
            ],
            complexity: 'complex',
            taskTypes: ['research-analysis', 'complex-reasoning', 'strategic-planning'],
            confidence: 0.9
        },
        {
            domain: 'legal',
            keywords: ['legal', 'contract', 'compliance', 'regulation', 'policy', 'law', 'litigation'],
            patterns: [
                /legal\s+(analysis|review|advice)/i,
                /contract\s+(review|analysis|drafting)/i,
                /compliance\s+(audit|assessment|implementation)/i,
                /regulatory\s+(analysis|compliance|requirements)/i
            ],
            complexity: 'expert',
            taskTypes: ['complex-reasoning', 'legal-analysis', 'compliance-review'],
            confidence: 0.95
        },
        {
            domain: 'healthcare',
            keywords: ['medical', 'healthcare', 'clinical', 'patient', 'diagnosis', 'treatment', 'research'],
            patterns: [
                /medical\s+(research|analysis|diagnosis)/i,
                /clinical\s+(trial|research|analysis)/i,
                /patient\s+(care|treatment|diagnosis)/i,
                /healthcare\s+(policy|research|analysis)/i
            ],
            complexity: 'expert',
            taskTypes: ['complex-reasoning', 'medical-research', 'clinical-analysis'],
            confidence: 0.95
        },
        {
            domain: 'education',
            keywords: ['education', 'learning', 'curriculum', 'training', 'assessment', 'pedagogy'],
            patterns: [
                /curriculum\s+(development|design|assessment)/i,
                /learning\s+(strategy|assessment|optimization)/i,
                /training\s+(program|curriculum|assessment)/i,
                /educational\s+(technology|strategy|assessment)/i
            ],
            complexity: 'moderate',
            taskTypes: ['educational-design', 'curriculum-development', 'learning-strategy'],
            confidence: 0.85
        }
    ];

      // Task type detection patterns
  private readonly TASK_PATTERNS = {
    'complex-reasoning': {
      keywords: ['analyze', 'evaluate', 'assess', 'investigate', 'examine', 'study', 'research'],
      patterns: [
        /analyze\s+(the|this|these)/i,
        /evaluate\s+(the|this|these)/i,
        /assess\s+(the|this|these)/i,
        /investigate\s+(the|this|these)/i,
        /examine\s+(the|this|these)/i,
        /study\s+(the|this|these)/i,
        /research\s+(the|this|these)/i,
        /compare\s+(and\s+)?contrast/i,
        /identify\s+(patterns|trends|relationships)/i,
        /explain\s+(why|how|what\s+causes)/i
      ],
      complexity: 'complex',
      confidence: 0.9
    },
    'research-analysis': {
      keywords: ['research', 'study', 'investigate', 'explore', 'discover', 'survey', 'trial', 'clinical'],
      patterns: [
        /research\s+(on|about|into|for)/i,
        /study\s+(of|on|about)/i,
        /investigate\s+(the|this|these)/i,
        /explore\s+(the|this|these)/i,
        /discover\s+(patterns|trends|insights)/i,
        /survey\s+(results|data|findings)/i,
        /clinical\s+(trial|study|research)/i,
        /patient\s+(outcomes|results|data)/i
      ],
      complexity: 'expert',
      confidence: 0.9
    },
        'rag-operations': {
            keywords: ['search', 'find', 'retrieve', 'locate', 'discover', 'query'],
            patterns: [
                /search\s+(for|through|in)/i,
                /find\s+(information|data|details)/i,
                /retrieve\s+(information|data|documents)/i,
                /locate\s+(information|data|sources)/i,
                /discover\s+(information|data|insights)/i,
                /query\s+(the|this|these)/i
            ],
            complexity: 'moderate',
            confidence: 0.85
        },
        'code-generation': {
            keywords: ['code', 'program', 'script', 'function', 'algorithm', 'implementation'],
            patterns: [
                /write\s+(code|program|script|function)/i,
                /create\s+(code|program|script|function)/i,
                /generate\s+(code|program|script|function)/i,
                /implement\s+(algorithm|function|feature)/i,
                /develop\s+(code|program|script)/i,
                /build\s+(code|program|script)/i
            ],
            complexity: 'moderate',
            confidence: 0.9
        },
        'fast-response': {
            keywords: ['quick', 'urgent', 'immediate', 'fast', 'rapid', 'asap'],
            patterns: [
                /quick\s+(answer|response|solution)/i,
                /urgent\s+(request|need|requirement)/i,
                /immediate\s+(response|answer|solution)/i,
                /fast\s+(answer|response|solution)/i,
                /rapid\s+(response|answer|solution)/i,
                /asap/i
            ],
            complexity: 'simple',
            confidence: 0.8
        },
        'strategic-planning': {
            keywords: ['strategy', 'planning', 'roadmap', 'vision', 'mission', 'goals', 'objectives'],
            patterns: [
                /develop\s+(strategy|plan|roadmap)/i,
                /create\s+(strategy|plan|roadmap)/i,
                /plan\s+(strategy|approach|implementation)/i,
                /strategic\s+(planning|thinking|analysis)/i,
                /roadmap\s+(development|planning|creation)/i
            ],
            complexity: 'complex',
            confidence: 0.9
        }
    };

    // Complexity indicators
    private readonly COMPLEXITY_INDICATORS = {
        'simple': {
            keywords: ['simple', 'basic', 'quick', 'easy', 'straightforward'],
            patterns: [/simple/i, /basic/i, /quick/i, /easy/i, /straightforward/i],
            maxTokens: 1000,
            confidence: 0.8
        },
        'moderate': {
            keywords: ['moderate', 'standard', 'typical', 'normal', 'regular'],
            patterns: [/moderate/i, /standard/i, /typical/i, /normal/i, /regular/i],
            maxTokens: 3000,
            confidence: 0.8
        },
        'complex': {
            keywords: ['complex', 'advanced', 'detailed', 'comprehensive', 'thorough'],
            patterns: [/complex/i, /advanced/i, /detailed/i, /comprehensive/i, /thorough/i],
            maxTokens: 8000,
            confidence: 0.85
        },
        'expert': {
            keywords: ['expert', 'specialized', 'professional', 'sophisticated', 'cutting-edge'],
            patterns: [/expert/i, /specialized/i, /professional/i, /sophisticated/i, /cutting-edge/i],
            maxTokens: 15000,
            confidence: 0.9
        }
    };

    /**
 * Analyze request content semantically to determine task characteristics
 */
    async analyzeRequest(content: string, metadata?: any, attachments?: any[]): Promise<SemanticAnalysis> {
        try {
            this.logger.info('Starting semantic analysis of request', {
                contentLength: content.length,
                attachmentCount: attachments?.length || 0
            });

            // 1. Domain recognition (consider both text and attachments)
            const domainAnalysis = this.recognizeDomain(content, attachments);

            // 2. Task type detection (consider both text and attachments)
            const taskAnalysis = this.detectTaskType(content, attachments);

            // 3. Complexity assessment (consider both text and attachments)
            const complexityAnalysis = this.assessComplexity(content, domainAnalysis, taskAnalysis, attachments);

            // 4. Token estimation
            const estimatedTokens = this.estimateTokens(content, complexityAnalysis.complexity);

            // 5. Priority assessment
            const priority = this.assessPriority(content, metadata);

            // 6. Capability requirements
            const capabilities = this.assessCapabilityRequirements(content, domainAnalysis, taskAnalysis);

            // 7. Attachment analysis (if provided)
            let attachmentAnalysis: AttachmentAnalysis[] = [];
            if (attachments && attachments.length > 0) {
                attachmentAnalysis = await this.analyzeAttachments(attachments, domainAnalysis.domain);

                // Update capabilities based on attachments
                capabilities.multimodal = capabilities.multimodal || attachmentAnalysis.some(a => a.detectedType === 'image');
                capabilities.rag = capabilities.rag || attachmentAnalysis.some(a => a.detectedType === 'document' || a.detectedType === 'data');
                capabilities.codeGeneration = capabilities.codeGeneration || attachmentAnalysis.some(a => a.detectedType === 'code');

                // Adjust complexity based on attachments
                if (attachmentAnalysis.some(a => a.complexity === 'expert')) {
                    complexityAnalysis.complexity = 'expert';
                    complexityAnalysis.confidence = Math.max(complexityAnalysis.confidence, 0.9);
                }
            }

            const analysis: SemanticAnalysis = {
                taskType: taskAnalysis.taskType,
                complexity: complexityAnalysis.complexity,
                domain: domainAnalysis.domain,
                confidence: Math.min(0.95, (domainAnalysis.confidence + taskAnalysis.confidence + complexityAnalysis.confidence) / 3),
                reasoning: [
                    `Domain: ${domainAnalysis.domain} (confidence: ${(domainAnalysis.confidence * 100).toFixed(1)}%)`,
                    `Task: ${taskAnalysis.taskType} (confidence: ${(taskAnalysis.confidence * 100).toFixed(1)}%)`,
                    `Complexity: ${complexityAnalysis.complexity} (confidence: ${(complexityAnalysis.confidence * 100).toFixed(1)}%)`,
                    ...domainAnalysis.reasoning,
                    ...taskAnalysis.reasoning,
                    ...complexityAnalysis.reasoning
                ],
                estimatedTokens,
                priority,
                requiresMultimodal: capabilities.multimodal,
                requiresRAG: capabilities.rag,
                requiresCodeGeneration: capabilities.codeGeneration,
                attachments: attachmentAnalysis
            };

            this.logger.info('Semantic analysis completed', {
                taskType: analysis.taskType,
                complexity: analysis.complexity,
                domain: analysis.domain,
                confidence: analysis.confidence,
                attachmentCount: attachmentAnalysis.length
            });

            return analysis;

        } catch (error) {
            this.logger.error('Semantic analysis failed', error);
            return this.generateDefaultAnalysis(content);
        }
    }

    /**
 * Recognize the domain of the request (considering both text and attachments)
 */
    private recognizeDomain(content: string, attachments?: any[]): { domain: string; confidence: number; reasoning: string[] } {
        const contentLower = content.toLowerCase();
        let bestMatch: DomainPattern | null = null;
        let bestScore = 0;
        const reasoning: string[] = [];

        // Analyze text content
        for (const pattern of this.DOMAIN_PATTERNS) {
            let score = 0;
            let matches = 0;

            // Check keyword matches in text
            for (const keyword of pattern.keywords) {
                if (contentLower.includes(keyword)) {
                    score += 0.3;
                    matches++;
                }
            }

            // Check pattern matches in text
            for (const regex of pattern.patterns) {
                if (regex.test(content)) {
                    score += 0.5;
                    matches++;
                }
            }

            // Boost score for multiple matches
            if (matches > 1) {
                score += 0.2;
            }

            // Apply domain-specific confidence
            score *= pattern.confidence;

            if (score > bestScore) {
                bestScore = score;
                bestMatch = pattern;
            }
        }

        // Analyze attachments for domain indicators
        if (attachments && attachments.length > 0) {
            const attachmentDomainScore = this.analyzeAttachmentsForDomain(attachments, reasoning);

            // If attachments strongly indicate a domain, boost that domain's score
            if (attachmentDomainScore.domain && attachmentDomainScore.score > bestScore * 0.8) {
                bestScore = attachmentDomainScore.score;
                bestMatch = this.DOMAIN_PATTERNS.find(p => p.domain === attachmentDomainScore.domain) || bestMatch;
                reasoning.push(`Attachment domain override: ${attachmentDomainScore.domain} (score: ${(attachmentDomainScore.score * 100).toFixed(1)}%)`);
            }
        }

        if (bestMatch && bestScore > 0.3) {
            reasoning.push(`Domain detected: ${bestMatch.domain} (score: ${(bestScore * 100).toFixed(1)}%)`);
            return {
                domain: bestMatch.domain,
                confidence: bestScore,
                reasoning
            };
        }

        reasoning.push('Domain: general (no specific domain detected)');
        return {
            domain: 'general',
            confidence: 0.5,
            reasoning
        };
    }

    /**
 * Detect the task type from request content (considering both text and attachments)
 */
    private detectTaskType(content: string, attachments?: any[]): { taskType: string; confidence: number; reasoning: string[] } {
        const contentLower = content.toLowerCase();
        let bestMatch: { taskType: string; confidence: number } | null = null;
        let bestScore = 0;
        const reasoning: string[] = [];

        for (const [taskType, config] of Object.entries(this.TASK_PATTERNS)) {
            let score = 0;
            let matches = 0;

            // Check keyword matches
            for (const keyword of config.keywords) {
                if (contentLower.includes(keyword)) {
                    score += 0.4;
                    matches++;
                }
            }

            // Check pattern matches
            for (const regex of config.patterns) {
                if (regex.test(content)) {
                    score += 0.6;
                    matches++;
                }
            }

            // Boost score for multiple matches
            if (matches > 1) {
                score += 0.2;
            }

            // Apply task-specific confidence
            score *= config.confidence;

            if (score > bestScore) {
                bestScore = score;
                bestMatch = { taskType, confidence: config.confidence };
            }
        }

        // Analyze attachments for task type indicators
        if (attachments && attachments.length > 0) {
            const attachmentTaskScore = this.analyzeAttachmentsForTaskType(attachments, reasoning);

            // If attachments strongly indicate a task type, boost that task type's score
            if (attachmentTaskScore.taskType && attachmentTaskScore.score > bestScore * 0.8) {
                bestScore = attachmentTaskScore.score;
                bestMatch = { taskType: attachmentTaskScore.taskType, confidence: attachmentTaskScore.score };
                reasoning.push(`Attachment task type override: ${attachmentTaskScore.taskType} (score: ${(attachmentTaskScore.score * 100).toFixed(1)}%)`);
            }
        }

        if (bestMatch && bestScore > 0.4) {
            reasoning.push(`Task type detected: ${bestMatch.taskType} (score: ${(bestScore * 100).toFixed(1)}%)`);
            return {
                taskType: bestMatch.taskType,
                confidence: bestScore,
                reasoning
            };
        }

        reasoning.push('Task type: general (no specific task pattern detected)');
        return {
            taskType: 'general',
            confidence: 0.5,
            reasoning
        };
    }

    /**
 * Assess the complexity of the request (considering both text and attachments)
 */
    private assessComplexity(
        content: string,
        domainAnalysis: { domain: string; confidence: number },
        taskAnalysis: { taskType: string; confidence: number },
        attachments?: any[]
    ): { complexity: 'simple' | 'moderate' | 'complex' | 'expert'; confidence: number; reasoning: string[] } {
        const reasoning: string[] = [];
        let complexity: 'simple' | 'moderate' | 'complex' | 'expert' = 'moderate';
        let confidence = 0.5;

        // 1. Check explicit complexity indicators
        for (const [level, config] of Object.entries(this.COMPLEXITY_INDICATORS)) {
            for (const regex of config.patterns) {
                if (regex.test(content)) {
                    complexity = level as any;
                    confidence = config.confidence;
                    reasoning.push(`Explicit complexity indicator: ${level}`);
                    break;
                }
            }
            if (confidence > 0.5) break;
        }

        // 2. Analyze content length and structure
        const wordCount = content.split(/\s+/).length;
        const sentenceCount = content.split(/[.!?]+/).length;
        const paragraphCount = content.split(/\n\s*\n/).length;

        if (wordCount > 200 || sentenceCount > 10 || paragraphCount > 3) {
            if (complexity === 'simple') {
                complexity = 'moderate';
                confidence = Math.max(confidence, 0.6);
            }
            reasoning.push(`Content length suggests ${complexity} complexity (${wordCount} words, ${sentenceCount} sentences)`);
        }

        // 3. Domain-based complexity adjustment
        if (domainAnalysis.domain === 'technical' || domainAnalysis.domain === 'legal' || domainAnalysis.domain === 'healthcare') {
            if (complexity === 'simple') complexity = 'moderate';
            if (complexity === 'moderate') complexity = 'complex';
            reasoning.push(`Domain ${domainAnalysis.domain} typically requires ${complexity} complexity`);
        }

        // 4. Task-based complexity adjustment
        if (taskAnalysis.taskType === 'complex-reasoning' || taskAnalysis.taskType === 'strategic-planning') {
            if (complexity === 'simple') complexity = 'moderate';
            if (complexity === 'moderate') complexity = 'complex';
            reasoning.push(`Task type ${taskAnalysis.taskType} typically requires ${complexity} complexity`);
        }

        // 5. Technical indicators
        if (content.includes('algorithm') || content.includes('architecture') || content.includes('optimization')) {
            if (complexity === 'moderate') complexity = 'complex';
            if (complexity === 'complex') complexity = 'expert';
            reasoning.push('Technical terms suggest higher complexity');
        }

            // 6. Attachment-based complexity adjustment
    if (attachments && attachments.length > 0) {
      const attachmentComplexity = this.assessAttachmentComplexityForRouting(attachments, reasoning);
      
      // If attachments suggest higher complexity, adjust accordingly
      if (attachmentComplexity === 'expert' && complexity !== 'expert') {
        complexity = 'expert';
        confidence = Math.max(confidence, 0.9);
        reasoning.push('Attachments suggest expert complexity');
      } else if (attachmentComplexity === 'complex' && complexity === 'simple') {
        complexity = 'moderate';
        confidence = Math.max(confidence, 0.7);
        reasoning.push('Attachments suggest moderate complexity');
      }
      
      // Additional complexity boost for very large files
      const totalSizeMB = attachments.reduce((sum, a) => sum + (a.size / (1024 * 1024)), 0);
      if (totalSizeMB > 10 && complexity !== 'expert') {
        complexity = 'expert';
        confidence = Math.max(confidence, 0.95);
        reasoning.push(`Total attachment size (${totalSizeMB.toFixed(1)}MB) requires expert complexity`);
      } else if (totalSizeMB > 5 && complexity === 'simple') {
        complexity = 'moderate';
        confidence = Math.max(confidence, 0.8);
        reasoning.push(`Total attachment size (${totalSizeMB.toFixed(1)}MB) suggests moderate complexity`);
      }
      
      // Individual large files should also boost complexity
      const hasLargeFile = attachments.some(a => (a.size / (1024 * 1024)) > 8);
      if (hasLargeFile && complexity !== 'expert') {
        complexity = 'expert';
        confidence = Math.max(confidence, 0.9);
        reasoning.push('Individual large files detected, requiring expert complexity');
      }
    }

        return { complexity, confidence, reasoning };
    }

    /**
     * Estimate token count based on content and complexity
     */
    private estimateTokens(content: string, complexity: string): number {
        const baseTokens = content.length * 0.75; // Rough estimation

        const complexityMultipliers = {
            'simple': 1.0,
            'moderate': 1.5,
            'complex': 2.5,
            'expert': 4.0
        };

        const multiplier = complexityMultipliers[complexity as keyof typeof complexityMultipliers] || 1.0;
        return Math.ceil(baseTokens * multiplier);
    }

    /**
     * Assess request priority
     */
    private assessPriority(content: string, _metadata?: any): 'low' | 'medium' | 'high' | 'critical' {
        const contentLower = content.toLowerCase();

        // Check for urgent indicators
        if (contentLower.includes('urgent') || contentLower.includes('asap') || contentLower.includes('emergency')) {
            return 'critical';
        }

        if (contentLower.includes('important') || contentLower.includes('priority') || contentLower.includes('deadline')) {
            return 'high';
        }

        if (contentLower.includes('quick') || contentLower.includes('fast') || contentLower.includes('immediate')) {
            return 'high';
        }

        return 'medium';
    }

    /**
     * Assess capability requirements
     */
    private assessCapabilityRequirements(
        content: string,
        _domainAnalysis: { domain: string },
        taskAnalysis: { taskType: string }
    ): { multimodal: boolean; rag: boolean; codeGeneration: boolean } {
        const contentLower = content.toLowerCase();

        // Multimodal requirements
        const multimodal = contentLower.includes('image') ||
            contentLower.includes('picture') ||
            contentLower.includes('visual') ||
            contentLower.includes('chart') ||
            contentLower.includes('graph');

        // RAG requirements
        const rag = contentLower.includes('search') ||
            contentLower.includes('find') ||
            contentLower.includes('retrieve') ||
            contentLower.includes('information') ||
            contentLower.includes('data') ||
            taskAnalysis.taskType === 'rag-operations';

        // Code generation requirements
        const codeGeneration = contentLower.includes('code') ||
            contentLower.includes('program') ||
            contentLower.includes('script') ||
            contentLower.includes('function') ||
            contentLower.includes('algorithm') ||
            taskAnalysis.taskType === 'code-generation';

        return { multimodal, rag, codeGeneration };
    }

    /**
     * Generate default analysis when semantic analysis fails
     */
    private generateDefaultAnalysis(content: string): SemanticAnalysis {
        return {
            taskType: 'general',
            complexity: 'moderate',
            domain: 'general',
            confidence: 0.3,
            reasoning: ['Default analysis due to analysis failure'],
            estimatedTokens: content.length * 0.75,
            priority: 'medium',
            requiresMultimodal: false,
            requiresRAG: false,
            requiresCodeGeneration: false
        };
    }

    /**
 * Analyze attachments for task type indicators
 */
    private analyzeAttachmentsForTaskType(attachments: any[], reasoning: string[]): { taskType: string | null; score: number } {
        let bestTaskType: string | null = null;
        let bestScore = 0;

        for (const attachment of attachments) {
            const filename = attachment.filename.toLowerCase();
            const contentType = attachment.contentType.toLowerCase();
            let taskScore = 0;

            // Code-related files suggest code generation
            if (filename.match(/\.(py|js|ts|java|c|cpp|cs|php|rb|go|rs|swift|kt|scala|r|sql|sh|bash|ps1|yaml|yml|json|xml|html|css|vue|jsx|tsx)$/i) ||
                filename.includes('code') || filename.includes('script') || filename.includes('function') || filename.includes('algorithm')) {
                taskScore = Math.max(taskScore, 0.9);
                if (!bestTaskType || taskScore > bestScore) {
                    bestTaskType = 'code-generation';
                    bestScore = taskScore;
                }
            }

            // Image files suggest multimodal processing
            if (contentType.startsWith('image/') || filename.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff|ico)$/i) ||
                filename.includes('photo') || filename.includes('image') || filename.includes('visual') || filename.includes('logo')) {
                taskScore = Math.max(taskScore, 0.8);
                if (!bestTaskType || taskScore > bestScore) {
                    bestTaskType = 'creative-generation';
                    bestScore = taskScore;
                }
            }

                  // Document files suggest RAG operations
      if (filename.match(/\.(pdf|doc|docx|txt|md|rtf|odt|pages)$/i) || contentType.includes('document') ||
          filename.includes('report') || filename.includes('analysis') || filename.includes('study') || 
          filename.includes('research') || filename.includes('contract') || filename.includes('policy')) {
        taskScore = Math.max(taskScore, 0.8);
        if (!bestTaskType || taskScore > bestScore) {
          bestTaskType = 'rag-operations';
          bestScore = taskScore;
        }
      }
      
      // Research-specific files suggest research analysis
      if (filename.includes('research') || filename.includes('study') || filename.includes('trial') || 
          filename.includes('clinical') || filename.includes('survey') || filename.includes('investigation') ||
          filename.includes('analysis') || filename.includes('results') || filename.includes('data')) {
        taskScore = Math.max(taskScore, 0.9);
        if (!bestTaskType || taskScore > bestScore) {
          bestTaskType = 'research-analysis';
          bestScore = taskScore;
        }
      }

            // Data files suggest complex reasoning
            if (filename.match(/\.(csv|tsv|xlsx|xls|json|xml|sql|db|sqlite|parquet|avro|orc)$/i) ||
                filename.includes('data') || filename.includes('dataset') || filename.includes('results') ||
                filename.includes('metrics') || filename.includes('statistics')) {
                taskScore = Math.max(taskScore, 0.8);
                if (!bestTaskType || taskScore > bestScore) {
                    bestTaskType = 'complex-reasoning';
                    bestScore = taskScore;
                }
            }

            // Strategic planning indicators
            if (filename.includes('strategy') || filename.includes('plan') || filename.includes('roadmap') ||
                filename.includes('vision') || filename.includes('mission') || filename.includes('goals') ||
                filename.includes('objectives') || filename.includes('framework')) {
                taskScore = Math.max(taskScore, 0.8);
                if (!bestTaskType || taskScore > bestScore) {
                    bestTaskType = 'strategic-planning';
                    bestScore = taskScore;
                }
            }

            // Quick response indicators
            if (filename.includes('quick') || filename.includes('urgent') || filename.includes('immediate') ||
                filename.includes('fast') || filename.includes('rapid') || filename.includes('asap')) {
                taskScore = Math.max(taskScore, 0.7);
                if (!bestTaskType || taskScore > bestScore) {
                    bestTaskType = 'fast-response';
                    bestScore = taskScore;
                }
            }
        }

        if (bestTaskType && bestScore > 0.6) {
            reasoning.push(`Attachment task type indicators: ${bestTaskType} (confidence: ${(bestScore * 100).toFixed(1)}%)`);
        }

        return { taskType: bestTaskType, score: bestScore };
    }

    /**
     * Assess attachment complexity for routing decisions
     */
    private assessAttachmentComplexityForRouting(attachments: any[], reasoning: string[]): 'simple' | 'moderate' | 'complex' | 'expert' {
        let overallComplexity: 'simple' | 'moderate' | 'complex' | 'expert' = 'simple';
        let totalSize = 0;
        let hasLargeFiles = false;
        let hasCodeFiles = false;
        let hasDataFiles = false;

        for (const attachment of attachments) {
            const sizeMB = attachment.size / (1024 * 1024);
            totalSize += sizeMB;

            // Check for large files
            if (sizeMB > 10) {
                hasLargeFiles = true;
                reasoning.push(`Large file detected: ${attachment.filename} (${sizeMB.toFixed(1)}MB)`);
            }

            // Check for code files
            if (attachment.filename.match(/\.(py|js|ts|java|c|cpp|cs|php|rb|go|rs|swift|kt|scala|r|sql|sh|bash|ps1|yaml|yml|json|xml|html|css|vue|jsx|tsx)$/i)) {
                hasCodeFiles = true;
                reasoning.push(`Code file detected: ${attachment.filename}`);
            }

            // Check for data files
            if (attachment.filename.match(/\.(csv|tsv|xlsx|xls|json|xml|sql|db|sqlite|parquet|avro|orc)$/i)) {
                hasDataFiles = true;
                reasoning.push(`Data file detected: ${attachment.filename}`);
            }
        }

        // Determine complexity based on attachment characteristics
        if (hasLargeFiles || totalSize > 20) {
            overallComplexity = 'expert';
            reasoning.push('Large file size suggests expert complexity');
        } else if (hasCodeFiles && hasDataFiles) {
            overallComplexity = 'complex';
            reasoning.push('Code + data files suggest complex processing');
        } else if (hasCodeFiles || hasDataFiles || totalSize > 5) {
            overallComplexity = 'moderate';
            reasoning.push('Code/data files or medium size suggest moderate complexity');
        }

        reasoning.push(`Attachment complexity assessment: ${overallComplexity} (total size: ${totalSize.toFixed(1)}MB)`);
        return overallComplexity;
    }

    /**
     * Analyze attachments for domain indicators
     */
    private analyzeAttachmentsForDomain(attachments: any[], reasoning: string[]): { domain: string | null; score: number } {
        let bestDomain: string | null = null;
        let bestScore = 0;

        for (const attachment of attachments) {
            const filename = attachment.filename.toLowerCase();
            let domainScore = 0;

            // Check filename for domain indicators
            if (filename.includes('financial') || filename.includes('budget') || filename.includes('revenue') ||
                filename.includes('profit') || filename.includes('investment') || filename.includes('stock') ||
                filename.includes('market') || filename.includes('forecast') || filename.includes('modeling')) {
                domainScore = Math.max(domainScore, 0.8);
                if (!bestDomain || domainScore > bestScore) {
                    bestDomain = 'financial';
                    bestScore = domainScore;
                }
            }

                  if (filename.includes('technical') || filename.includes('architecture') || filename.includes('system') ||
          filename.includes('infrastructure') || filename.includes('performance') || filename.includes('scalability') ||
          filename.includes('security') || filename.includes('code') || filename.includes('api') ||
          filename.includes('database') || filename.includes('network') || filename.includes('algorithm') ||
          filename.includes('function') || filename.includes('script') || filename.includes('module')) {
        domainScore = Math.max(domainScore, 0.9);
        if (!bestDomain || domainScore > bestScore) {
          bestDomain = 'technical';
          bestScore = domainScore;
        }
      }
      
      // Code files with specific extensions strongly indicate technical domain
      const codeExt = filename.split('.').pop()?.toLowerCase();
      if (codeExt && ['py', 'js', 'ts', 'java', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'sql', 'sh', 'bash', 'ps1'].includes(codeExt)) {
        domainScore = Math.max(domainScore, 0.95);
        if (!bestDomain || domainScore > bestScore) {
          bestDomain = 'technical';
          bestScore = domainScore;
        }
      }

            if (filename.includes('legal') || filename.includes('contract') || filename.includes('compliance') ||
                filename.includes('regulation') || filename.includes('policy') || filename.includes('law') ||
                filename.includes('litigation') || filename.includes('agreement')) {
                domainScore = Math.max(domainScore, 0.9);
                if (!bestDomain || domainScore > bestScore) {
                    bestDomain = 'legal';
                    bestScore = domainScore;
                }
            }

            if (filename.includes('medical') || filename.includes('healthcare') || filename.includes('clinical') ||
                filename.includes('patient') || filename.includes('diagnosis') || filename.includes('treatment') ||
                filename.includes('trial') || filename.includes('consent') || filename.includes('hipaa')) {
                domainScore = Math.max(domainScore, 0.9);
                if (!bestDomain || domainScore > bestScore) {
                    bestDomain = 'healthcare';
                    bestScore = domainScore;
                }
            }

            if (filename.includes('research') || filename.includes('analysis') || filename.includes('study') ||
                filename.includes('investigation') || filename.includes('exploration') || filename.includes('discovery') ||
                filename.includes('survey') || filename.includes('report')) {
                domainScore = Math.max(domainScore, 0.8);
                if (!bestDomain || domainScore > bestScore) {
                    bestDomain = 'research';
                    bestScore = domainScore;
                }
            }

            if (filename.includes('creative') || filename.includes('story') || filename.includes('narrative') ||
                filename.includes('content') || filename.includes('marketing') || filename.includes('brand') ||
                filename.includes('campaign') || filename.includes('design') || filename.includes('logo') ||
                filename.includes('photo') || filename.includes('image')) {
                domainScore = Math.max(domainScore, 0.8);
                if (!bestDomain || domainScore > bestScore) {
                    bestDomain = 'creative';
                    bestScore = domainScore;
                }
            }

            if (filename.includes('education') || filename.includes('learning') || filename.includes('curriculum') ||
                filename.includes('training') || filename.includes('assessment') || filename.includes('pedagogy') ||
                filename.includes('course') || filename.includes('lesson') || filename.includes('tutorial')) {
                domainScore = Math.max(domainScore, 0.8);
                if (!bestDomain || domainScore > bestScore) {
                    bestDomain = 'education';
                    bestScore = domainScore;
                }
            }

                  // Check file extensions for domain hints
      const ext = filename.split('.').pop()?.toLowerCase();
      
      // Code files strongly indicate technical domain
      if (ext === 'py' || ext === 'js' || ext === 'ts' || ext === 'java' || ext === 'cpp' || ext === 'cs' || 
          ext === 'php' || ext === 'rb' || ext === 'go' || ext === 'rs' || ext === 'swift' || ext === 'kt' || 
          ext === 'scala' || ext === 'r' || ext === 'sql' || ext === 'sh' || ext === 'bash' || ext === 'ps1' || 
          ext === 'yaml' || ext === 'yml' || ext === 'json' || ext === 'xml' || ext === 'html' || ext === 'css' || 
          ext === 'vue' || ext === 'jsx' || ext === 'tsx') {
        if (bestDomain === 'technical') {
          bestScore = Math.min(0.95, bestScore + 0.2); // Strong boost for technical domain
        } else {
          // If no technical domain detected yet, create one
          bestDomain = 'technical';
          bestScore = 0.9; // High confidence for code files
          reasoning.push(`Code file extension (.${ext}) strongly indicates technical domain`);
        }
      }

            if (ext === 'pdf' && (filename.includes('contract') || filename.includes('legal') || filename.includes('compliance'))) {
                if (bestDomain === 'legal') {
                    bestScore = Math.min(0.95, bestScore + 0.1); // Boost legal domain
                }
            }

            if (ext === 'csv' && (filename.includes('financial') || filename.includes('revenue') || filename.includes('budget'))) {
                if (bestDomain === 'financial') {
                    bestScore = Math.min(0.95, bestScore + 0.1); // Boost financial domain
                }
            }
        }

        if (bestDomain && bestScore > 0.6) {
            reasoning.push(`Attachment domain indicators: ${bestDomain} (confidence: ${(bestScore * 100).toFixed(1)}%)`);
        }

        return { domain: bestDomain, score: bestScore };
    }

    /**
     * Analyze attachments to determine their characteristics
     */
    private async analyzeAttachments(attachments: any[], primaryDomain: string): Promise<AttachmentAnalysis[]> {
        const analysis: AttachmentAnalysis[] = [];

        for (const attachment of attachments) {
            try {
                const attachmentAnalysis = await this.analyzeSingleAttachment(attachment, primaryDomain);
                analysis.push(attachmentAnalysis);
            } catch (error) {
                this.logger.warn(`Failed to analyze attachment ${attachment.filename}`, error);
                // Add default analysis for failed attachments
                analysis.push(this.generateDefaultAttachmentAnalysis(attachment));
            }
        }

        return analysis;
    }

    /**
     * Analyze a single attachment
     */
    private async analyzeSingleAttachment(attachment: any, primaryDomain: string): Promise<AttachmentAnalysis> {
        const filename = attachment.filename.toLowerCase();
        const contentType = attachment.contentType.toLowerCase();
        const reasoning: string[] = [];

        // 1. Detect file type
        const detectedType = this.detectFileType(filename, contentType, reasoning);

        // 2. Detect language (for code files)
        const language = this.detectLanguage(filename);

        // 3. Assess complexity
        const complexity = this.assessAttachmentComplexity(attachment, detectedType, primaryDomain, reasoning);

        // 4. Determine domain
        const domain = this.determineAttachmentDomain(attachment, primaryDomain, reasoning);

        // 5. Assess sensitivity
        const sensitivity = this.assessAttachmentSensitivity(attachment, reasoning);

        // 6. Determine processing requirements
        const processingRequirements = this.determineProcessingRequirements(detectedType, complexity, domain, reasoning);

        // 7. Estimate tokens
        const estimatedTokens = this.estimateAttachmentTokens(attachment, detectedType, complexity);

        // 8. Calculate confidence
        const confidence = this.calculateAttachmentConfidence(detectedType, complexity, domain, reasoning);

        return {
            id: attachment.id,
            filename: attachment.filename,
            contentType: attachment.contentType,
            detectedType,
            language: language || undefined,
            complexity,
            domain,
            sensitivity,
            processingRequirements,
            estimatedTokens,
            confidence,
            reasoning
        };
    }

    /**
     * Detect file type based on filename and content type
     */
    private detectFileType(filename: string, contentType: string, reasoning: string[]): 'text' | 'code' | 'image' | 'document' | 'data' | 'unknown' {
        // Image files
        if (contentType.startsWith('image/') ||
            filename.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff|ico)$/i)) {
            reasoning.push('File type: image (based on content type and extension)');
            return 'image';
        }

        // Code files
        if (filename.match(/\.(py|js|ts|java|c|cpp|cs|php|rb|go|rs|swift|kt|scala|r|sql|sh|bash|ps1|yaml|yml|json|xml|html|css|vue|jsx|tsx)$/i)) {
            reasoning.push('File type: code (based on file extension)');
            return 'code';
        }

        // Document files
        if (filename.match(/\.(pdf|doc|docx|txt|md|rtf|odt|pages)$/i) ||
            contentType.includes('document') ||
            contentType.includes('text/')) {
            reasoning.push('File type: document (based on file extension and content type)');
            return 'document';
        }

        // Data files
        if (filename.match(/\.(csv|tsv|xlsx|xls|json|xml|sql|db|sqlite|parquet|avro|orc)$/i)) {
            reasoning.push('File type: data (based on file extension)');
            return 'data';
        }

        // Text files
        if (contentType.startsWith('text/') ||
            filename.match(/\.(txt|md|log|cfg|conf|ini|env)$/i)) {
            reasoning.push('File type: text (based on content type and extension)');
            return 'text';
        }

        reasoning.push('File type: unknown (could not determine from filename or content type)');
        return 'unknown';
    }

    /**
     * Detect programming language from filename
     */
    private detectLanguage(filename: string): string | undefined {
        const ext = filename.split('.').pop()?.toLowerCase();

        const languageMap: { [key: string]: string } = {
            'py': 'Python', 'js': 'JavaScript', 'ts': 'TypeScript', 'java': 'Java',
            'c': 'C', 'cpp': 'C++', 'cs': 'C#', 'php': 'PHP', 'rb': 'Ruby',
            'go': 'Go', 'rs': 'Rust', 'swift': 'Swift', 'kt': 'Kotlin',
            'scala': 'Scala', 'r': 'R', 'sql': 'SQL', 'sh': 'Shell',
            'bash': 'Bash', 'ps1': 'PowerShell', 'yaml': 'YAML', 'yml': 'YAML',
            'json': 'JSON', 'xml': 'XML', 'html': 'HTML', 'css': 'CSS'
        };

        return languageMap[ext || ''] || undefined;
    }

    /**
     * Assess attachment complexity
     */
    private assessAttachmentComplexity(attachment: any, detectedType: string, primaryDomain: string, reasoning: string[]): 'simple' | 'moderate' | 'complex' | 'expert' {
        let complexity: 'simple' | 'moderate' | 'complex' | 'expert' = 'moderate';

        // Size-based complexity
        const sizeMB = attachment.size / (1024 * 1024);
        if (sizeMB > 10) {
            complexity = 'expert';
            reasoning.push(`Large file size (${sizeMB.toFixed(1)}MB) suggests expert complexity`);
        } else if (sizeMB > 1) {
            complexity = 'complex';
            reasoning.push(`Medium file size (${sizeMB.toFixed(1)}MB) suggests complex complexity`);
        } else if (sizeMB < 0.1) {
            complexity = 'simple';
            reasoning.push(`Small file size (${sizeMB.toFixed(1)}MB) suggests simple complexity`);
        }

        // Type-based complexity
        if (detectedType === 'code') {
            if (complexity === 'simple') complexity = 'moderate';
            if (complexity === 'moderate') complexity = 'complex';
            reasoning.push('Code files typically require moderate to complex processing');
        }

        if (detectedType === 'image') {
            if (sizeMB > 5) {
                complexity = 'expert';
                reasoning.push('Large images require expert-level processing');
            }
        }

        if (detectedType === 'data') {
            if (sizeMB > 1) {
                complexity = 'complex';
                reasoning.push('Data files require complex analysis');
            }
        }

        // Domain-based complexity adjustment
        if (primaryDomain === 'technical' || primaryDomain === 'legal' || primaryDomain === 'healthcare') {
            if (complexity === 'simple') complexity = 'moderate';
            if (complexity === 'moderate') complexity = 'complex';
            reasoning.push(`Domain ${primaryDomain} typically requires higher complexity processing`);
        }

        return complexity;
    }

    /**
     * Determine attachment domain
     */
    private determineAttachmentDomain(attachment: any, primaryDomain: string, reasoning: string[]): string {
        // Use primary domain as default, but allow for domain-specific overrides
        const filename = attachment.filename.toLowerCase();

        // Domain-specific patterns
        if (filename.includes('financial') || filename.includes('budget') || filename.includes('revenue')) {
            reasoning.push('Financial domain detected from filename');
            return 'financial';
        }

        if (filename.includes('legal') || filename.includes('contract') || filename.includes('compliance')) {
            reasoning.push('Legal domain detected from filename');
            return 'legal';
        }

        if (filename.includes('medical') || filename.includes('clinical') || filename.includes('patient')) {
            reasoning.push('Healthcare domain detected from filename');
            return 'healthcare';
        }

        if (filename.includes('technical') || filename.includes('architecture') || filename.includes('system')) {
            reasoning.push('Technical domain detected from filename');
            return 'technical';
        }

        reasoning.push(`Using primary domain: ${primaryDomain}`);
        return primaryDomain;
    }

    /**
     * Assess attachment sensitivity
     */
    private assessAttachmentSensitivity(attachment: any, reasoning: string[]): 'public' | 'internal' | 'confidential' | 'restricted' {
        const filename = attachment.filename.toLowerCase();

        // Check for sensitive indicators
        if (filename.includes('confidential') || filename.includes('secret') || filename.includes('private')) {
            reasoning.push('Sensitivity: restricted (based on filename)');
            return 'restricted';
        }

        if (filename.includes('internal') || filename.includes('private') || filename.includes('personal')) {
            reasoning.push('Sensitivity: confidential (based on filename)');
            return 'confidential';
        }

        if (filename.includes('public') || filename.includes('shared') || filename.includes('open')) {
            reasoning.push('Sensitivity: public (based on filename)');
            return 'public';
        }

        // Default to internal for business files
        reasoning.push('Sensitivity: internal (default for business files)');
        return 'internal';
    }

    /**
     * Determine processing requirements
     */
    private determineProcessingRequirements(
        detectedType: string,
        complexity: string,
        domain: string,
        reasoning: string[]
    ): string[] {
        const requirements: string[] = [];

        // Type-based requirements
        if (detectedType === 'image') {
            requirements.push('image-analysis', 'multimodal-processing');
            reasoning.push('Image files require image analysis and multimodal processing');
        }

        if (detectedType === 'code') {
            requirements.push('code-analysis', 'syntax-validation');
            reasoning.push('Code files require code analysis and syntax validation');
        }

        if (detectedType === 'document') {
            requirements.push('text-extraction', 'document-parsing');
            reasoning.push('Document files require text extraction and document parsing');
        }

        if (detectedType === 'data') {
            requirements.push('data-analysis', 'schema-validation');
            reasoning.push('Data files require data analysis and schema validation');
        }

        // Complexity-based requirements
        if (complexity === 'expert') {
            requirements.push('advanced-processing', 'quality-validation');
            reasoning.push('Expert complexity requires advanced processing and quality validation');
        }

        if (complexity === 'complex') {
            requirements.push('detailed-analysis', 'error-handling');
            reasoning.push('Complex files require detailed analysis and error handling');
        }

        // Domain-based requirements
        if (domain === 'legal') {
            requirements.push('compliance-checking', 'audit-trail');
            reasoning.push('Legal domain requires compliance checking and audit trail');
        }

        if (domain === 'healthcare') {
            requirements.push('hipaa-compliance', 'data-privacy');
            reasoning.push('Healthcare domain requires HIPAA compliance and data privacy');
        }

        if (domain === 'financial') {
            requirements.push('data-validation', 'security-scanning');
            reasoning.push('Financial domain requires data validation and security scanning');
        }

        return requirements;
    }

    /**
     * Estimate tokens for attachment processing
     */
    private estimateAttachmentTokens(attachment: any, detectedType: string, complexity: string): number {
        const baseTokens = attachment.size * 0.1; // Rough estimation

        const typeMultipliers = {
            'text': 1.0,
            'code': 1.5,
            'document': 2.0,
            'data': 2.5,
            'image': 3.0,
            'unknown': 1.5
        };

        const complexityMultipliers = {
            'simple': 1.0,
            'moderate': 1.5,
            'complex': 2.5,
            'expert': 4.0
        };

        const typeMultiplier = typeMultipliers[detectedType as keyof typeof typeMultipliers] || 1.0;
        const complexityMultiplier = complexityMultipliers[complexity as keyof typeof complexityMultipliers] || 1.0;

        return Math.ceil(baseTokens * typeMultiplier * complexityMultiplier);
    }

    /**
     * Calculate confidence for attachment analysis
     */
    private calculateAttachmentConfidence(
        detectedType: string,
        complexity: string,
        domain: string,
        reasoning: string[]
    ): number {
        let confidence = 0.7; // Base confidence

        // Boost confidence for clear file types
        if (detectedType !== 'unknown') confidence += 0.1;

        // Boost confidence for clear complexity indicators
        if (complexity !== 'moderate') confidence += 0.1;

        // Boost confidence for domain-specific files
        if (domain !== 'general') confidence += 0.1;

        // Reduce confidence for many reasoning points (indicating uncertainty)
        if (reasoning.length > 5) confidence -= 0.1;

        return Math.min(0.95, Math.max(0.3, confidence));
    }

    /**
     * Generate default attachment analysis when analysis fails
     */
    private generateDefaultAttachmentAnalysis(attachment: any): AttachmentAnalysis {
        return {
            id: attachment.id,
            filename: attachment.filename,
            contentType: attachment.contentType,
            detectedType: 'unknown',
            language: undefined,
            complexity: 'moderate',
            domain: 'general',
            sensitivity: 'internal',
            processingRequirements: ['basic-processing'],
            estimatedTokens: attachment.size * 0.1,
            confidence: 0.3,
            reasoning: ['Default analysis due to analysis failure']
        };
    }

    /**
     * Get domain-specific routing recommendations
     */
    getDomainRoutingRecommendations(domain: string): any {
        const domainConfigs = {
            'financial': {
                preferredModels: ['claude-4.1-opus', 'claude-4-sonnet'],
                minQuality: 0.9,
                maxLatency: 20000,
                costTolerance: 'high'
            },
            'technical': {
                preferredModels: ['claude-4.1-opus', 'claude-4-sonnet', 'codey'],
                minQuality: 0.95,
                maxLatency: 30000,
                costTolerance: 'high'
            },
            'creative': {
                preferredModels: ['claude-4-sonnet', 'claude-3.5-sonnet', 'gemini-pro'],
                minQuality: 0.8,
                maxLatency: 15000,
                costTolerance: 'medium'
            },
            'research': {
                preferredModels: ['claude-4.1-opus', 'claude-4-sonnet'],
                minQuality: 0.9,
                maxLatency: 25000,
                costTolerance: 'high'
            },
            'legal': {
                preferredModels: ['claude-4.1-opus', 'claude-4-sonnet'],
                minQuality: 0.95,
                maxLatency: 30000,
                costTolerance: 'high'
            },
            'healthcare': {
                preferredModels: ['claude-4.1-opus', 'claude-4-sonnet'],
                minQuality: 0.95,
                maxLatency: 25000,
                costTolerance: 'high'
            },
            'education': {
                preferredModels: ['claude-4-sonnet', 'claude-3.5-sonnet', 'gemini-pro'],
                minQuality: 0.85,
                maxLatency: 20000,
                costTolerance: 'medium'
            }
        };

        return domainConfigs[domain as keyof typeof domainConfigs] || {
            preferredModels: ['claude-4-sonnet', 'claude-3.5-sonnet'],
            minQuality: 0.8,
            maxLatency: 15000,
            costTolerance: 'medium'
        };
    }
}

export const semanticAnalysisService = new SemanticAnalysisService();
