import { BaseAgent } from '../core/baseAgent.js';
import { AgentMessage, AgentResult, AgentContext } from '../shared/types.js';
import { wordCount, difficultyScore } from '../shared/metrics.js';
import { Logger } from '../shared/logger.js';

export class QualityAuditor extends BaseAgent {
  constructor() { 
    super('quality-auditor', 'QualityAuditor', ['quality-assessment', 'metrics'], new Logger()); 
  }

  protected async handle(content: unknown, context?: AgentContext): Promise<unknown> {
    let input: any;

    // Parse input - could be JSON string or plain text
    try {
      if (typeof content === 'string' && content.trim().startsWith('{')) {
        input = JSON.parse(content);
      } else {
        // Treat as plain text answer
        input = { answer: String(content || '') };
      }
    } catch {
      input = { answer: String(content || '') };
    }

    // Basic quality checks
    const answer = input.answer || '';
    const issues: string[] = [];
    let status: 'PASS' | 'FAIL' = 'PASS';

    // Check if answer exists and is not empty
    if (!answer || answer.trim().length === 0) {
      issues.push('답변이 비어있습니다');
      status = 'FAIL';
    }

    // Check minimum length
    if (answer.trim().length > 0 && answer.trim().length < 5) {
      issues.push('답변이 너무 짧습니다');
      status = 'FAIL';
    }

    return {
      status,
      auditComplete: true,
      issues: issues.length > 0 ? issues : undefined
    };
  }
}
