import { AgentMessage, AgentCommunication } from "./types.js";
import { Logger } from "./logger.js";
export declare class MessageBus implements AgentCommunication {
  private eventEmitter;
  private logger;
  private messageQueues;
  private subscribers;
  constructor(logger: Logger);
  send(message: AgentMessage): Promise<void>;
  receive(agentId: string): Promise<AgentMessage[]>;
  broadcast(message: Omit<AgentMessage, "receiver">): Promise<void>;
  subscribe(agentId: string, callback: (message: AgentMessage) => void): void;
  unsubscribe(agentId: string): void;
  getQueueStatus(): Record<string, number>;
}
//# sourceMappingURL=bus.d.ts.map
