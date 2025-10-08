/**
 * Phase 1: Multi-Agent Bus Integration Tests
 *
 * Tests the integration of:
 * - Handshake (UUID v7 + Signature)
 * - Capability Token (Permissions + Usage Tracking)
 * - Fairness Scheduler (Priority Aging + Quota)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateUUIDv7, registerAgent, verifyAgentIdentity } from "../../src/multi-agent-bus/handshake.js";
import {
  generateCapabilityToken,
  validateCapabilityToken,
  checkToolPermission,
  recordToolUsage,
  getTokenUsageStats,
} from "../../src/multi-agent-bus/capability-token.js";
import {
  FairnessScheduler,
  resetGlobalScheduler,
} from "../../src/multi-agent-bus/fairness-scheduler.js";

describe("Phase 1: Multi-Agent Bus (MBC) Integration", () => {
  let scheduler: FairnessScheduler;

  beforeEach(() => {
    scheduler = new FairnessScheduler();
    resetGlobalScheduler();
  });

  afterEach(() => {
    scheduler.shutdown();
  });

  describe("Handshake → Capability Token Flow", () => {
    it("should complete full agent registration flow", () => {
      // 1. Generate agent ID (UUID v7)
      const agentId = generateUUIDv7();
      expect(agentId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      // 2. Register agent
      const publicKey = "test-public-key";
      const identity = registerAgent(agentId, publicKey, "internal");
      expect(identity.agentId).toBe(agentId);
      expect(identity.publicKey).toBeDefined();

      // 3. Verify identity
      const verification = verifyAgentIdentity(identity);
      expect(verification.valid).toBe(true);

      // 4. Generate capability token
      const token = generateCapabilityToken(
        agentId,
        ["retrieval", "evaluation"],
        [
          { tool: "rag:search", level: "read" },
          { tool: "llm:generate", level: "execute", constraints: { maxCalls: 100 } },
        ],
      );

      expect(token.agentId).toBe(agentId);
      expect(token.capabilities).toEqual(["retrieval", "evaluation"]);
      expect(token.permissions).toHaveLength(2);

      // 5. Validate token
      const validation = validateCapabilityToken(token);
      expect(validation.valid).toBe(true);
    });

    it("should enforce tool permissions", () => {
      const agentId = generateUUIDv7();

      // Token with read-only permission
      const token = generateCapabilityToken(
        agentId,
        ["retrieval"],
        [{ tool: "rag:search", level: "read" }],
      );

      // Should allow read
      expect(checkToolPermission(token, "rag:search", "read")).toBe(true);

      // Should deny write
      expect(checkToolPermission(token, "rag:search", "write")).toBe(false);

      // Should deny execute
      expect(checkToolPermission(token, "rag:search", "execute")).toBe(false);
    });

    it("should track tool usage", () => {
      const agentId = generateUUIDv7();

      const token = generateCapabilityToken(
        agentId,
        ["generation"],
        [{ tool: "llm:generate", level: "execute" }],
      );

      // Record usage
      recordToolUsage(token, "llm:generate", {
        success: true,
        duration: 1500,
        cost: 0.05,
        tokens: 100,
      });

      recordToolUsage(token, "llm:generate", {
        success: true,
        duration: 1200,
        cost: 0.03,
        tokens: 80,
      });

      // Get stats
      const stats = getTokenUsageStats(token.tokenId);

      expect(stats.totalCalls).toBe(2);
      expect(stats.totalCost).toBe(0.08);
      expect(stats.totalTokens).toBe(180);
      expect(stats.successRate).toBe(1.0);
    });

    it("should enforce max calls constraint", () => {
      const agentId = generateUUIDv7();

      const token = generateCapabilityToken(
        agentId,
        ["generation"],
        [{ tool: "llm:generate", level: "execute", constraints: { maxCalls: 2 } }],
      );

      // First call should succeed
      expect(checkToolPermission(token, "llm:generate", "execute")).toBe(true);
      recordToolUsage(token, "llm:generate", { success: true, duration: 100 });

      // Second call should succeed
      expect(checkToolPermission(token, "llm:generate", "execute")).toBe(true);
      recordToolUsage(token, "llm:generate", { success: true, duration: 100 });

      // Third call should fail (maxCalls=2)
      expect(checkToolPermission(token, "llm:generate", "execute")).toBe(false);
    });
  });

  describe("Fairness Scheduler", () => {
    it("should schedule tasks by priority", () => {
      // Submit tasks with different priorities
      scheduler.submit({
        taskId: "task-1",
        agentId: "agent-1",
        priority: 3,
        submittedAt: Date.now(),
      });

      scheduler.submit({
        taskId: "task-2",
        agentId: "agent-2",
        priority: 1, // Highest
        submittedAt: Date.now(),
      });

      scheduler.submit({
        taskId: "task-3",
        agentId: "agent-3",
        priority: 5, // Lowest
        submittedAt: Date.now(),
      });

      // Should get highest priority first (priority=1)
      const task1 = scheduler.next();
      expect(task1?.taskId).toBe("task-2");

      // Then medium priority (priority=3)
      const task2 = scheduler.next();
      expect(task2?.taskId).toBe("task-1");

      // Finally lowest priority (priority=5)
      const task3 = scheduler.next();
      expect(task3?.taskId).toBe("task-3");
    });

    it("should enforce agent quota", () => {
      // Set quota: max 2 concurrent, max 5 per minute
      scheduler.setAgentQuota("agent-1", {
        agentId: "agent-1",
        maxConcurrent: 2,
        maxPerMinute: 5,
        maxPerHour: 100,
      });

      // Submit 3 tasks from same agent
      const result1 = scheduler.submit({
        taskId: "task-1",
        agentId: "agent-1",
        priority: 3,
        submittedAt: Date.now(),
      });
      expect(result1).toBe(true);

      const result2 = scheduler.submit({
        taskId: "task-2",
        agentId: "agent-1",
        priority: 3,
        submittedAt: Date.now(),
      });
      expect(result2).toBe(true);

      // Get 2 tasks (now at max concurrent)
      scheduler.next();
      scheduler.next();

      // Third submission should fail (maxConcurrent=2)
      const result3 = scheduler.submit({
        taskId: "task-3",
        agentId: "agent-1",
        priority: 3,
        submittedAt: Date.now(),
      });
      expect(result3).toBe(false);
    });

    it("should provide scheduler statistics", () => {
      // Submit tasks
      scheduler.submit({
        taskId: "task-1",
        agentId: "agent-1",
        priority: 3,
        submittedAt: Date.now(),
      });

      scheduler.submit({
        taskId: "task-2",
        agentId: "agent-2",
        priority: 2,
        submittedAt: Date.now(),
      });

      // Get task
      const task = scheduler.next();
      expect(task).toBeDefined();

      // Complete task
      scheduler.complete({
        taskId: task!.taskId,
        agentId: task!.agentId,
        success: true,
        duration: 1000,
      });

      // Get stats
      const stats = scheduler.getStats();

      expect(stats.totalSubmitted).toBe(2);
      expect(stats.totalCompleted).toBe(1);
      expect(stats.queueLength).toBe(1);
      expect(stats.activeTasksCount).toBe(0);
    });
  });

  describe("End-to-End: Agent Registration → Task Execution", () => {
    it("should complete full E2E flow", () => {
      // 1. Register agent
      const agentId = generateUUIDv7();
      const identity = registerAgent(agentId, "public-key", "internal");
      expect(verifyAgentIdentity(identity).valid).toBe(true);

      // 2. Generate capability token
      const token = generateCapabilityToken(
        agentId,
        ["retrieval"],
        [{ tool: "rag:search", level: "read", constraints: { maxCalls: 10 } }],
      );

      expect(validateCapabilityToken(token).valid).toBe(true);

      // 3. Submit task to scheduler
      const submitted = scheduler.submit({
        taskId: "e2e-task-1",
        agentId,
        priority: 2,
        submittedAt: Date.now(),
        metadata: { type: "retrieval", description: "E2E test" },
      });

      expect(submitted).toBe(true);

      // 4. Get task from scheduler
      const task = scheduler.next();
      expect(task?.taskId).toBe("e2e-task-1");
      expect(task?.agentId).toBe(agentId);

      // 5. Check tool permission
      const canUseRag = checkToolPermission(token, "rag:search", "read");
      expect(canUseRag).toBe(true);

      // 6. Simulate tool usage
      recordToolUsage(token, "rag:search", {
        success: true,
        duration: 500,
        cost: 0.01,
        tokens: 50,
      });

      // 7. Complete task
      scheduler.complete({
        taskId: task!.taskId,
        agentId,
        success: true,
        duration: 500,
      });

      // 8. Verify stats
      const tokenStats = getTokenUsageStats(token.tokenId);
      expect(tokenStats.totalCalls).toBe(1);

      const schedulerStats = scheduler.getStats();
      expect(schedulerStats.totalCompleted).toBe(1);
    });
  });
});
