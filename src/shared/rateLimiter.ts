/**
 * Rate Limiter Implementation
 * Protects APIs from abuse and ensures fair usage
 */

export interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;        // Maximum requests per window
  keyGenerator?: (req: any) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean;    // Don't count successful requests
  skipFailedRequests?: boolean;        // Don't count failed requests
  onLimitReached?: (key: string, hits: number) => void;
  store?: RateLimitStore;     // Custom storage backend
}

export interface RateLimitInfo {
  totalHits: number;
  remainingPoints: number;
  msBeforeNext: number;
  isBlocked: boolean;
}

export interface RateLimitStore {
  increment(key: string): Promise<{ totalHits: number; resetTime?: Date }>;
  decrement?(key: string): Promise<void>;
  reset(key: string): Promise<void>;
  get(key: string): Promise<{ totalHits: number; resetTime?: Date } | null>;
}

/**
 * In-memory rate limit store
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: Date }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private windowMs: number) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const now = new Date();
    const existing = this.store.get(key);

    if (!existing || existing.resetTime <= now) {
      // Create new entry or reset expired entry
      const resetTime = new Date(now.getTime() + this.windowMs);
      const entry = { count: 1, resetTime };
      this.store.set(key, entry);
      return { totalHits: 1, resetTime };
    }

    // Increment existing entry
    existing.count++;
    return { totalHits: existing.count, resetTime: existing.resetTime };
  }

  async decrement(key: string): Promise<void> {
    const existing = this.store.get(key);
    if (existing && existing.count > 0) {
      existing.count--;
    }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async get(key: string): Promise<{ totalHits: number; resetTime: Date } | null> {
    const existing = this.store.get(key);
    if (!existing) {
      return null;
    }

    if (existing.resetTime <= new Date()) {
      this.store.delete(key);
      return null;
    }

    return { totalHits: existing.count, resetTime: existing.resetTime };
  }

  private cleanup(): void {
    const now = new Date();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

/**
 * Redis rate limit store (for distributed rate limiting)
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private redis: any,  // Redis client instance
    private windowMs: number
  ) {}

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const pipeline = this.redis.pipeline();
    const windowKey = `rate_limit:${key}`;

    pipeline.incr(windowKey);
    pipeline.expire(windowKey, Math.ceil(this.windowMs / 1000));

    const results = await pipeline.exec();
    const totalHits = results[0][1];
    const resetTime = new Date(Date.now() + this.windowMs);

    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const windowKey = `rate_limit:${key}`;
    await this.redis.decr(windowKey);
  }

  async reset(key: string): Promise<void> {
    const windowKey = `rate_limit:${key}`;
    await this.redis.del(windowKey);
  }

  async get(key: string): Promise<{ totalHits: number; resetTime: Date } | null> {
    const windowKey = `rate_limit:${key}`;
    const [totalHits, ttl] = await Promise.all([
      this.redis.get(windowKey),
      this.redis.ttl(windowKey)
    ]);

    if (totalHits === null || ttl <= 0) {
      return null;
    }

    const resetTime = new Date(Date.now() + (ttl * 1000));
    return { totalHits: parseInt(totalHits), resetTime };
  }
}

/**
 * Rate limiter implementation
 */
export class RateLimiter {
  private store: RateLimitStore;

  constructor(private config: RateLimitConfig) {
    this.store = config.store || new MemoryRateLimitStore(config.windowMs);
  }

  /**
   * Check if request should be rate limited
   */
  async checkLimit(request: any): Promise<RateLimitInfo> {
    const key = this.generateKey(request);
    const result = await this.store.increment(key);

    const remainingPoints = Math.max(0, this.config.maxRequests - result.totalHits);
    const isBlocked = result.totalHits > this.config.maxRequests;
    const msBeforeNext = result.resetTime ? result.resetTime.getTime() - Date.now() : 0;

    if (isBlocked && this.config.onLimitReached) {
      this.config.onLimitReached(key, result.totalHits);
    }

    return {
      totalHits: result.totalHits,
      remainingPoints,
      msBeforeNext: Math.max(0, msBeforeNext),
      isBlocked
    };
  }

  /**
   * Consume a point (for successful requests)
   */
  async consume(request: any): Promise<RateLimitInfo> {
    const limitInfo = await this.checkLimit(request);

    if (limitInfo.isBlocked) {
      throw new RateLimitError(
        'Rate limit exceeded',
        limitInfo.totalHits,
        limitInfo.msBeforeNext
      );
    }

    return limitInfo;
  }

  /**
   * Reset rate limit for a key
   */
  async reset(request: any): Promise<void> {
    const key = this.generateKey(request);
    await this.store.reset(key);
  }

  /**
   * Get current rate limit status without consuming
   */
  async getStatus(request: any): Promise<RateLimitInfo> {
    const key = this.generateKey(request);
    const result = await this.store.get(key);

    if (!result) {
      return {
        totalHits: 0,
        remainingPoints: this.config.maxRequests,
        msBeforeNext: 0,
        isBlocked: false
      };
    }

    const remainingPoints = Math.max(0, this.config.maxRequests - result.totalHits);
    const isBlocked = result.totalHits > this.config.maxRequests;
    const msBeforeNext = result.resetTime ? result.resetTime.getTime() - Date.now() : 0;

    return {
      totalHits: result.totalHits,
      remainingPoints,
      msBeforeNext: Math.max(0, msBeforeNext),
      isBlocked
    };
  }

