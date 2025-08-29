// =============================================================================
// LLM Router Service - Circuit Breaker Service
// =============================================================================

import { createLogger } from './loggerService';

// =============================================================================
// CIRCUIT BREAKER SERVICE
// =============================================================================

export interface CircuitBreakerState {
    status: 'closed' | 'open' | 'half-open';
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    lastSuccessTime: number;
    nextAttemptTime: number;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
}

export interface CircuitBreakerConfig {
    failureThreshold: number;        // Number of failures before opening
    successThreshold: number;        // Number of successes before closing
    timeout: number;                 // Time to wait before attempting half-open
    windowSize: number;              // Time window for failure counting
    minRequestCount: number;         // Minimum requests before considering failure rate
}

export class CircuitBreakerService {
    private logger = createLogger('CircuitBreakerService');
    private circuitStates: Map<string, CircuitBreakerState> = new Map();
    private config: CircuitBreakerConfig;

    constructor(config?: Partial<CircuitBreakerConfig>) {
        this.config = {
            failureThreshold: 5,         // Default: 5 failures
            successThreshold: 3,         // Default: 3 successes
            timeout: 30000,              // Default: 30 seconds
            windowSize: 60000,           // Default: 1 minute
            minRequestCount: 10,         // Default: 10 requests
            ...config
        };

        this.logger.info('Circuit breaker service initialized', { config: this.config });
    }

    // =============================================================================
    // MAIN CIRCUIT BREAKER METHODS
    // =============================================================================

