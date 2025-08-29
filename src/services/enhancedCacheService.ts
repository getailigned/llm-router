// =============================================================================
// LLM Router Service - Enhanced Cache Service
// =============================================================================

import { createLogger } from './loggerService';
import { LLMRequest } from '../types';

// =============================================================================
// ENHANCED CACHE SERVICE
// =============================================================================

export interface CacheEntry<T> {
    key: string;
    value: T;
    timestamp: number;
    lastAccessed: number;
    accessCount: number;
    size: number;
    ttl: number;
    tags: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface CacheConfig {
    maxSize: number;           // Maximum cache size in MB
    maxEntries: number;        // Maximum number of entries
    defaultTTL: number;        // Default TTL in milliseconds
    cleanupInterval: number;   // Cleanup interval in milliseconds
    evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'adaptive';
    enableSemanticCache: boolean;
    semanticSimilarityThreshold: number;
}

export interface SemanticCacheResult<T> {
    entry: CacheEntry<T>;
    similarity: number;
    isExact: boolean;
}

export class EnhancedCacheService {
    private logger = createLogger('EnhancedCacheService');
    private cache: Map<string, CacheEntry<any>> = new Map();
    private config: CacheConfig;
    private cleanupTimer: NodeJS.Timeout | null = null;
    private totalSize: number = 0;
    private accessOrder: string[] = [];
    private frequencyMap: Map<string, number> = new Map();
    private hitCount: number = 0;
    private missCount: number = 0;
    private evictionCount: number = 0;
    private avgLatency: number = 0;
    private semanticCacheHits: number = 0;

    constructor(config?: Partial<CacheConfig>) {
        this.config = {
            maxSize: 100,                    // 100 MB
            maxEntries: 1000,               // 1000 entries
            defaultTTL: 300000,             // 5 minutes
            cleanupInterval: 60000,          // 1 minute
            evictionPolicy: 'adaptive',     // Adaptive eviction
            enableSemanticCache: true,      // Enable semantic caching
            semanticSimilarityThreshold: 0.8, // 80% similarity threshold
            ...config
        };

        this.startCleanupTimer();
        this.logger.info('Enhanced cache service initialized', { config: this.config });
    }

    // =============================================================================
    // MAIN CACHE METHODS
    // =============================================================================

    /**
     * Set a value in the cache
     */
    set<T>(
        key: string,
        value: T,
        options?: {
            ttl?: number;
            tags?: string[];
            priority?: 'low' | 'medium' | 'high' | 'critical';
            size?: number;
        }
    ): void {
        try {
            // Check if key already exists
            if (this.cache.has(key)) {
                this.remove(key);
            }

            const entry: CacheEntry<T> = {
                key,
                value,
                timestamp: Date.now(),
                lastAccessed: Date.now(),
                accessCount: 1,
                size: options?.size || this.estimateSize(value),
                ttl: options?.ttl || this.config.defaultTTL,
                tags: options?.tags || [],
                priority: options?.priority || 'medium'
            };

            // Check if we need to evict entries
            this.ensureCapacity(entry.size);

            // Add to cache
            this.cache.set(key, entry);
            this.totalSize += entry.size;
            this.accessOrder.push(key);
            this.frequencyMap.set(key, 1);

            this.logger.debug('Cache entry set', { key, size: entry.size, ttl: entry.ttl });

        } catch (error) {
            this.logger.error('Failed to set cache entry', error, { key });
        }
    }

    /**
     * Get a value from the cache
     */
    get<T>(key: string): T | null {
        try {
            const entry = this.cache.get(key) as CacheEntry<T>;

            if (!entry) {
                return null;
            }

            // Check if entry has expired
            if (this.isExpired(entry)) {
                this.remove(key);
                return null;
            }

            // Update access statistics
            this.updateAccessStats(key);

            return entry.value;

        } catch (error) {
            this.logger.error('Failed to get cache entry', error, { key });
            return null;
        }
    }

