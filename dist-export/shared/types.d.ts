import { z } from "zod";
export declare const AgentMessageSchema: z.ZodObject<
  {
    id: z.ZodString;
    sender: z.ZodString;
    receiver: z.ZodString;
    type: z.ZodEnum<["request", "response", "broadcast", "collaboration"]>;
    content: z.ZodUnknown;
    timestamp: z.ZodDate;
    priority: z.ZodUnion<
      [
        z.ZodLiteral<1>,
        z.ZodLiteral<2>,
        z.ZodLiteral<3>,
        z.ZodLiteral<4>,
        z.ZodLiteral<5>,
      ]
    >;
    context: z.ZodOptional<
      z.ZodObject<
        {
          taskId: z.ZodString;
          phase: z.ZodString;
          sharedMemory: z.ZodRecord<z.ZodString, z.ZodUnknown>;
          qualityTarget: z.ZodNumber;
          domainContext: z.ZodString;
        },
        "strip",
        z.ZodTypeAny,
        {
          taskId: string;
          phase: string;
          sharedMemory: Record<string, unknown>;
          qualityTarget: number;
          domainContext: string;
        },
        {
          taskId: string;
          phase: string;
          sharedMemory: Record<string, unknown>;
          qualityTarget: number;
          domainContext: string;
        }
      >
    >;
  },
  "strip",
  z.ZodTypeAny,
  {
    id: string;
    sender: string;
    receiver: string;
    type: "request" | "response" | "broadcast" | "collaboration";
    timestamp: Date;
    priority: 1 | 2 | 4 | 3 | 5;
    content?: unknown;
    context?:
      | {
          taskId: string;
          phase: string;
          sharedMemory: Record<string, unknown>;
          qualityTarget: number;
          domainContext: string;
        }
      | undefined;
  },
  {
    id: string;
    sender: string;
    receiver: string;
    type: "request" | "response" | "broadcast" | "collaboration";
    timestamp: Date;
    priority: 1 | 2 | 4 | 3 | 5;
    content?: unknown;
    context?:
      | {
          taskId: string;
          phase: string;
          sharedMemory: Record<string, unknown>;
          qualityTarget: number;
          domainContext: string;
        }
      | undefined;
  }
>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
export declare const AgentContextSchema: z.ZodObject<
  {
    taskId: z.ZodString;
    phase: z.ZodString;
    sharedMemory: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    qualityTarget: z.ZodNumber;
    domainContext: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    taskId: string;
    phase: string;
    sharedMemory: Record<string, unknown>;
    qualityTarget: number;
    domainContext: string;
  },
  {
    taskId: string;
    phase: string;
    sharedMemory: Record<string, unknown>;
    qualityTarget: number;
    domainContext: string;
  }
>;
export type AgentContext = z.infer<typeof AgentContextSchema>;
export declare const AgentResultSchema: z.ZodObject<
  {
    agentId: z.ZodString;
    result: z.ZodUnknown;
    confidence: z.ZodNumber;
    reasoning: z.ZodString;
    performance: z.ZodObject<
      {
        duration: z.ZodNumber;
        tokensUsed: z.ZodNumber;
        qualityScore: z.ZodNumber;
      },
      "strip",
      z.ZodTypeAny,
      {
        duration: number;
        tokensUsed: number;
        qualityScore: number;
      },
      {
        duration: number;
        tokensUsed: number;
        qualityScore: number;
      }
    >;
  },
  "strip",
  z.ZodTypeAny,
  {
    agentId: string;
    confidence: number;
    reasoning: string;
    performance: {
      duration: number;
      tokensUsed: number;
      qualityScore: number;
    };
    result?: unknown;
  },
  {
    agentId: string;
    confidence: number;
    reasoning: string;
    performance: {
      duration: number;
      tokensUsed: number;
      qualityScore: number;
    };
    result?: unknown;
  }
>;
export type AgentResult = z.infer<typeof AgentResultSchema>;
export declare const TraceLogSchema: z.ZodObject<
  {
    id: z.ZodString;
    timestamp: z.ZodDate;
    level: z.ZodEnum<["debug", "info", "warn", "error"]>;
    agentId: z.ZodString;
    action: z.ZodString;
    data: z.ZodUnknown;
    duration: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    id: string;
    timestamp: Date;
    agentId: string;
    level: "debug" | "info" | "warn" | "error";
    action: string;
    duration?: number | undefined;
    error?: string | undefined;
    data?: unknown;
  },
  {
    id: string;
    timestamp: Date;
    agentId: string;
    level: "debug" | "info" | "warn" | "error";
    action: string;
    duration?: number | undefined;
    error?: string | undefined;
    data?: unknown;
  }