    /**
     * Execute operation with circuit breaker protection
     */
    async executeWithCircuitBreaker<T>(
        key: string,
        operation: () => Promise<T>,
        fallback?: () => Promise<T>
    ): Promise<T> {
        try {
            // Check circuit state
            const state = this.getCircuitState(key);

            if (state.status === 'open') {
                if (this.shouldAttemptReset(key)) {
                    this.transitionToHalfOpen(key);
                } else {
                    this.logger.warn('Circuit breaker open, using fallback', { key, state });
                    if (fallback) {
                        return await fallback();
                    }
                    throw new Error(`Circuit breaker open for ${key}`);
                }
            }

            // Execute operation
            const result = await operation();

            // Record success
            this.recordSuccess(key);

            return result;

        } catch (error) {
            // Record failure
            this.recordFailure(key, error);

            // Try fallback if available
            if (fallback) {
                this.logger.info('Operation failed, trying fallback', { key, error: error instanceof Error ? error.message : 'Unknown error' });
                try {
                    return await fallback();
                } catch (fallbackError) {
                    this.logger.error('Fallback also failed', { key, fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error' });
                    throw fallbackError;
                }
            }

            throw error;
        }
    }

    /**
     * Check if circuit is open for a given key
     */
    isOpen(key: string): boolean {
        const state = this.getCircuitState(key);
        return state.status === 'open';
    }

    /**
     * Check if circuit is closed (healthy) for a given key
     */
    isClosed(key: string): boolean {
        const state = this.getCircuitState(key);
        return state.status === 'closed';
    }

    /**
     * Check if circuit is half-open (testing) for a given key
     */
    isHalfOpen(key: string): boolean {
        const state = this.getCircuitState(key);
        return state.status === 'half-open';
    }

    /**
     * Get current circuit state
     */
    getCircuitState(key: string): CircuitBreakerState {
        if (!this.circuitStates.has(key)) {
            this.circuitStates.set(key, this.createInitialState());
        }
        return this.circuitStates.get(key)!;
    }

    /**
     * Get circuit breaker statistics
     */
    getStatistics(key: string): {
        status: string;
        failureRate: number;
        successRate: number;
        totalRequests: number;
        uptime: number;
    } {
        const state = this.getCircuitState(key);
        const totalRequests = state.totalRequests;

        return {
            status: state.status,
            failureRate: totalRequests > 0 ? state.totalFailures / totalRequests : 0,
            successRate: totalRequests > 0 ? state.totalSuccesses / totalRequests : 0,
            totalRequests,
            uptime: Date.now() - state.lastSuccessTime
        };
    }

    /**
     * Manually reset circuit breaker
     */
    reset(key: string): void {
        this.logger.info('Manually resetting circuit breaker', { key });
        this.circuitStates.set(key, this.createInitialState());
    }

    /**
     * Force open circuit breaker
     */
    forceOpen(key: string): void {
        this.logger.info('Forcing circuit breaker open', { key });
        const state = this.getCircuitState(key);
        state.status = 'open';
        state.nextAttemptTime = Date.now() + this.config.timeout;
    }

    /**
     * Force close circuit breaker
     */
    forceClose(key: string): void {
        this.logger.info('Forcing circuit breaker closed', { key });
        const state = this.getCircuitState(key);
        state.status = 'closed';
        state.failureCount = 0;
        state.successCount = 0;
    }

    // =============================================================================
    // STATE MANAGEMENT METHODS
    // =============================================================================

    /**
     * Create initial circuit breaker state
     */
    private createInitialState(): CircuitBreakerState {
        const now = Date.now();
        return {
            status: 'closed',
            failureCount: 0,
            successCount: 0,
            lastFailureTime: now,
            lastSuccessTime: now,
            nextAttemptTime: now,
            totalRequests: 0,
            totalFailures: 0,
            totalSuccesses: 0
        };
    }

    /**
     * Record successful operation
     */
    private recordSuccess(key: string): void {
        const state = this.getCircuitState(key);
        const now = Date.now();

        state.successCount++;
        state.lastSuccessTime = now;
        state.totalRequests++;
        state.totalSuccesses++;

        // Reset failure count on success
        state.failureCount = 0;

        // Check if we should transition to closed
        if (state.status === 'half-open' && state.successCount >= this.config.successThreshold) {
            this.transitionToClosed(key);
        }

        this.logger.debug('Operation success recorded', { key, successCount: state.successCount });
    }

    /**
     * Record failed operation
     */
    private recordFailure(key: string, error: any): void {
        const state = this.getCircuitState(key);
        const now = Date.now();

        state.failureCount++;
        state.lastFailureTime = now;
        state.totalRequests++;
        state.totalFailures++;

        // Reset success count on failure
        state.successCount = 0;

        // Check if we should transition to open
        if (state.status === 'closed' && this.shouldOpenCircuit(key)) {
            this.transitionToOpen(key);
        }

        this.logger.warn('Operation failure recorded', {
            key,
            failureCount: state.failureCount,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }

    /**
     * Check if circuit should open
     */
    private shouldOpenCircuit(key: string): boolean {
        const state = this.getCircuitState(key);

        // Only consider opening if we have enough requests
        if (state.totalRequests < this.config.minRequestCount) {
            return false;
        }

        // Check failure threshold
        if (state.failureCount >= this.config.failureThreshold) {
            return true;
        }

        // Check failure rate in time window
        const windowStart = Date.now() - this.config.windowSize;
        const recentFailures = this.getRecentFailures(key, windowStart);
        const recentRequests = this.getRecentRequests(key, windowStart);

        if (recentRequests >= this.config.minRequestCount) {
            const failureRate = recentFailures / recentRequests;
            return failureRate > 0.5; // Open if failure rate > 50%
        }

        return false;
    }

    /**
     * Check if circuit should attempt reset
     */
    private shouldAttemptReset(key: string): boolean {
        const state = this.getCircuitState(key);
        return Date.now() >= state.nextAttemptTime;
    }

    // =============================================================================
    // STATE TRANSITION METHODS
    // =============================================================================

    /**
     * Transition circuit to open state
     */
    private transitionToOpen(key: string): void {
        const state = this.getCircuitState(key);
        const oldStatus = state.status;

        state.status = 'open';
        state.nextAttemptTime = Date.now() + this.config.timeout;

        this.logger.warn('Circuit breaker opened', {
            key,
            oldStatus,
            newStatus: state.status,
            failureCount: state.failureCount,
            nextAttemptTime: new Date(state.nextAttemptTime)
        });
    }

    /**
     * Transition circuit to half-open state
     */
    private transitionToHalfOpen(key: string): void {
        const state = this.getCircuitState(key);
        const oldStatus = state.status;

        state.status = 'half-open';
        state.successCount = 0;
        state.failureCount = 0;

        this.logger.info('Circuit breaker transitioning to half-open', {
            key,
            oldStatus,
            newStatus: state.status
        });
    }

    /**
     * Transition circuit to closed state
     */
    private transitionToClosed(key: string): void {
        const state = this.getCircuitState(key);
        const oldStatus = state.status;

        state.status = 'closed';
        state.successCount = 0;
        state.failureCount = 0;

        this.logger.info('Circuit breaker closed', {
            key,
            oldStatus,
            newStatus: state.status
        });
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Get recent failures within time window
     */
    private getRecentFailures(key: string, since: number): number {
        // This is a simplified implementation
        // In a real system, you'd track individual request timestamps
        const state = this.getCircuitState(key);
        if (state.lastFailureTime >= since) {
            return state.failureCount;
        }
        return 0;
    }

    /**
     * Get recent requests within time window
     */
    private getRecentRequests(key: string, since: number): number {
        // This is a simplified implementation
        // In a real system, you'd track individual request timestamps
        const state = this.getCircuitState(key);
        if (state.lastSuccessTime >= since || state.lastFailureTime >= since) {
            return state.totalRequests;
        }
        return 0;
    }

    /**
     * Get all circuit breaker keys
     */
    getAllKeys(): string[] {
        return Array.from(this.circuitStates.keys());
    }

    /**
     * Get summary of all circuit breakers
     */
    getAllCircuitStates(): Record<string, CircuitBreakerState> {
        const summary: Record<string, CircuitBreakerState> = {};

        for (const [key, state] of this.circuitStates.entries()) {
            summary[key] = { ...state };
        }

        return summary;
    }

    /**
     * Clean up old circuit breakers
     */
    cleanup(maxAge: number = 24 * 60 * 60 * 1000): void { // Default: 24 hours
        const now = Date.now();
        const keysToRemove: string[] = [];

        for (const [key, state] of this.circuitStates.entries()) {
            const lastActivity = Math.max(state.lastSuccessTime, state.lastFailureTime);
            if (now - lastActivity > maxAge) {
                keysToRemove.push(key);
            }
        }

        for (const key of keysToRemove) {
            this.circuitStates.delete(key);
            this.logger.debug('Cleaned up old circuit breaker', { key });
        }

        if (keysToRemove.length > 0) {
            this.logger.info('Cleaned up old circuit breakers', { count: keysToRemove.length });
        }
    }
}

// Export singleton instance
export const circuitBreakerService = new CircuitBreakerService();