    /**
     * Get a value with semantic similarity matching
     */
    getSemantic<T>(request: LLMRequest): SemanticCacheResult<T> | null {
        if (!this.config.enableSemanticCache) {
            return null;
        }

        try {
            let bestMatch: SemanticCacheResult<T> | null = null;
            let highestSimilarity = 0;

            for (const [, entry] of this.cache.entries()) {
                // Skip expired entries
                if (this.isExpired(entry)) {
                    continue;
                }

                // Calculate similarity
                const similarity = this.calculateSimilarity(request, entry);

                if (similarity > highestSimilarity && similarity >= this.config.semanticSimilarityThreshold) {
                    highestSimilarity = similarity;
                    bestMatch = {
                        entry: entry as CacheEntry<T>,
                        similarity,
                        isExact: similarity === 1.0
                    };
                }
            }

            if (bestMatch) {
                // Update access statistics for the matched entry
                this.updateAccessStats(bestMatch.entry.key);
                this.logger.debug('Semantic cache hit', {
                    key: bestMatch.entry.key,
                    similarity: bestMatch.similarity
                });
            }

            return bestMatch;

        } catch (error) {
            this.logger.error('Failed to get semantic cache entry', error);
            return null;
        }
    }

    /**
     * Remove a value from the cache
     */
    remove(key: string): boolean {
        try {
            const entry = this.cache.get(key);
            if (!entry) {
                return false;
            }

            // Remove from cache
            this.cache.delete(key);
            this.totalSize -= entry.size;

            // Remove from access order
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }

            // Remove from frequency map
            this.frequencyMap.delete(key);

            this.logger.debug('Cache entry removed', { key, size: entry.size });
            return true;

        } catch (error) {
            this.logger.error('Failed to remove cache entry', error, { key });
            return false;
        }
    }

