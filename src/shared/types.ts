import { z } from "zod";

export const AgentMessageSchema = z.object({
  id: z.string(),
  sender: z.string(),
  receiver: z.string(),
  type: z.enum(["request", "response", "broadcast", "collaboration"]),
  content: z.unknown(),
  timestamp: z.date(),
  priority: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  context: z.optional(
    z.object({
      taskId: z.string(),
      phase: z.string(),
      sharedMemory: z.record(z.unknown()),
      qualityTarget: z.number(),
      domainContext: z.string(),
    }),
  ),
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentContextSchema = z.object({
  taskId: z.string(),
  phase: z.string(),
  sharedMemory: z.record(z.unknown()),
  qualityTarget: z.number(),
  domainContext: z.string(),
});

export type AgentContext = z.infer<typeof AgentContextSchema>;

export const AgentResultSchema = z.object({
  agentId: z.string(),
  result: z.unknown(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  performance: z.object({
    duration: z.number(),
    tokensUsed: z.number(),
    qualityScore: z.number().min(0).max(10),
  }),
});

export type AgentResult = z.infer<typeof AgentResultSchema>;

export const TraceLogSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  level: z.enum(["debug", "info", "warn", "error"]),
  agentId: z.string(),
  action: z.string(),
  data: z.unknown(),
  duration: z.optional(z.number()),
  error: z.optional(z.string()),
});

export type TraceLog = z.infer<typeof TraceLogSchema>;

export const QAPairSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  domain: z.string(),
  complexity: z.number().min(1).max(10),
  qualityScore: z.number().min(0).max(10),
  metadata: z.object({
    generatedBy: z.array(z.string()),
    reasoning: z.string(),
    expertLevel: z.number().min(1).max(5),
    tags: z.array(z.string()),
  }),
});

export type QAPair = z.infer<typeof QAPairSchema>;

export const TaskRequestSchema = z.object({
  id: z.string(),
  description: z.string(),
  domain: z.string(),
  quantity: z.number().positive(),
  qualityTarget: z.number().min(0).max(10),
  complexity: z.optional(z.number().min(1).max(10)),
  specialization: z.optional(z.string()),
  constraints: z.optional(z.record(z.unknown())),
});

export type TaskRequest = z.infer<typeof TaskRequestSchema>;

export const QARequestSchema = z.object({
  topic: z.string(),
  complexity: z.optional(z.number().min(1).max(10)),
  domainContext: z.optional(z.string()),
  qualityTarget: z.optional(z.number().min(0).max(10)),
  count: z.optional(z.number().positive()),
});

export type QARequest = z.infer<typeof QARequestSchema>;

export const QAResponseSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      confidence: z.number().min(0).max(1),
      domain: z.string(),
    }),
  ),
  metadata: z.object({
    processTime: z.number(),
    agentsUsed: z.array(z.string()),
    qualityScore: z.number().min(0).max(10),
  }),
});

export type QAResponse = z.infer<typeof QAResponseSchema>;

export interface AgentCommunication {
  send(message: AgentMessage): Promise<void>;
  receive(agentId: string): Promise<AgentMessage[]>;
  broadcast(message: Omit<AgentMessage, "receiver">): Promise<void>;
  subscribe(agentId: string, callback: (message: AgentMessage) => void): void;
  unsubscribe(agentId: string): void;
}
