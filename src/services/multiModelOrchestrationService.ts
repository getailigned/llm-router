import { logger } from './loggerService';
import { ContextRoutingRequirements } from './contextAwareRoutingService';

export interface OrchestrationStep {
    stepId: string;
    modelId: string;
    task: string;
    input: any;
    expectedOutput: string;
    dependencies: string[];
    fallbackModel?: string;
}

export interface OrchestrationPlan {
    planId: string;
    steps: OrchestrationStep[];
    estimatedTotalCost: number;
    estimatedTotalTime: number;
    fallbackStrategy: FallbackStrategy;
}

export interface OrchestrationResult {
    planId: string;
    results: Map<string, any>;
    totalCost: number;
    totalTime: number;
    success: boolean;
    errors: string[];
    fallbacksUsed: string[];
}

export interface FallbackStrategy {
    primaryModel: string;
    fallbackModels: string[];
    fallbackTriggers: FallbackTrigger[];
    maxRetries: number;
}

export interface FallbackTrigger {
    condition: 'error' | 'timeout' | 'quality_threshold' | 'cost_exceeded';
    threshold: number;
    action: 'retry' | 'fallback' | 'abort';
}

export class MultiModelOrchestrationService {
    constructor() {
        // Logger is imported as a singleton
    }

    /**
     * Create an orchestration plan for complex tasks
     */
    createOrchestrationPlan(
        task: string,
        context: ContextRoutingRequirements,
        attachments: any[]
    ): OrchestrationPlan {
        const plan: OrchestrationPlan = {
            planId: this.generatePlanId(),
            steps: this.generateOrchestrationSteps(task, context, attachments),
            estimatedTotalCost: 0,
            estimatedTotalTime: 0,
            fallbackStrategy: this.createFallbackStrategy(context)
        };

        // Calculate estimates
        plan.estimatedTotalCost = this.estimateTotalCost(plan.steps);
        plan.estimatedTotalTime = this.estimateTotalTime(plan.steps);

        logger.info('Orchestration plan created', {
            context: 'MultiModelOrchestrationService',
            planId: plan.planId,
            steps: plan.steps.length,
            estimatedCost: plan.estimatedTotalCost,
            estimatedTime: plan.estimatedTotalTime
        });

        return plan;
    }

    /**
     * Execute the orchestration plan
     */
    async executeOrchestration(plan: OrchestrationPlan): Promise<OrchestrationResult> {
        const results = new Map<string, any>();
        const errors: string[] = [];
        const fallbacksUsed: string[] = [];
        let totalCost = 0;
        let totalTime = 0;
        let success = true;

        logger.info('Starting orchestration execution', {
            context: 'MultiModelOrchestrationService',
            planId: plan.planId,
            steps: plan.steps.length
        });

        // Execute steps in dependency order
        const sortedSteps = this.sortStepsByDependencies(plan.steps);
        for (const step of sortedSteps) {
            try {
                const stepResult = await this.executeStep(step, plan.fallbackStrategy);

                if (stepResult.success) {
                    results.set(step.stepId, stepResult.output);
                    totalCost += stepResult.cost;
                    totalTime += stepResult.time;

                    if (stepResult.fallbackUsed) {
                        fallbacksUsed.push(`${step.stepId}:${stepResult.fallbackModel}`);
                    }
                } else {
                    errors.push(`Step ${step.stepId} failed: ${stepResult.error}`);
                    success = false;

                    // Check if we should continue or abort
                    if (this.shouldAbortOrchestration(plan.fallbackStrategy, errors.length)) {
                        logger.error('Orchestration aborted due to too many failures', {
                            context: 'MultiModelOrchestrationService',
                            planId: plan.planId,
                            errors: errors.length
                        });
                        break;
                    }
                }
            } catch (error) {
                const errorMsg = `Step ${step.stepId} execution error: ${error}`;
                errors.push(errorMsg);
                success = false;
                logger.error(errorMsg, {
                    context: 'MultiModelOrchestrationService',
                    planId: plan.planId,
                    stepId: step.stepId
                });
            }
        }

        const result: OrchestrationResult = {
            planId: plan.planId,
            results,
            totalCost,
            totalTime,
            success,
            errors,
            fallbacksUsed
        };

        logger.info('Orchestration execution completed', {
            context: 'MultiModelOrchestrationService',
            planId: plan.planId,
            success,
            totalCost,
            totalTime,
            errors: errors.length,
            fallbacksUsed: fallbacksUsed.length
        });

        return result;
    }