    /**
     * Check if a key exists in the cache
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }

        if (this.isExpired(entry)) {
            this.remove(key);
            return false;
        }

        return true;
    }

    /**
     * Clear all entries from the cache
     */
    clear(): void {
        this.cache.clear();
        this.totalSize = 0;
        this.accessOrder = [];
        this.frequencyMap.clear();
        this.logger.info('Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        entryCount: number;
        hitRate: number;
        missRate: number;
        totalHits: number;
        totalMisses: number;
        averageEntrySize: number;
        memoryUsage: number;
    } {
        const totalHits = this.accessOrder.reduce((sum, key) => {
            const entry = this.cache.get(key);
            return sum + (entry ? entry.accessCount - 1 : 0);
        }, 0);

        const totalMisses = 0; // Simplified for now
        const totalRequests = totalHits + totalMisses;

        return {
            size: this.totalSize,
            entryCount: this.cache.size,
            hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
            missRate: totalRequests > 0 ? totalMisses / totalRequests : 0,
            totalHits,
            totalMisses,
            averageEntrySize: this.cache.size > 0 ? this.totalSize / this.cache.size : 0,
            memoryUsage: this.totalSize
        };
    }

    /**
     * Get detailed cache performance metrics
     */
    getPerformanceMetrics(): {
        size: number;
        entries: number;
        hitRate: number;
        avgLatency: number;
        memoryUsage: number;
        evictionRate: number;
        semanticCacheHits: number;
        compressionRatio: number;
    } {
        const totalRequests = this.hitCount + this.missCount;
        const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

        // Calculate memory usage
        const memoryUsage = process.memoryUsage();

        // Calculate eviction rate
        const evictionRate = this.evictionCount / Math.max(this.cache.size, 1);

        // Calculate compression ratio (estimated)
        const compressionRatio = this.calculateCompressionRatio();

        return {
            size: this.totalSize,
            entries: this.cache.size,
            hitRate,
            avgLatency: this.avgLatency,
            memoryUsage: memoryUsage.heapUsed,
            evictionRate,
            semanticCacheHits: this.semanticCacheHits,
            compressionRatio
        };
    }

    /**
     * Calculate compression ratio for cache entries
     */
    private calculateCompressionRatio(): number {
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;

        for (const entry of this.cache.values()) {
            totalOriginalSize += entry.size;
            totalCompressedSize += this.estimateCompressedSize(entry.value);
        }

        return totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1;
    }

    /**
     * Estimate compressed size of a value
     */
    private estimateCompressedSize(value: any): number {
        try {
            const jsonString = JSON.stringify(value);
            // Simple compression estimation (gzip typically achieves 60-80% compression)
            return Math.ceil(jsonString.length * 0.7);
        } catch {
            return this.estimateSize(value);
        }
    }

    /**
     * Optimize cache performance
     */
    async optimizePerformance(): Promise<void> {
        try {
            this.logger.info('Starting cache performance optimization');

            // Analyze cache patterns
            const patterns = this.analyzeCachePatterns();

            // Adjust TTL based on access patterns
            this.adjustTTLBasedOnPatterns(patterns);

            // Optimize eviction policy
            this.optimizeEvictionPolicy(patterns);

            // Compress old entries
            await this.compressOldEntries();

            this.logger.info('Cache performance optimization completed', {
                patternsAnalyzed: patterns.length,
                optimizationsApplied: true
            });
        } catch (error) {
            this.logger.error('Cache performance optimization failed', error);
        }
    }

    /**
     * Analyze cache access patterns for optimization
     */
    private analyzeCachePatterns(): Array<{ key: string; pattern: string; frequency: number }> {
        const patterns: Array<{ key: string; pattern: string; frequency: number }> = [];

        for (const [key, entry] of this.cache.entries()) {
            const accessFrequency = entry.accessCount / Math.max(Date.now() - entry.timestamp, 1);
            const pattern = this.classifyAccessPattern(accessFrequency, entry.priority);

            patterns.push({
                key,
                pattern,
                frequency: accessFrequency
            });
        }

        return patterns.sort((a, b) => b.frequency - a.frequency);
    }

    /**
     * Classify access pattern for optimization
     */
    private classifyAccessPattern(frequency: number, priority: string): string {
        if (frequency > 0.1) return 'hot';
        if (frequency > 0.01) return 'warm';
        if (priority === 'critical') return 'critical';
        return 'cold';
    }

    /**
     * Adjust TTL based on access patterns
     */
    private adjustTTLBasedOnPatterns(patterns: Array<{ key: string; pattern: string; frequency: number }>): void {
        for (const pattern of patterns) {
            const entry = this.cache.get(pattern.key);
            if (entry) {
                switch (pattern.pattern) {
                    case 'hot':
                        entry.ttl = Math.min(entry.ttl * 1.5, this.config.defaultTTL * 3);
                        break;
                    case 'warm':
                        entry.ttl = Math.min(entry.ttl * 1.2, this.config.defaultTTL * 2);
                        break;
                    case 'cold':
                        entry.ttl = Math.max(entry.ttl * 0.8, this.config.defaultTTL * 0.5);
                        break;
                }
            }
        }
    }

    /**
     * Optimize eviction policy based on patterns
     */
    private optimizeEvictionPolicy(patterns: Array<{ key: string; pattern: string; frequency: number }>): void {
        const hotEntries = patterns.filter(p => p.pattern === 'hot').length;
        const coldEntries = patterns.filter(p => p.pattern === 'cold').length;

        if (hotEntries > coldEntries * 2) {
            // Many hot entries, use LFU for better performance
            this.config.evictionPolicy = 'lfu';
        } else if (coldEntries > hotEntries * 2) {
            // Many cold entries, use LRU for better memory management
            this.config.evictionPolicy = 'lru';
        } else {
            // Balanced, use adaptive
            this.config.evictionPolicy = 'adaptive';
        }

        this.logger.info('Eviction policy optimized', {
            newPolicy: this.config.evictionPolicy,
            hotEntries,
            coldEntries
        });
    }

    /**
     * Compress old entries to save memory
     */
    private async compressOldEntries(): Promise<void> {
        const oldEntries = Array.from(this.cache.entries())
            .filter(([_, entry]) => Date.now() - entry.timestamp > this.config.defaultTTL)
            .slice(0, 10); // Process 10 at a time

        for (const [key, entry] of oldEntries) {
            try {
                // Simple compression by removing unnecessary fields
                const compressedValue = this.compressValue(entry.value);
                entry.value = compressedValue;
                entry.size = this.estimateSize(compressedValue);

                this.logger.debug('Compressed old cache entry', { key, originalSize: entry.size });
            } catch (error) {
                this.logger.debug('Failed to compress cache entry', { key, error: error instanceof Error ? error.message : String(error) });
            }
        }
    }

    /**
     * Compress value by removing unnecessary fields
     */
    private compressValue(value: any): any {
        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                return value.map(v => this.compressValue(v));
            } else {
                const compressed: any = {};
                for (const [k, v] of Object.entries(value)) {
                    // Keep essential fields, remove metadata
                    if (!['metadata', 'debug', 'internal'].includes(k)) {
                        compressed[k] = this.compressValue(v);
                    }
                }
                return compressed;
            }
        }
        return value;
    }

    // =============================================================================
    // SEMANTIC CACHING METHODS
    // =============================================================================

    /**
     * Calculate similarity between request and cache entry
     */
    private calculateSimilarity(request: LLMRequest, entry: CacheEntry<any>): number {
        try {
            // If the entry has a cached request, compare directly
            if (entry.value.request && entry.value.request.content) {
                return this.calculateTextSimilarity(
                    request.content,
                    entry.value.request.content
                );
            }

            // Fallback to basic similarity
            return 0.5;

        } catch (error) {
            this.logger.warn('Failed to calculate similarity', error);
            return 0.0;
        }
    }

    /**
     * Calculate text similarity using simple algorithms
     */
    private calculateTextSimilarity(text1: string, text2: string): number {
        try {
            // Normalize texts
            const normalized1 = text1.toLowerCase().trim();
            const normalized2 = text2.toLowerCase().trim();

            // Exact match
            if (normalized1 === normalized2) {
                return 1.0;
            }

            // Calculate Jaccard similarity
            const words1 = new Set(normalized1.split(/\s+/));
            const words2 = new Set(normalized2.split(/\s+/));

            const intersection = new Set([...words1].filter(x => words2.has(x)));
            const union = new Set([...words1, ...words2]);

            const jaccardSimilarity = intersection.size / union.size;

            // Calculate length similarity
            const lengthDiff = Math.abs(normalized1.length - normalized2.length);
            const maxLength = Math.max(normalized1.length, normalized2.length);
            const lengthSimilarity = 1 - (lengthDiff / maxLength);

            // Weighted combination
            return (jaccardSimilarity * 0.7) + (lengthSimilarity * 0.3);

        } catch (error) {
            this.logger.warn('Failed to calculate text similarity', error);
            return 0.0;
        }
    }

    // =============================================================================
    // CAPACITY MANAGEMENT METHODS
    // =============================================================================

    /**
     * Ensure cache has capacity for new entry
     */
    private ensureCapacity(newEntrySize: number): void {
        while (
            (this.totalSize + newEntrySize > this.config.maxSize * 1024 * 1024) ||
            (this.cache.size >= this.config.maxEntries)
        ) {
            this.evictEntry();
        }
    }

    /**
     * Evict an entry based on eviction policy
     */
    private evictEntry(): void {
        if (this.cache.size === 0) return;

        let keyToEvict: string | null = null;

        switch (this.config.evictionPolicy) {
            case 'lru':
                keyToEvict = this.getLRUKey();
                break;
            case 'lfu':
                keyToEvict = this.getLFUKey();
                break;
            case 'fifo':
                keyToEvict = this.getFIFOKey();
                break;
            case 'adaptive':
                keyToEvict = this.getAdaptiveEvictionKey();
                break;
            default:
                keyToEvict = this.getLRUKey();
        }

        if (keyToEvict) {
            this.remove(keyToEvict);
        }
    }

    /**
     * Get least recently used key
     */
    private getLRUKey(): string | null {
        if (this.accessOrder.length === 0) return null;
        return this.accessOrder[0] || null;
    }

    /**
     * Get least frequently used key
     */
    private getLFUKey(): string | null {
        let minFreq = Infinity;
        let keyToEvict: string | null = null;

        for (const [key, freq] of this.frequencyMap.entries()) {
            if (freq < minFreq) {
                minFreq = freq;
                keyToEvict = key;
            }
        }

        return keyToEvict;
    }

    /**
     * Get first in, first out key
     */
    private getFIFOKey(): string | null {
        if (this.accessOrder.length === 0) return null;
        return this.accessOrder[0] || null;
    }

    /**
     * Get key for adaptive eviction (combines LRU, LFU, and priority)
     */
    private getAdaptiveEvictionKey(): string | null {
        if (this.accessOrder.length === 0) return null;

        // Score each entry based on multiple factors
        const scores = new Map<string, number>();

        for (const [key, entry] of this.cache.entries()) {
            let score = 0;

            // Priority score (higher priority = lower score for eviction)
            const priorityScores = { low: 3, medium: 2, high: 1, critical: 0 };
            score += priorityScores[entry.priority];

            // Frequency score (lower frequency = higher score for eviction)
            const freq = this.frequencyMap.get(key) || 1;
            score += (1 / freq) * 2;

            // Age score (older = higher score for eviction)
            const age = Date.now() - entry.timestamp;
            score += (age / (1000 * 60 * 60)) * 0.1; // Hours

            // Size score (larger = higher score for eviction)
            score += (entry.size / (1024 * 1024)) * 0.5; // MB

            scores.set(key, score);
        }

        // Find key with highest score (most likely to be evicted)
        let maxScore = -Infinity;
        let keyToEvict: string | null = null;

        for (const [key, score] of scores.entries()) {
            if (score > maxScore) {
                maxScore = score;
                keyToEvict = key;
            }
        }

        return keyToEvict;
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Check if cache entry has expired
     */
    private isExpired(entry: CacheEntry<any>): boolean {
        return Date.now() > entry.timestamp + entry.ttl;
    }

    /**
     * Update access statistics for a key
     */
    private updateAccessStats(key: string): void {
        const entry = this.cache.get(key);
        if (!entry) return;

        // Update last accessed time
        entry.lastAccessed = Date.now();
        entry.accessCount++;

        // Move to end of access order (most recently used)
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);

        // Update frequency
        const currentFreq = this.frequencyMap.get(key) || 0;
        this.frequencyMap.set(key, currentFreq + 1);
    }

    /**
     * Estimate size of a value in bytes
     */
    private estimateSize(value: any): number {
        try {
            const jsonString = JSON.stringify(value);
            return Buffer.byteLength(jsonString, 'utf8');
        } catch (error) {
            // Fallback estimation
            return 1024; // 1KB default
        }
    }

    /**
     * Start cleanup timer
     */
    private startCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const keysToRemove: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (this.isExpired(entry)) {
                keysToRemove.push(key);
            }
        }

        for (const key of keysToRemove) {
            this.remove(key);
        }

        if (keysToRemove.length > 0) {
            this.logger.debug('Cleanup removed expired entries', { count: keysToRemove.length });
        }
    }

    /**
     * Get cache entries by tag
     */
    getByTag(tag: string): Array<{ key: string; value: any; timestamp: number }> {
        const results: Array<{ key: string; value: any; timestamp: number }> = [];

        for (const [, entry] of this.cache.entries()) {
            if (entry.tags.includes(tag) && !this.isExpired(entry)) {
                results.push({
                    key: entry.key,
                    value: entry.value,
                    timestamp: entry.timestamp
                });
            }
        }

        return results;
    }

    /**
     * Remove cache entries by tag
     */
    removeByTag(tag: string): number {
        const keysToRemove: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (entry.tags.includes(tag)) {
                keysToRemove.push(key);
            }
        }

        for (const key of keysToRemove) {
            this.remove(key);
        }

        this.logger.info('Removed cache entries by tag', { tag, count: keysToRemove.length });
        return keysToRemove.length;
    }

    /**
     * Get cache keys
     */
    keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get cache values
     */
    values(): any[] {
        return Array.from(this.cache.values()).map(entry => entry.value);
    }

    /**
     * Get cache entries
     */
    entries(): Array<[string, any]> {
        return Array.from(this.cache.entries()).map(([key, entry]) => [key, entry.value]);
    }

    /**
     * Destroy the cache service
     */
    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.clear();
        this.logger.info('Cache service destroyed');
    }
}

// Export singleton instance
export const enhancedCacheService = new EnhancedCacheService();
