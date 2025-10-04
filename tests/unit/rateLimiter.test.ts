/**
 * Unit tests for RateLimiter implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  RateLimiter,
  MemoryRateLimitStore,
  RateLimitError,
} from "../../src/shared/rateLimiter";
import type { RateLimitConfig } from "../../src/shared/rateLimiter";

describe("MemoryRateLimitStore", () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore(1000); // 1 second window
  });

  afterEach(() => {
    store.destroy();
  });

  describe("Basic Operations", () => {
    it("should create a MemoryRateLimitStore instance", () => {
      expect(store).toBeInstanceOf(MemoryRateLimitStore);
    });

    it("should increment counter for a key", async () => {
      const result = await store.increment("test-key");

      expect(result.totalHits).toBe(1);
      expect(result.resetTime).toBeInstanceOf(Date);
    });

    it("should increment counter multiple times", async () => {
      await store.increment("test-key");
      await store.increment("test-key");
      const result = await store.increment("test-key");

      expect(result.totalHits).toBe(3);
    });

    it("should decrement counter", async () => {
      await store.increment("test-key");
      await store.increment("test-key");
      await store.decrement("test-key");

      const result = await store.get("test-key");
      expect(result?.totalHits).toBe(1);
    });

    it("should reset counter for a key", async () => {
      await store.increment("test-key");
      await store.increment("test-key");
      await store.reset("test-key");

      const result = await store.get("test-key");
      expect(result).toBeNull();
    });

    it("should return null for non-existent key", async () => {
      const result = await store.get("non-existent");
      expect(result).toBeNull();
    });

    it("should handle multiple keys independently", async () => {
      await store.increment("key-1");
      await store.increment("key-1");
      await store.increment("key-2");

      const result1 = await store.get("key-1");
      const result2 = await store.get("key-2");

      expect(result1?.totalHits).toBe(2);
      expect(result2?.totalHits).toBe(1);
    });
  });

  describe("Time Window Expiration", () => {
    it("should reset counter after window expires", async () => {
      const shortStore = new MemoryRateLimitStore(50); // 50ms window

      await shortStore.increment("test-key");
      await shortStore.increment("test-key");

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await shortStore.get("test-key");
      expect(result).toBeNull();

      shortStore.destroy();
    });

    it("should create new window after expiration", async () => {
      const shortStore = new MemoryRateLimitStore(50);

      await shortStore.increment("test-key");
      await shortStore.increment("test-key");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await shortStore.increment("test-key");
      expect(result.totalHits).toBe(1); // New window

      shortStore.destroy();
    });
  });
});

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;
  let mockRequest: any;

  beforeEach(() => {
    const config: RateLimitConfig = {
      windowMs: 1000,
      maxRequests: 5,
    };
    rateLimiter = new RateLimiter(config);
    mockRequest = { ip: "127.0.0.1", userId: "test-user" };
  });

  describe("Basic Rate Limiting", () => {
    it("should create a RateLimiter instance", () => {
      expect(rateLimiter).toBeInstanceOf(RateLimiter);
    });

    it("should allow requests within limit", async () => {
      const result = await rateLimiter.checkLimit(mockRequest);

      expect(result.isBlocked).toBe(false);
      expect(result.totalHits).toBe(1);
      expect(result.remainingPoints).toBe(4);
    });

    it("should block requests exceeding limit", async () => {
      // Consume all available requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(mockRequest);
      }

      // Next request should be blocked
      const result = await rateLimiter.checkLimit(mockRequest);
      expect(result.isBlocked).toBe(true);
      expect(result.remainingPoints).toBe(0);
    });

    it("should track remaining points correctly", async () => {
      const r1 = await rateLimiter.checkLimit(mockRequest);
      expect(r1.remainingPoints).toBe(4);

      const r2 = await rateLimiter.checkLimit(mockRequest);
      expect(r2.remainingPoints).toBe(3);

      const r3 = await rateLimiter.checkLimit(mockRequest);
      expect(r3.remainingPoints).toBe(2);
    });

    it("should return time before next request", async () => {
      const result = await rateLimiter.checkLimit(mockRequest);

      expect(result.msBeforeNext).toBeGreaterThan(0);
      expect(result.msBeforeNext).toBeLessThanOrEqual(1000);
    });
  });

  describe("Consume Method", () => {
    it("should allow consuming within limit", async () => {
      const result = await rateLimiter.consume(mockRequest);

      expect(result.isBlocked).toBe(false);
      expect(result.totalHits).toBe(1);
    });

    it("should throw RateLimitError when limit exceeded", async () => {
      // Consume all available requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume(mockRequest);
      }

      // Next consume should throw
      await expect(rateLimiter.consume(mockRequest)).rejects.toThrow(
        RateLimitError,
      );
    });

    it("should include retry time in error", async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume(mockRequest);
      }

      try {
        await rateLimiter.consume(mockRequest);
        expect.fail("Should have thrown RateLimitError");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        if (error instanceof RateLimitError) {
          expect(error.retryAfter).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Reset", () => {
    it("should reset rate limit for a request", async () => {
      await rateLimiter.checkLimit(mockRequest);
      await rateLimiter.checkLimit(mockRequest);
      await rateLimiter.checkLimit(mockRequest);

      await rateLimiter.reset(mockRequest);

      const result = await rateLimiter.checkLimit(mockRequest);
      expect(result.totalHits).toBe(1);
      expect(result.remainingPoints).toBe(4);
    });
  });

  describe("Get Status", () => {
    it("should get status without consuming points", async () => {
      const status1 = await rateLimiter.getStatus(mockRequest);
      expect(status1.totalHits).toBe(0);
      expect(status1.remainingPoints).toBe(5);

      await rateLimiter.checkLimit(mockRequest);

      const status2 = await rateLimiter.getStatus(mockRequest);
      expect(status2.totalHits).toBe(1);
      expect(status2.remainingPoints).toBe(4);
    });

    it("should not increment counter when checking status", async () => {
      await rateLimiter.getStatus(mockRequest);
      await rateLimiter.getStatus(mockRequest);
      await rateLimiter.getStatus(mockRequest);

      const status = await rateLimiter.getStatus(mockRequest);
      expect(status.totalHits).toBe(0);
    });
  });

  describe("Custom Key Generator", () => {
    it("should use custom key generator", async () => {
      const customKeyGen = vi.fn((req: any) => `custom-${req.userId}`);
      const config: RateLimitConfig = {
        windowMs: 1000,
        maxRequests: 3,
        keyGenerator: customKeyGen,
      };

      const customLimiter = new RateLimiter(config);
      await customLimiter.checkLimit(mockRequest);

      expect(customKeyGen).toHaveBeenCalledWith(mockRequest);
    });

    it("should track different keys separately", async () => {
      const config: RateLimitConfig = {
        windowMs: 1000,
        maxRequests: 5,
        keyGenerator: (req: any) => `user:${req.userId}`,
      };
      const limiter = new RateLimiter(config);

      const user1 = { userId: "user-1" };
      const user2 = { userId: "user-2" };

      await limiter.checkLimit(user1);
      await limiter.checkLimit(user1);

      await limiter.checkLimit(user2);

      const status1 = await limiter.getStatus(user1);
      const status2 = await limiter.getStatus(user2);

      expect(status1.totalHits).toBe(2);
      expect(status2.totalHits).toBe(1);
    });
  });

  describe("Callback on Limit Reached", () => {
    it("should call onLimitReached callback", async () => {
      const onLimitReached = vi.fn();
      const config: RateLimitConfig = {
        windowMs: 1000,
        maxRequests: 2,
        onLimitReached,
      };

      const limiter = new RateLimiter(config);

      await limiter.checkLimit(mockRequest);
      await limiter.checkLimit(mockRequest);

      expect(onLimitReached).not.toHaveBeenCalled();

      await limiter.checkLimit(mockRequest); // Exceeds limit

      expect(onLimitReached).toHaveBeenCalledTimes(1);
      expect(onLimitReached).toHaveBeenCalledWith(
        expect.any(String),
        3, // totalHits
      );
    });
  });

  describe("Custom Store", () => {
    it("should work with custom store", async () => {
      const customStore = new MemoryRateLimitStore(2000);
      const config: RateLimitConfig = {
        windowMs: 2000,
        maxRequests: 10,
        store: customStore,
      };

      const customLimiter = new RateLimiter(config);
      const result = await customLimiter.checkLimit(mockRequest);

      expect(result.totalHits).toBe(1);
      expect(result.remainingPoints).toBe(9);

      customStore.destroy();
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero remaining points correctly", async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(mockRequest);
      }

      const result = await rateLimiter.checkLimit(mockRequest);
      expect(result.remainingPoints).toBe(0);
    });

    it("should never return negative remaining points", async () => {
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkLimit(mockRequest);
        expect(result.remainingPoints).toBeGreaterThanOrEqual(0);
      }
    });

    it("should handle rapid successive requests", async () => {
      const results = await Promise.all([
        rateLimiter.checkLimit(mockRequest),
        rateLimiter.checkLimit(mockRequest),
        rateLimiter.checkLimit(mockRequest),
      ]);

      expect(results[2].totalHits).toBe(3);
    });
  });
});

describe("RateLimitError", () => {
  it("should create RateLimitError with message and retry time", () => {
    const error = new RateLimitError("Too many requests", 10, 5000);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.message).toBe("Too many requests");
    expect(error.totalHits).toBe(10);
    expect(error.retryAfter).toBe(5000);
  });

  it("should have correct error name", () => {
    const error = new RateLimitError("Test", 1, 1000);
    expect(error.name).toBe("RateLimitError");
  });
});