  /**
   * Generate rate limit key
   */
  private generateKey(request: any): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }

    // Default key generation based on IP
    const ip = this.extractIP(request);
    return `ip:${ip}`;
  }

  /**
   * Extract IP address from request
   */
  private extractIP(request: any): string {
    // Try various methods to get the real IP
    const xForwardedFor = request.headers?.['x-forwarded-for'];
    const xRealIP = request.headers?.['x-real-ip'];
    const cfConnectingIP = request.headers?.['cf-connecting-ip']; // Cloudflare
    const remoteAddress = request.socket?.remoteAddress;
    const connectionRemoteAddress = request.connection?.remoteAddress;

    let ip = xForwardedFor || xRealIP || cfConnectingIP || remoteAddress || connectionRemoteAddress;

    // Handle X-Forwarded-For header which can contain multiple IPs
    if (typeof ip === 'string' && ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    // Remove IPv6 prefix if present
    if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    return ip || 'unknown';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public totalHits: number,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Express.js middleware factory
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const rateLimiter = new RateLimiter(config);

  return async (req: any, res: any, next: any) => {
    try {
      const limitInfo = await rateLimiter.checkLimit(req);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': limitInfo.remainingPoints.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + limitInfo.msBeforeNext).toISOString(),
        'X-RateLimit-Window': config.windowMs.toString()
      });

      if (limitInfo.isBlocked) {
        res.set('Retry-After', Math.ceil(limitInfo.msBeforeNext / 1000).toString());

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: limitInfo.msBeforeNext,
          limit: config.maxRequests,
          windowMs: config.windowMs
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Don't block requests if rate limiter fails
      next();
    }
  };
}

/**
 * Next.js API route wrapper
 */
export function withRateLimit(config: RateLimitConfig) {
  const rateLimiter = new RateLimiter(config);

  return function (handler: (req: any, res: any) => Promise<any>) {
    return async (req: any, res: any) => {
      try {
        const limitInfo = await rateLimiter.checkLimit(req);

        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', limitInfo.remainingPoints.toString());
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + limitInfo.msBeforeNext).toISOString());

        if (limitInfo.isBlocked) {
          res.setHeader('Retry-After', Math.ceil(limitInfo.msBeforeNext / 1000).toString());

          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: limitInfo.msBeforeNext
          });
        }

        return handler(req, res);
      } catch (error) {
        console.error('Rate limiter error:', error);
        // Don't block requests if rate limiter fails
        return handler(req, res);
      }
    };
  };
}

/**
 * Multi-tier rate limiting (e.g., different limits for different user types)
 */
export class MultiTierRateLimiter {
  private limiters = new Map<string, RateLimiter>();

  constructor(
    private tiers: Record<string, RateLimitConfig>,
    private tierResolver: (request: any) => string
  ) {
    Object.entries(tiers).forEach(([tier, config]) => {
      this.limiters.set(tier, new RateLimiter(config));
    });
  }

  async checkLimit(request: any): Promise<RateLimitInfo & { tier: string }> {
    const tier = this.tierResolver(request);
    const limiter = this.limiters.get(tier);

    if (!limiter) {
      throw new Error(`Unknown rate limit tier: ${tier}`);
    }

    const limitInfo = await limiter.checkLimit(request);
    return { ...limitInfo, tier };
  }

  async consume(request: any): Promise<RateLimitInfo & { tier: string }> {
    const tier = this.tierResolver(request);
    const limiter = this.limiters.get(tier);

    if (!limiter) {
      throw new Error(`Unknown rate limit tier: ${tier}`);
    }

    const limitInfo = await limiter.consume(request);
    return { ...limitInfo, tier };
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const CommonRateLimiters = {
  /**
   * Strict rate limiter for authentication endpoints
   */
  auth: (store?: RateLimitStore) => new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,            // 5 attempts per 15 minutes
    store,
    onLimitReached: (key, hits) => {
      console.warn(`[RateLimit] Auth endpoint blocked for ${key}: ${hits} attempts`);
    }
  }),

  /**
   * General API rate limiter
   */
  api: (store?: RateLimitStore) => new RateLimiter({
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 100,          // 100 requests per minute
    store,
    onLimitReached: (key, hits) => {
      console.warn(`[RateLimit] API rate limit exceeded for ${key}: ${hits} requests`);
    }
  }),

  /**
   * Generous rate limiter for public endpoints
   */
  public: (store?: RateLimitStore) => new RateLimiter({
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 1000,         // 1000 requests per minute
    store
  }),

  /**
   * Very strict rate limiter for expensive operations
   */
  expensive: (store?: RateLimitStore) => new RateLimiter({
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 10,           // 10 requests per hour
    store,
    onLimitReached: (key, hits) => {
      console.warn(`[RateLimit] Expensive operation blocked for ${key}: ${hits} attempts`);
    }
  })
};