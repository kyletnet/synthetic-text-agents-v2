import { describe, it, expect } from 'vitest';
import { 
  AgentMessageSchema, 
  AgentContextSchema, 
  AgentResultSchema, 
  TraceLogSchema,
  QAPairSchema,
  TaskRequestSchema
} from '../src/shared/types.js';

describe('Shared Types Validation', () => {
  describe('AgentMessageSchema', () => {
    it('should validate a valid agent message', () => {
      const validMessage = {
        id: 'msg-123',
        sender: 'agent-1',
        receiver: 'agent-2',
        type: 'request' as const,
        content: { data: 'test' },
        timestamp: new Date(),
        priority: 3 as const,
        context: {
          taskId: 'task-123',
          phase: 'execution',
          sharedMemory: {},
          qualityTarget: 8.5,
          domainContext: 'customer_service',
        }
      };

      expect(() => AgentMessageSchema.parse(validMessage)).not.toThrow();
    });

    it('should reject invalid priority values', () => {
      const invalidMessage = {
        id: 'msg-123',
        sender: 'agent-1', 
        receiver: 'agent-2',
        type: 'request' as const,
        content: { data: 'test' },
        timestamp: new Date(),
        priority: 6, // Invalid priority
      };

      expect(() => AgentMessageSchema.parse(invalidMessage)).toThrow();
    });

    it('should reject invalid message types', () => {
      const invalidMessage = {
        id: 'msg-123',
        sender: 'agent-1',
        receiver: 'agent-2', 
        type: 'invalid-type',
        content: { data: 'test' },
        timestamp: new Date(),
        priority: 1 as const,
      };

      expect(() => AgentMessageSchema.parse(invalidMessage)).toThrow();
    });
  });

  describe('AgentContextSchema', () => {
    it('should validate a valid agent context', () => {
      const validContext = {
        taskId: 'task-456',
        phase: 'planning',
        sharedMemory: { 
          previousResults: ['result1', 'result2'],
          agentState: { active: true } 
        },
        qualityTarget: 9.0,
        domainContext: 'sales',
      };

      expect(() => AgentContextSchema.parse(validContext)).not.toThrow();
    });

    it('should accept empty shared memory', () => {
      const validContext = {
        taskId: 'task-456', 
        phase: 'planning',
        sharedMemory: {},
        qualityTarget: 9.0,
        domainContext: 'sales',
      };

      expect(() => AgentContextSchema.parse(validContext)).not.toThrow();
    });
  });

  describe('AgentResultSchema', () => {
    it('should validate a valid agent result', () => {
      const validResult = {
        agentId: 'meta-controller',
        result: { decision: 'proceed', agents: ['agent1', 'agent2'] },
        confidence: 0.85,
        reasoning: 'Selected agents based on complexity analysis',
        performance: {
          duration: 1500,
          tokensUsed: 250,
          qualityScore: 8.2,
        },
      };

      expect(() => AgentResultSchema.parse(validResult)).not.toThrow();
    });

    it('should reject confidence values outside 0-1 range', () => {
      const invalidResult = {
        agentId: 'meta-controller',
        result: { decision: 'proceed' },
        confidence: 1.5, // Invalid confidence
        reasoning: 'Test reasoning',
        performance: {
          duration: 1500,
          tokensUsed: 250,
          qualityScore: 8.2,
        },
      };

      expect(() => AgentResultSchema.parse(invalidResult)).toThrow();
    });

    it('should reject quality scores outside 0-10 range', () => {
      const invalidResult = {
        agentId: 'meta-controller',
        result: { decision: 'proceed' },
        confidence: 0.8,
        reasoning: 'Test reasoning',
        performance: {
          duration: 1500,
          tokensUsed: 250,
          qualityScore: 12.0, // Invalid quality score
        },
      };

      expect(() => AgentResultSchema.parse(invalidResult)).toThrow();
    });
  });

  describe('TraceLogSchema', () => {
    it('should validate a valid trace log entry', () => {
      const validTrace = {
        id: 'trace-789',
        timestamp: new Date(),
        level: 'info' as const,
        agentId: 'quality-auditor',
        action: 'quality_assessment_completed',
        data: { 
          qualityScore: 8.7, 
          issues: 2,
          recommendations: ['improve clarity', 'add examples'] 
        },
        duration: 3000,
      };

      expect(() => TraceLogSchema.parse(validTrace)).not.toThrow();
    });

    it('should validate trace log without optional fields', () => {
      const minimalTrace = {
        id: 'trace-790',
        timestamp: new Date(),
        level: 'debug' as const,
        agentId: 'test-agent',
        action: 'test_action',
        data: { test: true },
      };

      expect(() => TraceLogSchema.parse(minimalTrace)).not.toThrow();
    });

    it('should reject invalid log levels', () => {
      const invalidTrace = {
        id: 'trace-791',
        timestamp: new Date(),
        level: 'invalid-level',
        agentId: 'test-agent', 
        action: 'test_action',
        data: {},
      };

      expect(() => TraceLogSchema.parse(invalidTrace)).toThrow();
    });
  });

  describe('QAPairSchema', () => {
    it('should validate a valid QA pair', () => {
      const validQA = {
        id: 'qa-001',
        question: 'How should customer service representatives handle billing disputes?',
        answer: 'First, listen actively to understand the specific issue. Then verify account details, investigate the dispute, and work with the customer to find an appropriate resolution while documenting the entire process.',
        domain: 'customer_service',
        complexity: 6,
        qualityScore: 8.5,
        metadata: {
          generatedBy: ['meta-controller', 'qa-generator'],
          reasoning: 'Generated using expert consultation approach',
          expertLevel: 4,
          tags: ['billing', 'dispute_resolution', 'customer_service'],
        },
      };

      expect(() => QAPairSchema.parse(validQA)).not.toThrow();
    });

    it('should reject invalid complexity scores', () => {
      const invalidQA = {
        id: 'qa-002',
        question: 'Test question?',
        answer: 'Test answer.',
        domain: 'general',
        complexity: 11, // Invalid complexity (must be 1-10)
        qualityScore: 8.0,
        metadata: {
          generatedBy: ['qa-generator'],
          reasoning: 'Test',
          expertLevel: 3,
          tags: ['test'],
        },
      };

      expect(() => QAPairSchema.parse(invalidQA)).toThrow();
    });

    it('should reject invalid quality scores', () => {
      const invalidQA = {
        id: 'qa-003',
        question: 'Test question?',
        answer: 'Test answer.',
        domain: 'general',
        complexity: 5,
        qualityScore: -1, // Invalid quality score
        metadata: {
          generatedBy: ['qa-generator'],
          reasoning: 'Test',
          expertLevel: 3,
          tags: ['test'],
        },
      };

      expect(() => QAPairSchema.parse(invalidQA)).toThrow();
    });
  });

  describe('TaskRequestSchema', () => {
    it('should validate a valid task request', () => {
      const validRequest = {
        id: 'task-001',
        description: 'Generate customer service QA for subscription billing',
        domain: 'customer_service',
        quantity: 10,
        qualityTarget: 8.0,
        complexity: 6,
        specialization: 'subscription_billing',
        constraints: {
          maxDuration: 300000,
          requireExpertValidation: true,
        },
      };

      expect(() => TaskRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should validate minimal task request', () => {
      const minimalRequest = {
        id: 'task-002',
        description: 'Basic QA generation',
        domain: 'general',
        quantity: 5,
        qualityTarget: 7.0,
      };

      expect(() => TaskRequestSchema.parse(minimalRequest)).not.toThrow();
    });

    it('should reject negative quantity', () => {
      const invalidRequest = {
        id: 'task-003',
        description: 'Invalid quantity test',
        domain: 'general',
        quantity: -5, // Invalid quantity
        qualityTarget: 7.0,
      };

      expect(() => TaskRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject invalid complexity range', () => {
      const invalidRequest = {
        id: 'task-004',
        description: 'Invalid complexity test',
        domain: 'general', 
        quantity: 5,
        qualityTarget: 7.0,
        complexity: 0, // Invalid complexity (must be 1-10)
      };

      expect(() => TaskRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject invalid quality target range', () => {
      const invalidRequest = {
        id: 'task-005',
        description: 'Invalid quality target test',
        domain: 'general',
        quantity: 5,
        qualityTarget: 12.0, // Invalid quality target (must be 0-10)
      };

      expect(() => TaskRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('Type Integration', () => {
    it('should work with complex nested data structures', () => {
      const complexMessage = AgentMessageSchema.parse({
        id: 'complex-msg',
        sender: 'orchestrator',
        receiver: 'qa-generator',
        type: 'request',
        content: {
          optimizedPrompt: 'Generate high-quality QA pairs...',
          taskRequest: {
            id: 'nested-task',
            description: 'Complex task',
            domain: 'sales',
            quantity: 15,
            qualityTarget: 9.0,
          },
          expertRecommendations: {
            psychology: { tone: 'professional' },
            linguistics: { structure: 'hierarchical' },
          },
        },
        timestamp: new Date(),
        priority: 2,
        context: {
          taskId: 'parent-task',
          phase: 'generation',
          sharedMemory: {
            previousAnalysis: { complexity: 7 },
            agentSelections: ['agent1', 'agent2'],
          },
          qualityTarget: 9.0,
          domainContext: 'sales',
        },
      });

      expect(complexMessage.id).toBe('complex-msg');
      expect(complexMessage.context?.taskId).toBe('parent-task');
      expect(typeof complexMessage.content).toBe('object');
    });
  });
});