/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

import { EventEmitter } from "events";
import {
  AgentMessage,
  AgentCommunication,
  AgentMessageSchema,
} from "./types.js";
import { Logger } from "./logger.js";
import { randomUUID } from "crypto";

export class MessageBus implements AgentCommunication {
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private messageQueues: Map<string, AgentMessage[]>;
  private subscribers: Map<string, (message: AgentMessage) => void>;

  constructor(logger: Logger) {
    this.eventEmitter = new EventEmitter();
    this.logger = logger;
    this.messageQueues = new Map();
    this.subscribers = new Map();

    this.eventEmitter.setMaxListeners(50);
  }

  async send(message: AgentMessage): Promise<void> {
    const validatedMessage = AgentMessageSchema.parse(message);

    const start = Date.now();

    try {
      if (!this.messageQueues.has(validatedMessage.receiver)) {
        this.messageQueues.set(validatedMessage.receiver, []);
      }

      const queue = this.messageQueues.get(validatedMessage.receiver);
      if (!queue) {
        throw new Error(
          `Failed to get message queue for receiver: ${validatedMessage.receiver}`,
        );
      }
      queue.push(validatedMessage);

      queue.sort((a, b) => b.priority - a.priority);

      this.eventEmitter.emit(
        `message:${validatedMessage.receiver}`,
        validatedMessage,
      );

      await this.logger.trace({
        level: "info",
        agentId: validatedMessage.sender,
        action: "message_sent",
        data: {
          messageId: validatedMessage.id,
          receiver: validatedMessage.receiver,
          type: validatedMessage.type,
          priority: validatedMessage.priority,
        },
        duration: Date.now() - start,
      });
    } catch (error) {
      await this.logger.trace({
        level: "error",
        agentId: validatedMessage.sender,
        action: "message_send_failed",
        data: { message: validatedMessage },
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  async receive(agentId: string): Promise<AgentMessage[]> {
    const start = Date.now();

    try {
      const queue = this.messageQueues.get(agentId) || [];
      this.messageQueues.set(agentId, []);

      await this.logger.trace({
        level: "debug",
        agentId,
        action: "messages_received",
        data: { messageCount: queue.length },
        duration: Date.now() - start,
      });

      return queue;
    } catch (error) {
      await this.logger.trace({
        level: "error",
        agentId,
        action: "message_receive_failed",
        data: {},
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  async broadcast(message: Omit<AgentMessage, "receiver">): Promise<void> {
    const broadcastMessage: AgentMessage = {
      ...message,
      receiver: "all",
      id: message.id || randomUUID(),
    };

    const start = Date.now();

    try {
      for (const [agentId, queue] of this.messageQueues.entries()) {
        if (agentId !== message.sender) {
          const agentMessage = { ...broadcastMessage, receiver: agentId };
          queue.push(agentMessage);
          queue.sort((a, b) => b.priority - a.priority);

          this.eventEmitter.emit(`message:${agentId}`, agentMessage);
        }
      }

      await this.logger.trace({
        level: "info",
        agentId: message.sender,
        action: "broadcast_sent",
        data: {
          messageId: broadcastMessage.id,
          type: broadcastMessage.type,
          recipientCount: this.messageQueues.size - 1,
        },
        duration: Date.now() - start,
      });
    } catch (error) {
      await this.logger.trace({
        level: "error",
        agentId: message.sender,
        action: "broadcast_failed",
        data: { message: broadcastMessage },
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  subscribe(agentId: string, callback: (message: AgentMessage) => void): void {
    this.subscribers.set(agentId, callback);
    this.eventEmitter.on(`message:${agentId}`, callback);

    if (!this.messageQueues.has(agentId)) {
      this.messageQueues.set(agentId, []);
    }

    this.logger.debug(`Agent ${agentId} subscribed to message bus`);
  }

  unsubscribe(agentId: string): void {
    const callback = this.subscribers.get(agentId);
    if (callback) {
      this.eventEmitter.off(`message:${agentId}`, callback);
      this.subscribers.delete(agentId);
    }

    this.messageQueues.delete(agentId);
    this.logger.debug(`Agent ${agentId} unsubscribed from message bus`);
  }

  getQueueStatus(): Record<string, number> {
    const status: Record<string, number> = {};
    for (const [agentId, queue] of this.messageQueues.entries()) {
      status[agentId] = queue.length;
    }
    return status;
  }
}
