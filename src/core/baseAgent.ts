import { randomUUID } from "crypto";
import { BaseAgent as IBaseAgent } from "../shared/registry.js";
import {
  AgentResult,
  AgentResultSchema,
  AgentContext,
} from "../shared/types.js";
import { Logger } from "../shared/logger.js";
import { PerformanceGuardian } from "./performanceGuardian.js";

export abstract class BaseAgent implements IBaseAgent {
  public readonly id: string;
  public readonly specialization: string;
  public readonly tags: readonly string[];
  protected logger: Logger;
  private performanceHistory: AgentResult[] = [];

  constructor(
    id: string,
    specialization: string,
    tags: string[],
    logger: Logger,
  ) {
    this.id = id;
    this.specialization = specialization;
    this.tags = Object.freeze([...tags]);
    this.logger = logger;
  }

  async receive(content: unknown, context?: unknown): Promise<unknown> {
    const start = Date.now();
    const taskId = randomUUID();

    await this.logger.trace({
      level: "info",
      agentId: this.id,
      action: "task_received",
      data: { taskId, contentType: typeof content },
    });

    try {
      const result = await this.handle(content, context as AgentContext);
      const duration = Date.now() - start;

      const agentResult: AgentResult = {
        agentId: this.id,
        result,
        confidence: await this.assessConfidence(
          result,
          context as AgentContext,
        ),
        reasoning: await this.explainReasoning(
          content,
          result,
          context as AgentContext,
        ),
        performance: {
          duration,
          tokensUsed: await this.estimateTokensUsed(content, result),
          qualityScore: await this.assessQuality(
            result,
            context as AgentContext,
          ),
        },
      };

      const validatedResult = AgentResultSchema.parse(agentResult);

      // Pass through PerformanceGuardian for evaluation
      const guardian = new PerformanceGuardian();
      const guardedResult = guardian.evaluate(validatedResult);

      if (!guardedResult.ok) {
        await this.logger.trace({
          level: "warn",
          agentId: this.id,
          action: "guardian_vetoed_result",
          data: {
            taskId,
            issues: guardedResult.issues,
            qualityScore: validatedResult.performance.qualityScore,
            duration: validatedResult.performance.duration,
          },
          duration,
        });

        // Return the vetoed result (orchestrator will handle appropriately)
        return guardedResult;
      }

      this.performanceHistory.push(validatedResult);

      if (this.performanceHistory.length > 100) {
        this.performanceHistory = this.performanceHistory.slice(-50);
      }

      await this.logger.trace({
        level: "info",
        agentId: this.id,
        action: "task_completed",
        data: {
          taskId,
          confidence: validatedResult.confidence,
          qualityScore: validatedResult.performance.qualityScore,
        },
        duration,
      });

      return validatedResult;
    } catch (error) {
      await this.logger.trace({
        level: "error",
        agentId: this.id,
        action: "task_failed",
        data: {
          taskId,
          error: error instanceof Error ? error.message : String(error),
        },
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  protected abstract handle(
    content: unknown,
    context?: AgentContext,
  ): Promise<unknown>;

  protected async assessConfidence(
    _result: unknown,
    _context?: AgentContext,
  ): Promise<number> {
    return 0.8;
  }

  protected async explainReasoning(
    input: unknown,
    output: unknown,
    _context?: AgentContext,
  ): Promise<string> {
    return `Agent ${
      this.id
    } processed ${typeof input} input and produced ${typeof output} output using ${
      this.specialization
    } expertise.`;
  }

  protected async estimateTokensUsed(
    input: unknown,
    output: unknown,
  ): Promise<number> {
    const inputStr = typeof input === "string" ? input : JSON.stringify(input);
    const outputStr =
      typeof output === "string" ? output : JSON.stringify(output);
    return Math.ceil((inputStr.length + outputStr.length) / 4);
  }

  protected async assessQuality(
    result: unknown,
    context?: AgentContext,
  ): Promise<number> {
    const qualityTarget = context?.qualityTarget || 8;
    return Math.min(qualityTarget, 8.5);
  }

  protected async validateInput(input: unknown): Promise<void> {
    if (input === null || input === undefined) {
      throw new Error("Input cannot be null or undefined");
    }
  }

  public getPerformanceMetrics(): {
    averageConfidence: number;
    averageQuality: number;
    averageDuration: number;
    totalTasks: number;
  } {
    if (this.performanceHistory.length === 0) {
      return {
        averageConfidence: 0,
        averageQuality: 0,
        averageDuration: 0,
        totalTasks: 0,
      };
    }

    const totals = this.performanceHistory.reduce(
      (acc, result) => ({
        confidence: acc.confidence + result.confidence,
        quality: acc.quality + (result.performance?.qualityScore || 0),
        duration: acc.duration + (result.performance?.duration || 0),
      }),
      { confidence: 0, quality: 0, duration: 0 },
    );

    const count = this.performanceHistory.length;

    return {
      averageConfidence: count > 0 ? totals.confidence / count : 0,
      averageQuality: count > 0 ? totals.quality / count : 0,
      averageDuration: count > 0 ? totals.duration / count : 0,
      totalTasks: count,
    };
  }

  public getRecentPerformance(limit = 10): AgentResult[] {
    return this.performanceHistory.slice(-limit);
  }
}
