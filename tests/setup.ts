/**
 * Global test setup file
 * Runs before all tests to configure the testing environment
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

// Mock environment variables for testing
beforeAll(() => {
  // Set up test environment variables
  process.env.NODE_ENV = "test";
  process.env.ENVIRONMENT = "test";
  process.env.ANTHROPIC_API_KEY = "test-key-placeholder-for-testing-only";
  process.env.OPENAI_API_KEY = "sk-test-key-for-testing-only";

  // Disable real API calls in tests
  process.env.DRY_RUN = "true";
  process.env.VITEST = "true";

  // Mock console methods to reduce noise in test output
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});

  // Keep error and warn for debugging
  vi.spyOn(console, "error").mockImplementation((...args) => {
    if (process.env.VERBOSE_TESTS === "true") {
      console.error(...args);
    }
  });

  vi.spyOn(console, "warn").mockImplementation((...args) => {
    if (process.env.VERBOSE_TESTS === "true") {
      console.warn(...args);
    }
  });
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});

// Reset state before each test
beforeEach(() => {
  // Clear any global state
  if (globalThis.__errorTrackingBreadcrumbs) {
    globalThis.__errorTrackingBreadcrumbs = [];
  }

  if (globalThis.__errorTrackingUserContext) {
    globalThis.__errorTrackingUserContext = undefined;
  }

  // Reset Date to real implementation
  vi.useRealTimers();
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

// Mock fetch for tests
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
    headers: new Headers(),
  } as Response),
);

// Mock setTimeout and setInterval for tests
vi.mock("timers", () => ({
  setTimeout: vi.fn((fn, delay) => {
    if (delay === 0) {
      fn();
      return 1;
    }
    return setTimeout(fn, delay);
  }),
  clearTimeout: vi.fn(),
  setInterval: vi.fn(),
  clearInterval: vi.fn(),
}));

// Export utility functions for tests
export const TestUtils = {
  /**
   * Create a mock request object for testing
   */
  createMockRequest: (overrides: any = {}) => ({
    headers: {
      "user-agent": "test-agent",
      "x-forwarded-for": "127.0.0.1",
      ...overrides.headers,
    },
    socket: {
      remoteAddress: "127.0.0.1",
    },
    body: {},
    query: {},
    params: {},
    ...overrides,
  }),

  /**
   * Create a mock response object for testing
   */
  createMockResponse: (overrides: any = {}) => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      ...overrides,
    };
    return res;
  },

  /**
   * Wait for a promise to resolve with timeout
   */
  waitFor: async (conditionFn: () => boolean, timeout = 5000) => {
    const start = Date.now();
    while (!conditionFn() && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (!conditionFn()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  },

  /**
   * Create a mock agent result
   */
  createMockAgentResult: (overrides: any = {}) => ({
    agentId: "test-agent",
    result: "test result",
    confidence: 0.8,
    reasoning: "test reasoning",
    performance: {
      duration: 1000,
      tokensUsed: 100,
      qualityScore: 8.5,
    },
    ...overrides,
  }),

  /**
   * Mock timer utilities
   */
  mockTimer: {
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    advanceToNext: () => vi.advanceTimersToNextTimer(),
    run: () => vi.runAllTimers(),
    clear: () => vi.clearAllTimers(),
  },
};

// Add custom matchers
expect.extend({
  toBeValidAgentResult(received) {
    const { isNot } = this;
    const pass =
      received &&
      typeof received.agentId === "string" &&
      received.result !== undefined &&
      typeof received.confidence === "number" &&
      received.confidence >= 0 &&
      received.confidence <= 1 &&
      typeof received.reasoning === "string" &&
      received.performance &&
      typeof received.performance.duration === "number" &&
      typeof received.performance.tokensUsed === "number" &&
      typeof received.performance.qualityScore === "number";

    return {
      pass,
      message: () =>
        isNot
          ? `Expected not to be valid agent result`
          : `Expected to be valid agent result but received: ${JSON.stringify(
              received,
            )}`,
    };
  },

  toBeValidErrorReport(received) {
    const { isNot } = this;
    const pass =
      received &&
      typeof received.id === "string" &&
      received.timestamp instanceof Date &&
      received.error &&
      typeof received.error.name === "string" &&
      typeof received.error.message === "string" &&
      ["low", "medium", "high", "critical"].includes(received.severity) &&
      typeof received.fingerprint === "string" &&
      Array.isArray(received.tags);

    return {
      pass,
      message: () =>
        isNot
          ? `Expected not to be valid error report`
          : `Expected to be valid error report but received: ${JSON.stringify(
              received,
            )}`,
    };
  },
});

// Declare custom matchers for TypeScript
declare module "vitest" {
  interface Assertion<T = any> {
    toBeValidAgentResult(): T;
    toBeValidErrorReport(): T;
  }
}