>;
export type TraceLog = z.infer<typeof TraceLogSchema>;
export declare const QAPairSchema: z.ZodObject<
  {
    id: z.ZodString;
    question: z.ZodString;
    answer: z.ZodString;
    domain: z.ZodString;
    complexity: z.ZodNumber;
    qualityScore: z.ZodNumber;
    metadata: z.ZodObject<
      {
        generatedBy: z.ZodArray<z.ZodString, "many">;
        reasoning: z.ZodString;
        expertLevel: z.ZodNumber;
        tags: z.ZodArray<z.ZodString, "many">;
      },
      "strip",
      z.ZodTypeAny,
      {
        reasoning: string;
        generatedBy: string[];
        expertLevel: number;
        tags: string[];
      },
      {
        reasoning: string;
        generatedBy: string[];
        expertLevel: number;
        tags: string[];
      }
    >;
  },
  "strip",
  z.ZodTypeAny,
  {
    id: string;
    qualityScore: number;
    question: string;
    answer: string;
    domain: string;
    complexity: number;
    metadata: {
      reasoning: string;
      generatedBy: string[];
      expertLevel: number;
      tags: string[];
    };
  },
  {
    id: string;
    qualityScore: number;
    question: string;
    answer: string;
    domain: string;
    complexity: number;
    metadata: {
      reasoning: string;
      generatedBy: string[];
      expertLevel: number;
      tags: string[];
    };
  }
>;
export type QAPair = z.infer<typeof QAPairSchema>;
export declare const TaskRequestSchema: z.ZodObject<
  {
    id: z.ZodString;
    description: z.ZodString;
    domain: z.ZodString;
    quantity: z.ZodNumber;
    qualityTarget: z.ZodNumber;
    complexity: z.ZodOptional<z.ZodNumber>;
    specialization: z.ZodOptional<z.ZodString>;
    constraints: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  },
  "strip",
  z.ZodTypeAny,
  {
    id: string;
    qualityTarget: number;
    domain: string;
    description: string;
    quantity: number;
    complexity?: number | undefined;
    specialization?: string | undefined;
    constraints?: Record<string, unknown> | undefined;
  },
  {
    id: string;
    qualityTarget: number;
    domain: string;
    description: string;
    quantity: number;
    complexity?: number | undefined;
    specialization?: string | undefined;
    constraints?: Record<string, unknown> | undefined;
  }
>;
export type TaskRequest = z.infer<typeof TaskRequestSchema>;
export declare const QARequestSchema: z.ZodObject<
  {
    topic: z.ZodString;
    complexity: z.ZodOptional<z.ZodNumber>;
    domainContext: z.ZodOptional<z.ZodString>;
    qualityTarget: z.ZodOptional<z.ZodNumber>;
    count: z.ZodOptional<z.ZodNumber>;
  },
  "strip",
  z.ZodTypeAny,
  {
    topic: string;
    qualityTarget?: number | undefined;
    domainContext?: string | undefined;
    complexity?: number | undefined;
    count?: number | undefined;
  },
  {
    topic: string;
    qualityTarget?: number | undefined;
    domainContext?: string | undefined;
    complexity?: number | undefined;
    count?: number | undefined;
  }
>;
export type QARequest = z.infer<typeof QARequestSchema>;
export declare const QAResponseSchema: z.ZodObject<
  {
    questions: z.ZodArray<
      z.ZodObject<
        {
          question: z.ZodString;
          answer: z.ZodString;
          confidence: z.ZodNumber;
          domain: z.ZodString;
        },
        "strip",
        z.ZodTypeAny,
        {
          confidence: number;
          question: string;
          answer: string;
          domain: string;
        },
        {
          confidence: number;
          question: string;
          answer: string;
          domain: string;
        }
      >,
      "many"
    >;
    metadata: z.ZodObject<
      {
        processTime: z.ZodNumber;
        agentsUsed: z.ZodArray<z.ZodString, "many">;
        qualityScore: z.ZodNumber;
      },
      "strip",
      z.ZodTypeAny,
      {
        qualityScore: number;
        processTime: number;
        agentsUsed: string[];
      },
      {
        qualityScore: number;
        processTime: number;
        agentsUsed: string[];
      }
    >;
  },
  "strip",
  z.ZodTypeAny,
  {
    metadata: {
      qualityScore: number;
      processTime: number;
      agentsUsed: string[];
    };
    questions: {
      confidence: number;
      question: string;
      answer: string;
      domain: string;
    }[];
  },
  {
    metadata: {
      qualityScore: number;
      processTime: number;
      agentsUsed: string[];
    };
    questions: {
      confidence: number;
      question: string;
      answer: string;
      domain: string;
    }[];
  }
>;
export type QAResponse = z.infer<typeof QAResponseSchema>;
export interface AgentCommunication {
  send(message: AgentMessage): Promise<void>;
  receive(agentId: string): Promise<AgentMessage[]>;
  broadcast(message: Omit<AgentMessage, "receiver">): Promise<void>;
  subscribe(agentId: string, callback: (message: AgentMessage) => void): void;
  unsubscribe(agentId: string): void;
}
//# sourceMappingURL=types.d.ts.map
