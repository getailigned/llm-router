import { logger } from './loggerService';

export interface UserContext {
    userId: string;
    role: UserRole;
    organization: OrganizationType;
    permissions: string[];
    dataAccessLevel: DataSensitivityLevel;
}

export interface ProjectContext {
    projectId: string;
    projectType: ProjectType;
    industry: string;
    complianceRequirements: string[];
    budget: number;
    timeline: 'urgent' | 'normal' | 'flexible';
}

export interface RequestContext {
    userContext: UserContext;
    projectContext: ProjectContext;
    dataSensitivity: DataSensitivityLevel;
    urgency: 'critical' | 'high' | 'medium' | 'low';
    complianceRequired: boolean;
}

export enum UserRole {
    EXECUTIVE = 'executive',
    MANAGER = 'manager',
    DEVELOPER = 'developer',
    ANALYST = 'analyst',
    RESEARCHER = 'researcher',
    CREATIVE = 'creative',
    COMPLIANCE = 'compliance',
    SECURITY = 'security'
}

export enum OrganizationType {
    FINANCIAL = 'financial',
    HEALTHCARE = 'healthcare',
    TECHNOLOGY = 'technology',
    LEGAL = 'legal',
    GOVERNMENT = 'government',
    EDUCATION = 'education',
    RETAIL = 'retail',
    MANUFACTURING = 'manufacturing'
}

export enum ProjectType {
    RESEARCH = 'research',
    DEVELOPMENT = 'development',
    ANALYSIS = 'analysis',
    CREATIVE = 'creative',
    COMPLIANCE = 'compliance',
    SECURITY = 'security',
    STRATEGIC = 'strategic',
    OPERATIONAL = 'operational'
}

export enum DataSensitivityLevel {
    PUBLIC = 'public',
    INTERNAL = 'internal',
    CONFIDENTIAL = 'confidential',
    RESTRICTED = 'restricted',
    CLASSIFIED = 'classified'
}

export class ContextAwareRoutingService {
    constructor() {
        // Logger is imported as a singleton
    }

    /**
     * Analyze request context and determine routing requirements
     */
    analyzeContext(requestContext: RequestContext): ContextRoutingRequirements {
        const requirements: ContextRoutingRequirements = {
            requiredAccuracy: this.determineRequiredAccuracy(requestContext),
            requiredSecurity: this.determineRequiredSecurity(requestContext),
            requiredCompliance: this.determineRequiredCompliance(requestContext),
            requiredPerformance: this.determineRequiredPerformance(requestContext),
            costConstraints: this.determineCostConstraints(requestContext),
            modelPreferences: this.determineModelPreferences(requestContext),
            routingStrategy: this.determineRoutingStrategy(requestContext)
        };

        logger.info('Context analysis completed', {
            context: 'ContextAwareRoutingService',
            requestId: requestContext.projectContext.projectId,
            requirements
        });

        return requirements;
    }

    private determineRequiredAccuracy(context: RequestContext): 'critical' | 'high' | 'medium' | 'low' {
        // Executive decisions and compliance tasks require critical accuracy
        if (context.userContext.role === UserRole.EXECUTIVE || 
            context.userContext.role === UserRole.COMPLIANCE ||
            context.projectContext.projectType === ProjectType.COMPLIANCE ||
            context.projectContext.projectType === ProjectType.SECURITY) {
            return 'critical';
        }

        // Healthcare and financial organizations require high accuracy
        if (context.userContext.organization === OrganizationType.HEALTHCARE ||
            context.userContext.organization === OrganizationType.FINANCIAL) {
            return 'high';
        }

        // Strategic projects require high accuracy
        if (context.projectContext.projectType === ProjectType.STRATEGIC) {
            return 'high';
        }

        // Research and creative projects can use medium accuracy
        if (context.projectContext.projectType === ProjectType.RESEARCH ||
            context.projectContext.projectType === ProjectType.CREATIVE) {
            return 'medium';
        }

        return 'medium'; // Default
    }

    private determineRequiredSecurity(context: RequestContext): 'critical' | 'high' | 'medium' | 'low' {
        // Government and healthcare require critical security
        if (context.userContext.organization === OrganizationType.GOVERNMENT ||
            context.userContext.organization === OrganizationType.HEALTHCARE) {
            return 'critical';
        }

        // Financial and legal require high security
        if (context.userContext.organization === OrganizationType.FINANCIAL ||
            context.userContext.organization === OrganizationType.LEGAL) {
            return 'high';
        }

        // Security and compliance projects require high security
        if (context.projectContext.projectType === ProjectType.SECURITY ||
            context.projectContext.projectType === ProjectType.COMPLIANCE) {
            return 'high';
        }

        // Restricted or classified data requires high security
        if (context.dataSensitivity === DataSensitivityLevel.RESTRICTED ||
            context.dataSensitivity === DataSensitivityLevel.CLASSIFIED) {
            return 'high';
        }

        return 'medium'; // Default
    }