    private generateOrchestrationSteps(
        task: string,
        context: ContextRoutingRequirements,
        attachments: any[]
    ): OrchestrationStep[] {
        const steps: OrchestrationStep[] = [];

        // Example: Complex document analysis with multiple models
        if (task.includes('comprehensive analysis') || context.requiredAccuracy === 'critical') {
            // Step 1: Initial analysis with Claude for accuracy
            steps.push({
                stepId: 'step_1_analysis',
                modelId: 'claude-4-sonnet',
                task: 'Perform comprehensive initial analysis',
                input: { task, attachments },
                expectedOutput: 'Detailed analysis with key insights',
                dependencies: []
            });

            // Step 2: Creative enhancement with Gemini for visual/creative aspects
            if (attachments.some(att => att.contentType?.startsWith('image/'))) {
                steps.push({
                    stepId: 'step_2_creative',
                    modelId: 'gemini-2-5',
                    task: 'Enhance with creative insights and visual analysis',
                    input: { previousAnalysis: '{{step_1_analysis.output}}', attachments },
                    expectedOutput: 'Creative enhancements and visual insights',
                    dependencies: ['step_1_analysis']
                });
            }

            // Step 3: Cost-effective summary with Gemini Flash
            steps.push({
                stepId: 'step_3_summary',
                modelId: 'gemini-flash',
                task: 'Create executive summary and recommendations',
                input: {
                    analysis: '{{step_1_analysis.output}}',
                    creativeEnhancements: '{{step_2_creative.output}}'
                },
                expectedOutput: 'Executive summary with actionable recommendations',
                dependencies: ['step_1_analysis', 'step_2_creative'],
                fallbackModel: 'gemini-lite'
            });
        }

        // Example: Research and development workflow
        else if (task.includes('research') || task.includes('development')) {
            // Step 1: Research with Claude for depth
            steps.push({
                stepId: 'step_1_research',
                modelId: 'claude-3-5-sonnet',
                task: 'Conduct thorough research and analysis',
                input: { task, attachments },
                expectedOutput: 'Comprehensive research findings',
                dependencies: []
            });

            // Step 2: Implementation suggestions with Gemini Pro
            steps.push({
                stepId: 'step_2_implementation',
                modelId: 'gemini-pro',
                task: 'Generate implementation suggestions and code examples',
                input: { research: '{{step_1_research.output}}' },
                expectedOutput: 'Implementation plan with code examples',
                dependencies: ['step_1_research']
            });
        }

        // Example: Creative project with quality assurance
        else if (task.includes('creative') || task.includes('marketing')) {
            // Step 1: Creative generation with Gemini 2.5
            steps.push({
                stepId: 'step_1_creative',
                modelId: 'gemini-2-5',
                task: 'Generate creative content and concepts',
                input: { task, attachments },
                expectedOutput: 'Creative concepts and content',
                dependencies: []
            });

            // Step 2: Quality review with Claude for accuracy
            steps.push({
                stepId: 'step_2_quality',
                modelId: 'claude-4-sonnet',
                task: 'Review and enhance creative content for quality',
                input: { creativeContent: '{{step_1_creative.output}}' },
                expectedOutput: 'Enhanced and quality-reviewed content',
                dependencies: ['step_1_creative']
            });
        }

        // Financial analysis and reporting workflow
        else if (task.includes('financial') || task.includes('budget') || task.includes('cost') || task.includes('investment')) {
            // Step 1: Financial analysis with Claude for accuracy
            steps.push({
                stepId: 'step_1_financial_analysis',
                modelId: 'claude-4-sonnet',
                task: 'Analyze financial data and identify key metrics',
                input: { task, attachments },
                expectedOutput: 'Comprehensive financial analysis with key insights',
                dependencies: []
            });

            // Step 2: Risk assessment with Claude 3.5 Sonnet
            steps.push({
                stepId: 'step_2_risk_assessment',
                modelId: 'claude-3-5-sonnet',
                task: 'Assess financial risks and provide mitigation strategies',
                input: { financialAnalysis: '{{step_1_financial_analysis.output}}' },
                expectedOutput: 'Risk assessment with mitigation strategies',
                dependencies: ['step_1_financial_analysis']
            });

            // Step 3: Executive summary with Gemini Flash
            steps.push({
                stepId: 'step_3_executive_summary',
                modelId: 'gemini-flash',
                task: 'Create executive summary and recommendations',
                input: {
                    analysis: '{{step_1_financial_analysis.output}}',
                    riskAssessment: '{{step_2_risk_assessment.output}}'
                },
                expectedOutput: 'Executive summary with actionable financial recommendations',
                dependencies: ['step_1_financial_analysis', 'step_2_risk_assessment']
            });
        }

        // Business strategy and planning workflow
        else if (task.includes('strategy') || task.includes('planning') || task.includes('business plan')) {
            // Step 1: Strategic analysis with Claude 4.1 Opus
            steps.push({
                stepId: 'step_1_strategic_analysis',
                modelId: 'claude-4-1-opus',
                task: 'Conduct strategic analysis and market research',
                input: { task, attachments },
                expectedOutput: 'Strategic analysis with market insights',
                dependencies: []
            });

            // Step 2: Implementation planning with Gemini Pro
            steps.push({
                stepId: 'step_2_implementation_plan',
                modelId: 'gemini-pro',
                task: 'Create detailed implementation plan and timeline',
                input: { strategicAnalysis: '{{step_1_strategic_analysis.output}}' },
                expectedOutput: 'Detailed implementation plan with timeline',
                dependencies: ['step_1_strategic_analysis']
            });

            // Step 3: Risk and resource planning with Claude 4 Sonnet
            steps.push({
                stepId: 'step_3_risk_resource_planning',
                modelId: 'claude-4-sonnet',
                task: 'Assess risks and resource requirements',
                input: {
                    strategy: '{{step_1_strategic_analysis.output}}',
                    implementation: '{{step_2_implementation_plan.output}}'
                },
                expectedOutput: 'Risk assessment and resource planning',
                dependencies: ['step_1_strategic_analysis', 'step_2_implementation_plan']
            });
        }

        // Technical architecture and system design workflow
        else if (task.includes('architecture') || task.includes('system design') || task.includes('technical review')) {
            // Step 1: Technical analysis with Claude 4.1 Opus
            steps.push({
                stepId: 'step_1_technical_analysis',
                modelId: 'claude-4-1-opus',
                task: 'Analyze technical requirements and constraints',
                input: { task, attachments },
                expectedOutput: 'Technical analysis with requirements and constraints',
                dependencies: []
            });

            // Step 2: Architecture design with Gemini 2.5
            steps.push({
                stepId: 'step_2_architecture_design',
                modelId: 'gemini-2-5',
                task: 'Design system architecture and components',
                input: { technicalAnalysis: '{{step_1_technical_analysis.output}}' },
                expectedOutput: 'System architecture design with components',
                dependencies: ['step_1_technical_analysis']
            });

            // Step 3: Implementation guidance with Claude 4 Sonnet
            steps.push({
                stepId: 'step_3_implementation_guidance',
                modelId: 'claude-4-sonnet',
                task: 'Provide implementation guidance and best practices',
                input: {
                    analysis: '{{step_1_technical_analysis.output}}',
                    design: '{{step_2_architecture_design.output}}'
                },
                expectedOutput: 'Implementation guidance with best practices',
                dependencies: ['step_1_technical_analysis', 'step_2_architecture_design']
            });
        }

        return steps;
    }

