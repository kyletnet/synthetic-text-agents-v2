import { BaseAgent } from "../core/baseAgent.js";
import { AgentContext } from "../shared/types.js";
import { Logger } from "../shared/logger.js";
import { LinguisticsEngineerService } from "../application/agents/linguistics-engineer-service.js";

// Import and re-export domain types
import type {
  LinguisticsAnalysisRequest,
  LLMOptimization,
  LinguisticsEngineerOutput,
} from "../domain/agents/linguistics-types.js";

export type {
  LinguisticsAnalysisRequest,
  LLMOptimization,
  LinguisticsEngineerOutput,
};

export class LinguisticsEngineer extends BaseAgent {
  private service: LinguisticsEngineerService;

  constructor(logger: Logger) {
    super(
      "linguistics-engineer",
      "llm_optimization_language_structure",
      [
        "llm-optimization",
        "language-quality",
        "prompt-engineering",
        "terminology-management",
      ],
      logger,
    );
    this.service = new LinguisticsEngineerService(logger);
  }

  protected async handle(
    content: unknown,
    _context?: AgentContext,
  ): Promise<LinguisticsEngineerOutput> {
    await this.validateInput(content);

    const request = this.parseRequest(content);

    // Delegate to service layer which orchestrates strategies
    return await this.service.analyze(request);
  }

  private parseRequest(content: unknown): LinguisticsAnalysisRequest {
    if (typeof content === "object" && content !== null) {
      const input = content as any;

      return {
        targetLLM: input.targetLLM || "claude",
        domain: input.domain || "general",
        complexityLevel: input.complexityLevel || 5,
        qualityTarget: input.qualityTarget || 8,
        outputFormat: input.outputFormat || "qa-pairs",
        existingPrompt: input.existingPrompt,
        terminologyRequirements: input.terminologyRequirements || [],
      };
    }

    throw new Error("Invalid linguistics analysis request format");
  }

  protected async assessConfidence(result: unknown): Promise<number> {
    if (typeof result === "object" && result !== null) {
      const output = result as LinguisticsEngineerOutput;
      return this.service.assessConfidence(output);
    }
    return 0.75;
  }

  protected async explainReasoning(
    _input: unknown,
    output: unknown,
    _context?: AgentContext,
  ): Promise<string> {
    if (typeof output === "object" && output !== null) {
      const result = output as LinguisticsEngineerOutput;
      return this.service.explainReasoning(result);
    }
    return "Linguistics Engineer analysis completed";
  }
}
