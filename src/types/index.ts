// =============================================================================
// LLM Router Service - Core Types
// =============================================================================

// Import shared types from @htma/shared-types
import {
  ApiError
} from '@htma/shared-types';

// =============================================================================
// REQUEST & RESPONSE TYPES
// =============================================================================

export interface LLMRequest {
  id: string;
  serviceId: string;
  serviceName: string;
  content: string;
  attachments?: Attachment[];
  useCase?: string;
  complexity?: 'simple' | 'moderate' | 'complex' | 'expert';
  securityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  priority?: number;
  budget?: number;
  timestamp: Date;
  correlationId?: string;
}

export interface LLMResponse {
  id: string;
  requestId: string;
  model: string;
  content: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  latency: number;
  quality: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  metadata?: {
    language?: string;
    complexity?: 'simple' | 'moderate' | 'complex' | 'expert';
    sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
    processingRequirements?: string[];
  };
}

// =============================================================================
// MODEL & ROUTING TYPES
// =============================================================================

export interface Model {
  id: string;
  name: string;
  provider: 'google' | 'anthropic' | 'huggingface' | 'custom';
  capabilities: ModelCapability[];
  performance: ModelPerformance;
  pricing: ModelPricing;
  availability: ModelAvailability;
  security: ModelSecurity;
  enabled: boolean;
  fallback?: string;
}

export interface ModelCapability {
  type: 'text-generation' | 'code-generation' | 'multimodal' | 'rag' | 'semantic-analysis';
  level: 'basic' | 'intermediate' | 'advanced' | 'expert';
  supportedFormats: string[];
  maxInputSize: number;
  maxOutputSize: number;
}

export interface ModelPerformance {
  averageLatency: number;
  throughput: number;
  successRate: number;
  qualityScore: number;
  lastUpdated: Date;
}

export interface ModelPricing {
  inputTokensPer1K: number;
  outputTokensPer1K: number;
  baseCost: number;
  currency: string;
}

export interface ModelAvailability {
  status: 'online' | 'offline' | 'degraded' | 'maintenance';
  region: string;
  uptime: number;
  lastCheck: Date;
}

export interface ModelSecurity {
  dataRetention: string;
  encryption: string;
  compliance: string[];
  auditLogging: boolean;
}

export interface RoutingDecision {
  requestId: string;
  selectedModel: string;
  confidence: number;
  reasoning: string[];
  alternatives: string[];
  estimatedCost: number;
  estimatedLatency: number;
  timestamp: Date;
}

// =============================================================================
// RAG & SEMANTIC ANALYSIS TYPES
// =============================================================================

export interface RAGRequest {
  query: string;
  context?: string;
  documents?: string[];
  maxResults?: number;
  similarityThreshold?: number;
}

export interface RAGResponse {
  query: string;
  results: RAGResult[];
  totalResults: number;
  processingTime: number;
  metadata?: Record<string, any>;
}

export interface RAGResult {
  documentId: string;
  title: string;
  content: string;
  similarity: number;
  source: string;
  metadata?: Record<string, any>;
}

export interface SemanticAnalysisRequest {
  text: string;
  analysisType: 'classification' | 'ner' | 'summarization' | 'sentiment' | 'similarity';
  options?: Record<string, any>;
}

export interface SemanticAnalysisResponse {
  text: string;
  analysisType: string;
  results: any;
  confidence: number;
  processingTime: number;
}

// =============================================================================
// ANALYTICS & MONITORING TYPES
// =============================================================================

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  averageCost: number;
  totalCost: number;
  successRate: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface ModelMetrics {
  modelId: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  averageLatency: number;
  averageCost: number;
  totalCost: number;
  successRate: number;
  qualityScores: number[];
  lastUsed: Date;
}

export interface ServiceMetrics {
  serviceId: string;
  serviceName: string;
  requestCount: number;
  averageLatency: number;
  averageCost: number;
  totalCost: number;
  lastRequest: Date;
}

export interface CostAnalysis {
  totalCost: number;
  costByModel: Record<string, number>;
  costByService: Record<string, number>;
  costByTime: TimeSeriesData[];
  budgetUtilization: number;
  costTrends: 'increasing' | 'decreasing' | 'stable';
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  label?: string;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export interface RoutingConfiguration {
  priorities: ModelPriority[];
  taskRouting: TaskRoutingRules;
  costOptimization: CostOptimizationConfig;
  fallbackStrategies: FallbackStrategy[];
}

export interface ModelPriority {
  priority: number;
  model: string;
  weight: number;
  maxCost: number;
  enabled: boolean;
  useCases: string[];
  fallback: string;
}

export interface TaskRoutingRules {
  [taskType: string]: {
    primary: string[];
    fallback: string[];
    minQuality?: number;
    maxLatency?: number;
    maxCost?: number;
  };
}

export interface CostOptimizationConfig {
  enabled: boolean;
  maxBudget: number;
  dailyLimit: number;
  priorityModels: string[];
  costThresholds: Record<string, number>;
}

export interface FallbackStrategy {
  name: string;
  conditions: string[];
  actions: string[];
  priority: number;
}

// =============================================================================
// AUTHENTICATION & SECURITY TYPES
// =============================================================================

export interface ServicePrincipal {
  id: string;
  name: string;
  clientId: string;
  tenantId: string;
  permissions: string[];
  rateLimits: RateLimitConfig;
  lastUsed: Date;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  serviceId: string;
  permissions: string[];
  issuedAt: Date;
}

// =============================================================================
// ERROR & EXCEPTION TYPES
// =============================================================================

// Use shared ApiError type instead of custom LLMRouterError
export interface LLMRouterError extends ApiError {
  requestId?: string;
  serviceId?: string;
  statusCode: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

export interface RateLimitError extends LLMRouterError {
  retryAfter: number;
  limit: number;
  window: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type Environment = 'development' | 'staging' | 'production';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';
export type ModelProvider = 'google' | 'anthropic' | 'huggingface' | 'custom';
export type ContentType = 'text' | 'code' | 'image' | 'document' | 'mixed';
export type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'expert';
export type SecurityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

// =============================================================================
// ENUM TYPES
// =============================================================================

export enum RequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum ModelStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',
  MAINTENANCE = 'maintenance'
}

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  ROUTING_ERROR = 'ROUTING_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export enum AnalysisType {
  CLASSIFICATION = 'classification',
  NER = 'ner',
  SUMMARIZATION = 'summarization',
  SENTIMENT = 'sentiment',
  SIMILARITY = 'similarity',
  INTENT = 'intent',
  ENTITY = 'entity'
}

// =============================================================================
// RE-EXPORT SHARED TYPES
// =============================================================================

// Re-export commonly used shared types for convenience
export type {
  ApiResponse,
  ApiError,
  HealthCheck,
  HealthCheckResult,
  ServiceInfo,
  BaseEntity,
  AuditLog
} from '@htma/shared-types';