    private createFallbackStrategy(context: ContextRoutingRequirements): FallbackStrategy {
        const strategy: FallbackStrategy = {
            primaryModel: 'claude-4-sonnet',
            fallbackModels: ['claude-3-5-sonnet', 'gemini-2-5', 'gemini-pro'],
            fallbackTriggers: [
                { condition: 'error', threshold: 1, action: 'fallback' },
                { condition: 'timeout', threshold: 30000, action: 'fallback' },
                { condition: 'quality_threshold', threshold: 0.7, action: 'retry' },
                { condition: 'cost_exceeded', threshold: 0.05, action: 'fallback' }
            ],
            maxRetries: 2
        };

        // Adjust strategy based on context
        if (context.requiredAccuracy === 'critical') {
            strategy.fallbackModels = ['claude-3-5-sonnet', 'claude-4-sonnet'];
            strategy.maxRetries = 3;
        } else if (context.costConstraints.costOptimizationLevel === 'cost-first') {
            strategy.fallbackModels = ['gemini-pro', 'gemini-flash', 'gemini-lite'];
            strategy.maxRetries = 1;
        }

        return strategy;
    }

    private async executeStep(step: OrchestrationStep, _fallbackStrategy: FallbackStrategy): Promise<any> {
        // This would integrate with actual LLM execution
        // For now, return mock results
        return {
            success: true,
            output: `Mock output for ${step.task}`,
            cost: 0.001,
            time: 1000,
            fallbackUsed: false,
            fallbackModel: null
        };
    }

    private sortStepsByDependencies(steps: OrchestrationStep[]): OrchestrationStep[] {
        // Simple topological sort for dependencies
        const sorted: OrchestrationStep[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (stepId: string) => {
            if (visiting.has(stepId)) {
                throw new Error(`Circular dependency detected: ${stepId}`);
            }
            if (visited.has(stepId)) return;

            visiting.add(stepId);
            const step = steps.find(s => s.stepId === stepId);
            if (step) {
                for (const dep of step.dependencies) {
                    visit(dep);
                }
                visiting.delete(stepId);
                visited.add(stepId);
                sorted.push(step);
            }
        };

        for (const step of steps) {
            if (!visited.has(step.stepId)) {
                visit(step.stepId);
            }
        }

        return sorted;
    }

    private shouldAbortOrchestration(strategy: FallbackStrategy, errorCount: number): boolean {
        return errorCount > strategy.maxRetries;
    }

    private estimateTotalCost(steps: OrchestrationStep[]): number {
        // Mock cost estimation
        return steps.length * 0.002;
    }

    private estimateTotalTime(steps: OrchestrationStep[]): number {
        // Mock time estimation (milliseconds)
        return steps.length * 2000;
    }

    private generatePlanId(): string {
        return `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