    private determineRequiredCompliance(context: RequestContext): boolean {
        return context.userContext.organization === OrganizationType.HEALTHCARE ||
               context.userContext.organization === OrganizationType.FINANCIAL ||
               context.userContext.organization === OrganizationType.GOVERNMENT ||
               context.userContext.organization === OrganizationType.LEGAL ||
               context.projectContext.projectType === ProjectType.COMPLIANCE ||
               context.projectContext.projectType === ProjectType.SECURITY ||
               context.dataSensitivity === DataSensitivityLevel.RESTRICTED ||
               context.dataSensitivity === DataSensitivityLevel.CLASSIFIED;
    }

    private determineRequiredPerformance(context: RequestContext): 'critical' | 'high' | 'medium' | 'low' {
        // Urgent projects require high performance
        if (context.projectContext.timeline === 'urgent') {
            return 'high';
        }

        // Executive and strategic projects require high performance
        if (context.userContext.role === UserRole.EXECUTIVE ||
            context.projectContext.projectType === ProjectType.STRATEGIC) {
            return 'high';
        }

        // Development and analysis projects benefit from medium performance
        if (context.projectContext.projectType === ProjectType.DEVELOPMENT ||
            context.projectContext.projectType === ProjectType.ANALYSIS) {
            return 'medium';
        }

        return 'medium'; // Default
    }

    private determineCostConstraints(context: RequestContext): CostConstraints {
        const constraints: CostConstraints = {
            maxCostPerRequest: 0.01, // Default $0.01
            maxCostPerProject: context.projectContext.budget * 0.1, // 10% of project budget
            costOptimizationLevel: 'balanced'
        };

        // Executive and strategic projects can have higher costs
        if (context.userContext.role === UserRole.EXECUTIVE ||
            context.projectContext.projectType === ProjectType.STRATEGIC) {
            constraints.maxCostPerRequest = 0.05; // $0.05
            constraints.costOptimizationLevel = 'quality-first';
        }

        // Research and creative projects can be cost-optimized
        if (context.projectContext.projectType === ProjectType.RESEARCH ||
            context.projectContext.projectType === ProjectType.CREATIVE) {
            constraints.costOptimizationLevel = 'cost-first';
        }

        // Compliance and security projects prioritize quality over cost
        if (context.projectContext.projectType === ProjectType.COMPLIANCE ||
            context.projectContext.projectType === ProjectType.SECURITY) {
            constraints.costOptimizationLevel = 'quality-first';
        }

        return constraints;
    }

    private determineModelPreferences(context: RequestContext): string[] {
        const preferences: string[] = [];

        // Compliance and security prefer Claude models
        if (this.determineRequiredCompliance(context)) {
            preferences.push('claude-4-sonnet', 'claude-3-5-sonnet');
        }

        // Creative projects prefer Gemini models
        if (context.projectContext.projectType === ProjectType.CREATIVE) {
            preferences.push('gemini-2-5', 'gemini-pro');
        }

        // Cost-sensitive projects prefer Gemini models
        if (context.projectContext.budget < 1000) {
            preferences.push('gemini-flash', 'gemini-lite');
        }

        // High-performance requirements prefer Claude models
        if (this.determineRequiredPerformance(context) === 'critical') {
            preferences.push('claude-4-sonnet');
        }

        return preferences;
    }

    private determineRoutingStrategy(context: RequestContext): RoutingStrategy {
        // Multi-model orchestration for complex projects
        if (context.projectContext.projectType === ProjectType.STRATEGIC ||
            context.userContext.role === UserRole.EXECUTIVE) {
            return 'orchestrated';
        }

        // Fallback strategy for critical projects
        if (this.determineRequiredAccuracy(context) === 'critical' ||
            this.determineRequiredSecurity(context) === 'critical') {
            return 'fallback';
        }

        // Direct routing for simple projects
        return 'direct';
    }
}

export interface ContextRoutingRequirements {
    requiredAccuracy: 'critical' | 'high' | 'medium' | 'low';
    requiredSecurity: 'critical' | 'high' | 'medium' | 'low';
    requiredCompliance: boolean;
    requiredPerformance: 'critical' | 'high' | 'medium' | 'low';
    costConstraints: CostConstraints;
    modelPreferences: string[];
    routingStrategy: RoutingStrategy;
}

export interface CostConstraints {
    maxCostPerRequest: number;
    maxCostPerProject: number;
    costOptimizationLevel: 'cost-first' | 'balanced' | 'quality-first';
}

export type RoutingStrategy = 'direct' | 'fallback' | 'orchestrated';
