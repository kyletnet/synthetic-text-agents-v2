/**
 * Unit tests for MessageBus implementation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MessageBus } from "../../src/shared/bus";
import { Logger } from "../../src/shared/logger";
import type { AgentMessage } from "../../src/shared/types";
import { randomUUID } from "crypto";

describe("MessageBus", () => {
  let messageBus: MessageBus;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({
      logLevel: "error",
      enableConsole: false,
      enableFile: false,
    });
    messageBus = new MessageBus(logger);
  });

  describe("Basic Operations", () => {
    it("should create a MessageBus instance", () => {
      expect(messageBus).toBeInstanceOf(MessageBus);
    });

    it("should send and receive messages", async () => {
      const message: AgentMessage = {
        id: randomUUID(),
        sender: "agent-1",
        receiver: "agent-2",
        type: "request",
        content: { test: "data" },
        timestamp: new Date(),
        priority: 1,
      };

      await messageBus.send(message);
      const received = await messageBus.receive("agent-2");

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        sender: "agent-1",
        receiver: "agent-2",
        type: "request",
      });
    });

    it("should handle priority queue correctly", async () => {
      const lowPriority: AgentMessage = {
        id: randomUUID(),
        sender: "agent-1",
        receiver: "agent-2",
        type: "request",
        content: { priority: "low" },
        timestamp: new Date(),
        priority: 1,
      };

      const highPriority: AgentMessage = {
        id: randomUUID(),
        sender: "agent-1",
        receiver: "agent-2",
        type: "request",
        content: { priority: "high" },
        timestamp: new Date(),
        priority: 5,
      };

      await messageBus.send(lowPriority);
      await messageBus.send(highPriority);

      const received = await messageBus.receive("agent-2");

      expect(received).toHaveLength(2);
      expect(received[0].priority).toBe(5);
      expect(received[1].priority).toBe(1);
    });

    it("should clear queue after receiving messages", async () => {
      const message: AgentMessage = {
        id: randomUUID(),
        sender: "agent-1",
        receiver: "agent-2",
        type: "request",
        content: {},
        timestamp: new Date(),
        priority: 1,
      };

      await messageBus.send(message);
      await messageBus.receive("agent-2");
      const secondReceive = await messageBus.receive("agent-2");

      expect(secondReceive).toHaveLength(0);
    });
  });

  describe("Broadcast", () => {
    it("should broadcast messages to all agents except sender", async () => {
      // Subscribe agents to create queues
      messageBus.subscribe("agent-1", () => {});
      messageBus.subscribe("agent-2", () => {});
      messageBus.subscribe("agent-3", () => {});

      const broadcastMessage = {
        id: randomUUID(),
        sender: "agent-1",
        type: "broadcast" as const,
        content: { announcement: "test" },
        timestamp: new Date(),
        priority: 3,
      };

      await messageBus.broadcast(broadcastMessage);

      const agent1Messages = await messageBus.receive("agent-1");
      const agent2Messages = await messageBus.receive("agent-2");
      const agent3Messages = await messageBus.receive("agent-3");

      expect(agent1Messages).toHaveLength(0); // Sender should not receive
      expect(agent2Messages).toHaveLength(1);
      expect(agent3Messages).toHaveLength(1);
    });
  });

  describe("Subscription", () => {
    it("should subscribe and receive messages via callback", async () => {
      let receivedMessage: AgentMessage | null = null;

      messageBus.subscribe("agent-2", (msg) => {
        receivedMessage = msg;
      });

      const message: AgentMessage = {
        id: randomUUID(),
        sender: "agent-1",
        receiver: "agent-2",
        type: "request",
        content: { test: "subscription" },
        timestamp: new Date(),
        priority: 1,
      };

      await messageBus.send(message);

      // Wait for event emission
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedMessage).not.toBeNull();
      expect(receivedMessage?.sender).toBe("agent-1");
    });

    it("should unsubscribe and stop receiving callbacks", async () => {
      let callbackCount = 0;

      messageBus.subscribe("agent-2", () => {
        callbackCount++;
      });

      const message: AgentMessage = {
        id: randomUUID(),
        sender: "agent-1",
        receiver: "agent-2",
        type: "request",
        content: {},
        timestamp: new Date(),
        priority: 1,
      };

      await messageBus.send(message);
      messageBus.unsubscribe("agent-2");
      await messageBus.send(message);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callbackCount).toBe(1); // Only first message
    });
  });

  describe("Queue Status", () => {
    it("should return queue status for all agents", async () => {
      const message1: AgentMessage = {
        id: randomUUID(),
        sender: "agent-1",
        receiver: "agent-2",
        type: "request",
        content: {},
        timestamp: new Date(),
        priority: 1,
      };

      const message2: AgentMessage = {
        id: randomUUID(),
        sender: "agent-1",
        receiver: "agent-3",
        type: "request",
        content: {},
        timestamp: new Date(),
        priority: 1,
      };

      await messageBus.send(message1);
      await messageBus.send(message2);

      const status = messageBus.getQueueStatus();

      expect(status["agent-2"]).toBe(1);
      expect(status["agent-3"]).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should validate message schema", async () => {
      const invalidMessage = {
        // Missing required fields
        sender: "agent-1",
        receiver: "agent-2",
      } as unknown as AgentMessage;

      await expect(messageBus.send(invalidMessage)).rejects.toThrow();
    });

    it("should handle invalid priority values", async () => {
      const invalidPriority = {
        id: randomUUID(),
        sender: "agent-1",
        receiver: "agent-2",
        type: "request",
        content: {},
        timestamp: new Date(),
        priority: 10, // Invalid: should be 1-5
      } as AgentMessage;

      await expect(messageBus.send(invalidPriority)).rejects.toThrow();
    });
  });
});
