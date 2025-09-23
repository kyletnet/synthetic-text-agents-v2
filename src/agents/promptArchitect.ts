import { BaseAgent } from "../core/baseAgent.js";
import { AgentContext } from "../shared/types.js";
import {
  inferRulesFromFeedback,
  mergeRules,
  rulesHumanSummary,
  type PromptSpec,
} from "../shared/rulesEngine.js";
import { Logger } from "../shared/logger.js";

export class PromptArchitect extends BaseAgent {
  constructor() {
    super(
      "prompt-architect",
      "PromptArchitect",
      ["prompt-engineering", "rules-generation"],
      new Logger(),
    );
  }

  protected async handle(
    content: unknown,
    context?: AgentContext,
  ): Promise<unknown> {
    const req: any = content || {};
    const topic = req.topic || "general";
    const shared = context?.sharedMemory || {};

    // Collect candidate rules from any prior feedback snapshots (optional future hook)
    const topicTerms: string[] =
      (shared["topic-terms"] as any)?.result?.terms || []; // stub
    const fbText: string =
      (shared["feedback-latest"] as any)?.result?.text || ""; // stub
    const inferred = inferRulesFromFeedback(fbText, topicTerms);

    // Base rules: initial 5-types (golden defaults)
    const base = [
      { type: "length_max_tokens", value: 12, reason: "초기 기본값" } as const,
      { type: "forbid_terms", value: [], reason: "초기 금지어 없음" } as const,
      {
        type: "tone_primary",
        value: "elementary",
        reason: "초기 기본값",
      } as const,
      {
        type: "vary_sentence_forms",
        value: true,
        reason: "초기 기본값",
      } as const,
      {
        type: "must_include_topic_terms",
        value: topicTerms.slice(0, 3),
        reason: "예제 키워드 사용",
      } as const,
    ] as any[];

    const rules = mergeRules(base as any, inferred as any);
    const promptSpec: PromptSpec = {
      topic,
      rules: rules as any,
      humanSummary: rulesHumanSummary(rules),
    };

    return {
      promptSpec,
      explain: `피드백을 규칙으로 변환하고 생성 프롬프트에 반영합니다: ${promptSpec.humanSummary}`,
    };
  }
}
