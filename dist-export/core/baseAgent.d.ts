import { BaseAgent as IBaseAgent } from "../shared/registry.js";
import { AgentResult, AgentContext } from "../shared/types.js";
import { Logger } from "../shared/logger.js";
export declare abstract class BaseAgent implements IBaseAgent {
  readonly id: string;
  readonly specialization: string;
  readonly tags: readonly string[];
  protected logger: Logger;
  private performanceHistory;
  constructor(
    id: string,
    specialization: string,
    tags: string[],
    logger: Logger,
  );
  receive(content: unknown, context?: unknown): Promise<unknown>;
  protected abstract handle(
    content: unknown,
    context?: AgentContext,
  ): Promise<unknown>;
  protected assessConfidence(
    _result: unknown,
    _context?: AgentContext,
  ): Promise<number>;
  protected explainReasoning(
    input: unknown,
    output: unknown,
    _context?: AgentContext,
  ): Promise<string>;
  protected estimateTokensUsed(
    input: unknown,
    output: unknown,
  ): Promise<number>;
  protected assessQuality(
    result: unknown,
    context?: AgentContext,
  ): Promise<number>;
  protected validateInput(input: unknown): Promise<void>;
  getPerformanceMetrics(): {
    averageConfidence: number;
    averageQuality: number;
    averageDuration: number;
    totalTasks: number;
  };
  getRecentPerformance(limit?: number): AgentResult[];
}
//# sourceMappingURL=baseAgent.d.ts.map
