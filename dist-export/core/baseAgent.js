import { randomUUID } from "crypto";
import { AgentResultSchema } from "../shared/types.js";
import { PerformanceGuardian } from "./performanceGuardian.js";
export class BaseAgent {
  id;
  specialization;
  tags;
  logger;
  performanceHistory = [];
  constructor(id, specialization, tags, logger) {
    this.id = id;
    this.specialization = specialization;
    this.tags = Object.freeze([...tags]);
    this.logger = logger;
  }
  async receive(content, context) {
    const start = Date.now();
    const taskId = randomUUID();
    await this.logger.trace({
      level: "info",
      agentId: this.id,
      action: "task_received",
      data: { taskId, contentType: typeof content },
    });
    try {
      const result = await this.handle(content, context);
      const duration = Date.now() - start;
      const agentResult = {
        agentId: this.id,
        result,
        confidence: await this.assessConfidence(result, context),
        reasoning: await this.explainReasoning(content, result, context),
        performance: {
          duration,
          tokensUsed: await this.estimateTokensUsed(content, result),
          qualityScore: await this.assessQuality(result, context),
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
  async assessConfidence(_result, _context) {
    return 0.8;
  }
  async explainReasoning(input, output, _context) {
    return `Agent ${this.id} processed ${typeof input} input and produced ${typeof output} output using ${this.specialization} expertise.`;
  }
  async estimateTokensUsed(input, output) {
    const inputStr = typeof input === "string" ? input : JSON.stringify(input);
    const outputStr =
      typeof output === "string" ? output : JSON.stringify(output);
    return Math.ceil((inputStr.length + outputStr.length) / 4);
  }
  async assessQuality(result, context) {
    const qualityTarget = context?.qualityTarget || 8;
    return Math.min(qualityTarget, 8.5);
  }
  async validateInput(input) {
    if (input === null || input === undefined) {
      throw new Error("Input cannot be null or undefined");
    }
  }
  getPerformanceMetrics() {
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
  getRecentPerformance(limit = 10) {
    return this.performanceHistory.slice(-limit);
  }
}
//# sourceMappingURL=baseAgent.js.map
