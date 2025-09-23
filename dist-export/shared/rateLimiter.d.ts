/**
 * Rate Limiter Implementation
 * Protects APIs from abuse and ensures fair usage
 */
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: any) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    onLimitReached?: (key: string, hits: number) => void;
    store?: RateLimitStore;
}
export interface RateLimitInfo {
    totalHits: number;
    remainingPoints: number;
    msBeforeNext: number;
    isBlocked: boolean;
}
export interface RateLimitStore {
    increment(key: string): Promise<{
        totalHits: number;
        resetTime?: Date;
    }>;
    decrement?(key: string): Promise<void>;
    reset(key: string): Promise<void>;
    get(key: string): Promise<{
        totalHits: number;
        resetTime?: Date;
    } | null>;
}
/**
 * In-memory rate limit store
 */
export declare class MemoryRateLimitStore implements RateLimitStore {
    private windowMs;
    private store;
    private cleanupInterval;
    constructor(windowMs: number);
    increment(key: string): Promise<{
        totalHits: number;
        resetTime: Date;
    }>;
    decrement(key: string): Promise<void>;
    reset(key: string): Promise<void>;
    get(key: string): Promise<{
        totalHits: number;
        resetTime: Date;
    } | null>;
    private cleanup;
    destroy(): void;
}
/**
 * Redis rate limit store (for distributed rate limiting)
 */
export declare class RedisRateLimitStore implements RateLimitStore {
    private redis;
    private windowMs;
    constructor(redis: any, // Redis client instance
    windowMs: number);
    increment(key: string): Promise<{
        totalHits: number;
        resetTime: Date;
    }>;
    decrement(key: string): Promise<void>;
    reset(key: string): Promise<void>;
    get(key: string): Promise<{
        totalHits: number;
        resetTime: Date;
    } | null>;
}
/**
 * Rate limiter implementation
 */
export declare class RateLimiter {
    private config;
    private store;
    constructor(config: RateLimitConfig);
    /**
     * Check if request should be rate limited
     */
    checkLimit(request: any): Promise<RateLimitInfo>;
    /**
     * Consume a point (for successful requests)
     */
    consume(request: any): Promise<RateLimitInfo>;
    /**
     * Reset rate limit for a key
     */
    reset(request: any): Promise<void>;
    /**
     * Get current rate limit status without consuming
     */
    getStatus(request: any): Promise<RateLimitInfo>;
    /**
     * Generate rate limit key
     */
    private generateKey;
    /**
     * Extract IP address from request
     */
    private extractIP;
}
/**
 * Rate limit error
 */
export declare class RateLimitError extends Error {
    totalHits: number;
    retryAfter: number;
    constructor(message: string, totalHits: number, retryAfter: number);
}
/**
 * Express.js middleware factory
 */
export declare function createRateLimitMiddleware(config: RateLimitConfig): (req: any, res: any, next: any) => Promise<any>;
/**
 * Next.js API route wrapper
 */
export declare function withRateLimit(config: RateLimitConfig): (handler: (req: any, res: any) => Promise<any>) => (req: any, res: any) => Promise<any>;
/**
 * Multi-tier rate limiting (e.g., different limits for different user types)
 */
export declare class MultiTierRateLimiter {
    private tiers;
    private tierResolver;
    private limiters;
    constructor(tiers: Record<string, RateLimitConfig>, tierResolver: (request: any) => string);
    checkLimit(request: any): Promise<RateLimitInfo & {
        tier: string;
    }>;
    consume(request: any): Promise<RateLimitInfo & {
        tier: string;
    }>;
}
/**
 * Pre-configured rate limiters for common use cases
 */
export declare const CommonRateLimiters: {
    /**
     * Strict rate limiter for authentication endpoints
     */
    auth: (store?: RateLimitStore) => RateLimiter;
    /**
     * General API rate limiter
     */
    api: (store?: RateLimitStore) => RateLimiter;
    /**
     * Generous rate limiter for public endpoints
     */
    public: (store?: RateLimitStore) => RateLimiter;
    /**
     * Very strict rate limiter for expensive operations
     */
    expensive: (store?: RateLimitStore) => RateLimiter;
};
//# sourceMappingURL=rateLimiter.d.ts.map