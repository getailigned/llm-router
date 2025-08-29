// =============================================================================
// LLM Router Service - Prompt Injection Protection Service
// =============================================================================

import { createLogger } from './loggerService';
import { LLMRequest, SecurityAnomaly } from '../types';

// =============================================================================
// PROMPT INJECTION PROTECTION SERVICE
// =============================================================================

export class PromptInjectionProtectionService {
    private logger = createLogger('PromptInjectionProtection');

    // Known prompt injection patterns and techniques
    private readonly INJECTION_PATTERNS = {
        // Direct instruction injection
        directInstructions: [
            /ignore previous instructions/i,
            /forget everything/i,
            /disregard all previous/i,
            /stop following instructions/i,
            /new instructions:/i,
            /system prompt:/i,
            /override:/i,
            /ignore above/i,
            /disregard above/i,
            /new system:/i,
            /system message:/i,
            /ignore the above/i,
            /disregard the above/i,
            /new rules:/i,
            /override rules:/i,
            /ignore rules/i,
            /disregard rules/i,
            /new guidelines:/i,
            /override guidelines/i,
            /ignore guidelines/i,
            /disregard guidelines/i
        ],

        // Role manipulation
        roleManipulation: [
            /you are now/i,
            /act as if you are/i,
            /pretend you are/i,
            /roleplay as/i,
            /you have become/i,
            /you are no longer/i,
            /you have switched to/i,
            /you are now a different/i,
            /you are now an/i,
            /you are now the/i,
            /you are now acting as/i,
            /you are now pretending to be/i,
            /you are now roleplaying as/i,
            /you are now simulating/i,
            /you are now emulating/i
        ],

        // Context manipulation
        contextManipulation: [
            /this is a test/i,
            /this is just a test/i,
            /this is only a test/i,
            /this is not real/i,
            /this is fake/i,
            /this is simulated/i,
            /this is hypothetical/i,
            /this is theoretical/i,
            /this is imaginary/i,
            /this is fictional/i,
            /this is made up/i,
            /this is pretend/i,
            /this is roleplay/i,
            /this is a game/i,
            /this is play/i
        ],

        // System prompt extraction
        systemExtraction: [
            /what are your instructions/i,
            /what are your rules/i,
            /what are your guidelines/i,
            /what are your constraints/i,
            /what are your limitations/i,
            /what are your capabilities/i,
            /what are your functions/i,
            /what are your purposes/i,
            /what are your goals/i,
            /what are your objectives/i,
            /what are your directives/i,
            /what are your commands/i,
            /what are your orders/i,
            /what are your requirements/i,
            /what are your specifications/i
        ],

        // Jailbreak attempts
        jailbreakAttempts: [
            /bypass safety/i,
            /ignore safety/i,
            /disable safety/i,
            /remove safety/i,
            /circumvent safety/i,
            /evade safety/i,
            /avoid safety/i,
            /skip safety/i,
            /override safety/i,
            /disable restrictions/i,
            /remove restrictions/i,
            /bypass restrictions/i,
            /ignore restrictions/i,
            /circumvent restrictions/i,
            /evade restrictions/i
        ],

        // Encoding and obfuscation
        encodingAttempts: [
            /base64:/i,
            /hex:/i,
            /binary:/i,
            /rot13:/i,
            /caesar:/i,
            /substitution:/i,
            /transposition:/i,
            /cipher:/i,
            /encode:/i,
            /decode:/i,
            /encrypt:/i,
            /decrypt:/i,
            /hash:/i,
            /checksum:/i,
            /signature:/i
        ],

        // Unicode and special characters
        unicodeManipulation: [
            /[\u0000-\u001F\u007F-\u009F]/, // Control characters
            /[\u200B-\u200F\u2028-\u202F\u205F-\u206F]/, // Zero-width and formatting characters
            /[\u2060-\u2064\u206A-\u206F]/, // More formatting characters
            /[\uFEFF\uFFFE]/, // Byte order marks
            /[\uFF00-\uFFEF]/, // Full-width characters
            /[\u0300-\u036F]/, // Combining diacritical marks
            /[\u1AB0-\u1AFF]/, // Combining diacritical marks extended
            /[\u20D0-\u20FF]/, // Combining diacritical marks for symbols
            /[\uFE20-\uFE2F]/, // Combining half marks
            /[\uE0100-\uE01EF]/ // Variation selectors
        ],

        // HTML and script injection
        scriptInjection: [
            /<script/i,
            /javascript:/i,
            /vbscript:/i,
            /data:/i,
            /on\w+\s*=/i,
            /<iframe/i,
            /<object/i,
            /<embed/i,
            /<form/i,
            /<input/i,
            /<textarea/i,
            /<select/i,
            /<button/i,
            /<link/i,
            /<meta/i
        ],

        // SQL injection patterns
        sqlInjection: [
            /union\s+select/i,
            /drop\s+table/i,
            /delete\s+from/i,
            /insert\s+into/i,
            /update\s+set/i,
            /alter\s+table/i,
            /create\s+table/i,
            /exec\s*\(/i,
            /execute\s*\(/i,
            /xp_cmdshell/i,
            /sp_executesql/i,
            /waitfor\s+delay/i,
            /benchmark\s*\(/i,
            /sleep\s*\(/i,
            /pg_sleep/i
        ],

        // Command injection
        commandInjection: [
            /;\s*\w+\s*;/i,
            /\|\s*\w+/i,
            /&&\s*\w+/i,
            /\|\|\s*\w+/i,
            /`.*`/i,
            /\$\(.*\)/i,
            /eval\s*\(/i,
            /exec\s*\(/i,
            /system\s*\(/i,
            /shell_exec\s*\(/i,
            /passthru\s*\(/i,
            /proc_open\s*\(/i,
            /popen\s*\(/i,
            /curl_exec\s*\(/i,
            /file_get_contents\s*\(/i
        ]
    };

    // Prompt injection risk levels
    private readonly RISK_LEVELS = {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    };

    // Maximum allowed prompt length
    private readonly MAX_PROMPT_LENGTH = 10000;

    // Maximum allowed special characters ratio
    private readonly MAX_SPECIAL_CHAR_RATIO = 0.3;

    // Maximum allowed consecutive special characters
    private readonly MAX_CONSECUTIVE_SPECIAL = 5;

    constructor() {
        this.logger.info('Prompt injection protection service initialized');
    }

    // =============================================================================
    // MAIN PROTECTION METHODS
    // =============================================================================

    /**
     * Comprehensive prompt injection protection check
     */
    async protectAgainstInjection(request: LLMRequest): Promise<{
        isSafe: boolean;
        riskLevel: string;
        anomalies: SecurityAnomaly[];
        sanitizedContent: string;
        blocked: boolean;
    }> {
        try {
            this.logger.info('Starting prompt injection protection check', {
                requestId: request.id,
                contentLength: request.content.length
            });

            const anomalies: SecurityAnomaly[] = [];
            let riskLevel = this.RISK_LEVELS.LOW;
            let blocked = false;

            // 1. Length validation
            const lengthCheck = this.validatePromptLength(request.content);
            if (!lengthCheck.isValid) {
                anomalies.push({
                    type: 'prompt_length_violation',
                    severity: 'medium',
                    details: `Prompt length ${request.content.length} exceeds maximum ${this.MAX_PROMPT_LENGTH}`,
                    timestamp: new Date(),
                    requestId: request.id
                });
                riskLevel = this.RISK_LEVELS.MEDIUM;
            }

            // 2. Pattern-based detection
            const patternCheck = this.detectInjectionPatterns(request.content);
            anomalies.push(...patternCheck.anomalies);

            if (patternCheck.criticalCount > 0) {
                riskLevel = this.RISK_LEVELS.CRITICAL;
                blocked = true;
            } else if (patternCheck.highCount > 0) {
                riskLevel = this.RISK_LEVELS.HIGH;
            } else if (patternCheck.mediumCount > 0) {
                riskLevel = this.RISK_LEVELS.MEDIUM;
            }

            // 3. Character analysis
            const characterCheck = this.analyzeCharacterPatterns(request.content);
            anomalies.push(...characterCheck.anomalies);

            if (characterCheck.riskLevel === this.RISK_LEVELS.CRITICAL) {
                riskLevel = this.RISK_LEVELS.CRITICAL;
                blocked = true;
            }

            // 4. Semantic analysis
            const semanticCheck = await this.performSemanticAnalysis(request.content);
            anomalies.push(...semanticCheck.anomalies);

            if (semanticCheck.riskLevel === this.RISK_LEVELS.CRITICAL) {
                riskLevel = this.RISK_LEVELS.CRITICAL;
                blocked = true;
            }

            // 5. Rate limiting check
            const rateLimitCheck = await this.checkRateLimiting(request);
            if (!rateLimitCheck.allowed) {
                anomalies.push({
                    type: 'rate_limit_exceeded',
                    severity: 'high',
                    details: `Rate limit exceeded for service ${request.serviceName}`,
                    timestamp: new Date(),
                    requestId: request.id
                });
                blocked = true;
            }

            // 6. Sanitize content if not blocked
            let sanitizedContent = request.content;
            if (!blocked) {
                sanitizedContent = this.sanitizeContent(request.content);
            }

            // 7. Log security event
            await this.logSecurityEvent(request, {
                riskLevel,
                anomalies,
                blocked,
                originalLength: request.content.length,
                sanitizedLength: sanitizedContent.length
            });

            // 8. Update threat intelligence
            await this.updateThreatIntelligence(request, anomalies);

            const result = {
                isSafe: !blocked && riskLevel !== this.RISK_LEVELS.CRITICAL,
                riskLevel,
                anomalies,
                sanitizedContent,
                blocked
            };

            this.logger.info('Prompt injection protection check completed', {
                requestId: request.id,
                riskLevel,
                blocked,
                anomalyCount: anomalies.length
            });

            return result;

        } catch (error) {
            this.logger.error('Error in prompt injection protection check', error, {
                requestId: request.id
            });

            // Fail safe - block request if protection fails
            return {
                isSafe: false,
                riskLevel: this.RISK_LEVELS.CRITICAL,
                anomalies: [{
                    type: 'protection_service_failure',
                    severity: 'critical',
                    details: 'Prompt injection protection service failed',
                    timestamp: new Date(),
                    requestId: request.id
                }],
                sanitizedContent: '',
                blocked: true
            };
        }
    }

    // =============================================================================
    // PATTERN DETECTION METHODS
    // =============================================================================

    /**
     * Detect injection patterns in the prompt
     */
    private detectInjectionPatterns(content: string): {
        anomalies: SecurityAnomaly[];
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
    } {
        const anomalies: SecurityAnomaly[] = [];
        let criticalCount = 0;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;

        // Check each pattern category
        for (const [category, patterns] of Object.entries(this.INJECTION_PATTERNS)) {
            for (const pattern of patterns) {
                const matches = content.match(pattern);
                if (matches) {
                    const severity = this.categorizePatternSeverity(category, matches);
                    const anomaly: SecurityAnomaly = {
                        type: 'prompt_injection_pattern',
                        severity,
                        details: `Detected ${category} pattern: "${matches[0]}"`,
                        timestamp: new Date()
                    };

                    anomalies.push(anomaly);

                    // Count by severity
                    switch (severity) {
                        case 'critical':
                            criticalCount++;
                            break;
                        case 'high':
                            highCount++;
                            break;
                        case 'medium':
                            mediumCount++;
                            break;
                        case 'low':
                            lowCount++;
                            break;
                    }
                }
            }
        }

        return {
            anomalies,
            criticalCount,
            highCount,
            mediumCount,
            lowCount
        };
    }

    /**
     * Categorize pattern severity based on category and context
     */
    private categorizePatternSeverity(category: string, _matches: RegExpMatchArray): 'low' | 'medium' | 'high' | 'critical' {
        // Critical patterns
        if (category === 'directInstructions' || category === 'jailbreakAttempts') {
            return 'critical';
        }

        // High risk patterns
        if (category === 'roleManipulation' || category === 'systemExtraction') {
            return 'high';
        }

        // Medium risk patterns
        if (category === 'contextManipulation' || category === 'scriptInjection') {
            return 'medium';
        }

        // Low risk patterns
        if (category === 'encodingAttempts' || category === 'unicodeManipulation') {
            return 'low';
        }

        // Default to medium for unknown categories
        return 'medium';
    }

    // =============================================================================
    // CHARACTER ANALYSIS METHODS
    // =============================================================================

    /**
     * Analyze character patterns for suspicious content
     */
    private analyzeCharacterPatterns(content: string): {
        anomalies: SecurityAnomaly[];
        riskLevel: string;
    } {
        const anomalies: SecurityAnomaly[] = [];
        let riskLevel = this.RISK_LEVELS.LOW;

        // Check for excessive special characters
        const specialCharCount = (content.match(/[^a-zA-Z0-9\s]/g) || []).length;
        const specialCharRatio = specialCharCount / content.length;

        if (specialCharRatio > this.MAX_SPECIAL_CHAR_RATIO) {
            anomalies.push({
                type: 'excessive_special_characters',
                severity: 'medium',
                details: `Special character ratio ${specialCharRatio.toFixed(3)} exceeds threshold ${this.MAX_SPECIAL_CHAR_RATIO}`,
                timestamp: new Date(),

            });
            riskLevel = this.RISK_LEVELS.MEDIUM;
        }

        // Check for consecutive special characters
        const consecutiveSpecial = content.match(/[^a-zA-Z0-9\s]{2,}/g) || [];
        for (const match of consecutiveSpecial) {
            if (match.length > this.MAX_CONSECUTIVE_SPECIAL) {
                anomalies.push({
                    type: 'consecutive_special_characters',
                    severity: 'high',
                    details: `Found ${match.length} consecutive special characters: "${match}"`,
                    timestamp: new Date(),

                });
                riskLevel = this.RISK_LEVELS.HIGH;
            }
        }

        // Check for control characters
        const controlChars = content.match(/[\x00-\x1F\x7F]/g);
        if (controlChars && controlChars.length > 0) {
            anomalies.push({
                type: 'control_characters_detected',
                severity: 'critical',
                details: `Found ${controlChars.length} control characters`,
                timestamp: new Date(),

            });
            riskLevel = this.RISK_LEVELS.CRITICAL;
        }

        // Check for encoding anomalies
        const encodingAnomalies = this.detectEncodingAnomalies(content);
        anomalies.push(...encodingAnomalies);

        if (encodingAnomalies.some(a => a.severity === 'critical')) {
            riskLevel = this.RISK_LEVELS.CRITICAL;
        }

        return { anomalies, riskLevel };
    }

    /**
     * Detect encoding anomalies
     */
    private detectEncodingAnomalies(content: string): SecurityAnomaly[] {
        const anomalies: SecurityAnomaly[] = [];

        // Check for mixed encodings
        const hasUtf8 = /[\u0080-\uFFFF]/.test(content);
        const hasAscii = /[\x00-\x7F]/.test(content);

        if (hasUtf8 && hasAscii) {
            // Check for suspicious UTF-8 sequences
            const suspiciousUtf8 = content.match(/[\u0300-\u036F\u1AB0-\u1AFF\u20D0-\u20FF]/g);
            if (suspiciousUtf8 && suspiciousUtf8.length > 5) {
                anomalies.push({
                    type: 'suspicious_utf8_sequences',
                    severity: 'high',
                    details: `Found ${suspiciousUtf8.length} suspicious UTF-8 sequences`,
                    timestamp: new Date(),

                });
            }
        }

        // Check for zero-width characters
        const zeroWidthChars = content.match(/[\u200B-\u200F\u2028-\u202F\u205F-\u206F\u2060-\u2064\u206A-\u206F]/g);
        if (zeroWidthChars && zeroWidthChars.length > 3) {
            anomalies.push({
                type: 'zero_width_characters',
                severity: 'medium',
                details: `Found ${zeroWidthChars.length} zero-width characters`,
                timestamp: new Date(),

            });
        }

        return anomalies;
    }

    // =============================================================================
    // SEMANTIC ANALYSIS METHODS
    // =============================================================================

    /**
     * Perform semantic analysis for prompt injection
     */
    private async performSemanticAnalysis(content: string): Promise<{
        anomalies: SecurityAnomaly[];
        riskLevel: string;
    }> {
        const anomalies: SecurityAnomaly[] = [];
        let riskLevel = this.RISK_LEVELS.LOW;

        try {
            // Check for semantic contradictions
            const contradictions = this.detectSemanticContradictions(content);
            if (contradictions.length > 0) {
                anomalies.push({
                    type: 'semantic_contradictions',
                    severity: 'medium',
                    details: `Detected ${contradictions.length} semantic contradictions`,
                    timestamp: new Date(),

                });
                riskLevel = this.RISK_LEVELS.MEDIUM;
            }

            // Check for context switching
            const contextSwitches = this.detectContextSwitching(content);
            if (contextSwitches.length > 0) {
                anomalies.push({
                    type: 'context_switching',
                    severity: 'high',
                    details: `Detected ${contextSwitches.length} context switches`,
                    timestamp: new Date(),

                });
                riskLevel = this.RISK_LEVELS.HIGH;
            }

            // Check for instruction manipulation
            const instructionManipulation = this.detectInstructionManipulation(content);
            if (instructionManipulation) {
                anomalies.push({
                    type: 'instruction_manipulation',
                    severity: 'critical',
                    details: 'Detected instruction manipulation attempt',
                    timestamp: new Date(),

                });
                riskLevel = this.RISK_LEVELS.CRITICAL;
            }

        } catch (error) {
            this.logger.warn('Semantic analysis failed, defaulting to safe', error);
        }

        return { anomalies, riskLevel };
    }

    /**
     * Detect semantic contradictions in the prompt
     */
    private detectSemanticContradictions(content: string): string[] {
        const contradictions: string[] = [];

        // Check for conflicting instructions
        const hasIgnore = /ignore|disregard|forget/i.test(content);
        const hasFollow = /follow|obey|adhere/i.test(content);

        if (hasIgnore && hasFollow) {
            contradictions.push('Conflicting instructions: ignore vs follow');
        }

        // Check for role conflicts
        const hasRole1 = /you are.*assistant/i.test(content);
        const hasRole2 = /you are.*user/i.test(content);

        if (hasRole1 && hasRole2) {
            contradictions.push('Conflicting roles: assistant vs user');
        }

        // Check for context conflicts
        const hasReal = /this is real|this is actual|this is true/i.test(content);
        const hasFake = /this is fake|this is test|this is simulated/i.test(content);

        if (hasReal && hasFake) {
            contradictions.push('Conflicting context: real vs fake');
        }

        return contradictions;
    }

    /**
     * Detect context switching attempts
     */
    private detectContextSwitching(content: string): string[] {
        const switches: string[] = [];

        // Check for abrupt topic changes
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);

        for (let i = 1; i < sentences.length; i++) {
            const prev = sentences[i - 1]?.toLowerCase() || '';
            const curr = sentences[i]?.toLowerCase() || '';

            // Check for topic switches
            if (this.calculateTopicSimilarity(prev, curr) < 0.3) {
                switches.push(`Topic switch: "${prev.trim()}" -> "${curr.trim()}"`);
            }
        }

        return switches;
    }

    /**
     * Detect instruction manipulation
     */
    private detectInstructionManipulation(content: string): {
        type: string;
        confidence: number;
    } | null {
        // Check for instruction override patterns
        const overridePatterns = [
            /ignore.*instructions/i,
            /disregard.*rules/i,
            /forget.*guidelines/i,
            /new.*instructions/i,
            /override.*system/i
        ];

        for (const pattern of overridePatterns) {
            if (pattern.test(content)) {
                return {
                    type: 'instruction_override',
                    confidence: 0.9
                };
            }
        }

        // Check for role manipulation
        const rolePatterns = [
            /you are now.*different/i,
            /you have become.*other/i,
            /you are no longer.*assistant/i,
            /you are now.*user/i
        ];

        for (const pattern of rolePatterns) {
            if (pattern.test(content)) {
                return {
                    type: 'role_manipulation',
                    confidence: 0.8
                };
            }
        }

        return null;
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Validate prompt length
     */
    private validatePromptLength(content: string): { isValid: boolean; length: number } {
        return {
            isValid: content.length <= this.MAX_PROMPT_LENGTH,
            length: content.length
        };
    }

    /**
     * Calculate topic similarity between two sentences
     */
    private calculateTopicSimilarity(sentence1: string, sentence2: string): number {
        // Simple keyword-based similarity (in production, use more sophisticated NLP)
        const words1 = new Set(sentence1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        const words2 = new Set(sentence2.toLowerCase().split(/\W+/).filter(w => w.length > 3));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }

    /**
     * Sanitize content while preserving functionality
     */
    private sanitizeContent(content: string): string {
        let sanitized = content;

        // Remove control characters
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

        // Normalize whitespace
        sanitized = sanitized.replace(/\s+/g, ' ');

        // Remove excessive special characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9\s.,!?;:()[\]{}"'`~@#$%^&*+=|\\/<>]/g, '');

        // Trim whitespace
        sanitized = sanitized.trim();

        return sanitized;
    }

    /**
     * Check rate limiting
     */
    private async checkRateLimiting(_request: LLMRequest): Promise<{ allowed: boolean; reason?: string }> {
        // Implementation would integrate with Redis or similar rate limiting service
        // For now, return allowed
        return { allowed: true };
    }

    /**
     * Log security event
     */
    private async logSecurityEvent(request: LLMRequest, event: any): Promise<void> {
        // Implementation would log to security monitoring system
        this.logger.info('Security event logged', {
            requestId: request.id,
            event
        });
    }

    /**
     * Update threat intelligence
     */
    private async updateThreatIntelligence(request: LLMRequest, anomalies: SecurityAnomaly[]): Promise<void> {
        // Implementation would update threat intelligence database
        // For now, just log
        if (anomalies.length > 0) {
            this.logger.info('Threat intelligence updated', {
                requestId: request.id,
                anomalyCount: anomalies.length
            });
        }
    }
}

// Export singleton instance
export const promptInjectionProtectionService = new PromptInjectionProtectionService();
