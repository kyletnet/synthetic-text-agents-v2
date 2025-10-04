import { describe, it, expect, beforeEach, vi } from "vitest";
import { DeadLetterQueue } from "../../src/shared/deadLetterQueue";
import type { DLQConfig } from "../../src/shared/deadLetterQueue";

describe("DeadLetterQueue - Smoke Tests", () => {
  let dlq: DeadLetterQueue;
  let config: DLQConfig;

  beforeEach(() => {
    config = {
      maxRetries: 3,
      initialRetryDelay: 1000,
      maxRetryDelay: 60000,
      backoffMultiplier: 2,
      enableJitter: false,
      persistToDisk: false,
      maxQueueSize: 100,
    };
    dlq = new DeadLetterQueue(config);
  });

  describe("Instance Creation", () => {
    it("should create a DeadLetterQueue instance", () => {
      expect(dlq).toBeDefined();
      expect(dlq).toBeInstanceOf(DeadLetterQueue);
    });

    it("should create instance with custom config", () => {
      const customConfig: DLQConfig = {
        maxRetries: 5,
        initialRetryDelay: 2000,
        maxRetryDelay: 120000,
        backoffMultiplier: 3,
        enableJitter: true,
        persistToDisk: false,
        maxQueueSize: 200,
      };
      const customDlq = new DeadLetterQueue(customConfig);
      expect(customDlq).toBeDefined();
    });
  });

  describe("Adding Messages", () => {
    it("should add a message to the DLQ", async () => {
      const messageId = await dlq.addMessage(
        { test: "data" },
        "test-queue",
        "Connection timeout",
      );

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe("string");
    });

    it("should add message with custom priority", async () => {
      const messageId = await dlq.addMessage(
        { test: "data" },
        "test-queue",
        "Error",
        undefined,
        1, // High priority
      );

      expect(messageId).toBeDefined();
    });

    it("should add message with context", async () => {
      const messageId = await dlq.addMessage(
        { test: "data" },
        "test-queue",
        "Error",
        { userId: "123", sessionId: "abc" },
      );

      expect(messageId).toBeDefined();
    });

    it("should add message with custom maxRetries", async () => {
      const messageId = await dlq.addMessage(
        { test: "data" },
        "test-queue",
        "Error",
        undefined,
        5,
        10, // Custom max retries
      );

      expect(messageId).toBeDefined();
    });
  });

  describe("Retrieving Messages", () => {
    it("should get messages ready for retry", async () => {
      await dlq.addMessage({ test: "data" }, "test-queue", "Error");

      const readyMessages = dlq.getMessagesReadyForRetry();
      expect(Array.isArray(readyMessages)).toBe(true);
    });

    it("should get permanently failed messages", async () => {
      await dlq.addMessage({ test: "data" }, "test-queue", "Error");

      const failedMessages = dlq.getPermanentlyFailedMessages();
      expect(Array.isArray(failedMessages)).toBe(true);
    });

    it("should get all messages via getStats", async () => {
      await dlq.addMessage({ test: "data1" }, "queue1", "Error1");
      await dlq.addMessage({ test: "data2" }, "queue2", "Error2");

      const stats = dlq.getStats();
      expect(stats.totalMessages).toBeGreaterThanOrEqual(2);
    });

    it("should get messages by queue", async () => {
      await dlq.addMessage({ test: "data" }, "test-queue", "Error");

      const queueMessages = dlq.getMessagesByQueue("test-queue");
      expect(Array.isArray(queueMessages)).toBe(true);
    });

    it("should get messages by failure reason", async () => {
      await dlq.addMessage({ test: "data" }, "test-queue", "Timeout");

      const messages = dlq.getMessagesByFailureReason("Timeout");
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe("Message Operations", () => {
    it("should remove a message", async () => {
      const messageId = await dlq.addMessage(
        { test: "data" },
        "test-queue",
        "Error",
      );

      const removed = await dlq.removeMessage(messageId);
      expect(typeof removed).toBe("boolean");
    });

    it("should increment failure count", async () => {
      const messageId = await dlq.addMessage(
        { test: "data" },
        "test-queue",
        "Error",
      );

      await expect(dlq.incrementFailure(messageId)).resolves.not.toThrow();
    });

    it("should increment failure with new reason", async () => {
      const messageId = await dlq.addMessage(
        { test: "data" },
        "test-queue",
        "Error",
      );

      await expect(
        dlq.incrementFailure(messageId, "New Error Reason"),
      ).resolves.not.toThrow();
    });
  });

  describe("Statistics", () => {
    it("should get DLQ statistics", async () => {
      await dlq.addMessage({ test: "data1" }, "queue1", "Error1");
      await dlq.addMessage({ test: "data2" }, "queue2", "Error2");

      const stats = dlq.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalMessages).toBe("number");
      expect(stats.messagesByQueue).toBeDefined();
      expect(stats.messagesByFailureReason).toBeDefined();
    });
  });

  describe("Queue Management", () => {
    it("should clear all messages", async () => {
      await dlq.addMessage({ test: "data1" }, "queue1", "Error1");
      await dlq.addMessage({ test: "data2" }, "queue2", "Error2");

      await dlq.clearAll();

      const stats = dlq.getStats();
      expect(stats.totalMessages).toBe(0);
    });

    it("should handle monitor callback", () => {
      const monitor = vi.fn();
      const configWithMonitor: DLQConfig = {
        ...config,
        monitor,
      };

      const monitoredDlq = new DeadLetterQueue(configWithMonitor);
      expect(monitoredDlq).toBeDefined();
    });
  });

  describe("Configuration", () => {
    it("should respect maxQueueSize limit", async () => {
      const smallConfig: DLQConfig = {
        ...config,
        maxQueueSize: 2,
      };
      const smallDlq = new DeadLetterQueue(smallConfig);

      await smallDlq.addMessage({ test: "data1" }, "queue1", "Error1");
      await smallDlq.addMessage({ test: "data2" }, "queue2", "Error2");
      await smallDlq.addMessage({ test: "data3" }, "queue3", "Error3");

      const stats = smallDlq.getStats();
      expect(stats.totalMessages).toBeLessThanOrEqual(2);
    });

    it("should work with jitter enabled", () => {
      const jitterConfig: DLQConfig = {
        ...config,
        enableJitter: true,
      };
      const jitterDlq = new DeadLetterQueue(jitterConfig);
      expect(jitterDlq).toBeDefined();
    });
  });
});
