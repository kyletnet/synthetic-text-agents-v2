import { BaseAgent } from "../core/baseAgent.js";
import { AgentContext } from "../shared/types.js";
import { flag } from "../shared/env.js";
import { applyRulesToPrompt } from "../shared/rulesEngine.js";
import { Logger } from "../shared/logger.js";
import { LLM } from "../shared/llm.js";

type QAPair = {
  question: string;
  answer: string;
  confidence: number;
  domain: string;
};

export class QAGenerator extends BaseAgent {
  constructor() {
    super(
      "qa-generator",
      "QAGenerator",
      ["qa-generation", "llm-integration"],
      new Logger(),
    );
  }

  protected async handle(
    content: unknown,
    context?: AgentContext,
  ): Promise<unknown> {
    const req: any = content || {};
    const topic = req.topic || "general";
    const count = req.count || 5;

    const featureOn = flag("FEATURE_LLM_QA", true);
    const dryRun =
      flag("DRY_RUN", false) ||
      (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY);

    // Pull promptSpec if exists
    const promptSpec =
      (context?.sharedMemory?.["prompt-architect"] as any)?.result
        ?.promptSpec || null;

    let result: QAPair[] = [];
    let reasoning = "";
    let tokensUsed = 0;

    if (featureOn) {
      const basePrompt = `당신은 교육용 Q/A 데이터셋을 생성하는 전문가입니다.
- 주제: ${topic}
- 갯수: ${count}
- 출력만 JSON 배열로 반환하세요. 항목 스키마: { "question": string, "answer": string, "confidence": number, "domain": string }
- confidence는 0.0~1.0 사이 실수로 자기평가하세요. domain에는 주제를 채우세요.`;

      const withRules = promptSpec
        ? applyRulesToPrompt(basePrompt, promptSpec.rules)
        : basePrompt;

      if (!dryRun) {
        try {
          // Use Anthropic LLM via the unified adapter
          const llm = new LLM();
          const llmResponse = await llm.chatJSONOnly(withRules);

          if (llmResponse.text) {
            try {
              const parsed = JSON.parse(llmResponse.text);

              if (Array.isArray(parsed)) {
                result = parsed.slice(0, count);
                reasoning = `Anthropic LLM generated ${result.length} Q/A for ${topic}`;
                tokensUsed =
                  (llmResponse.usage?.input_tokens || 0) +
                  (llmResponse.usage?.output_tokens || 0);
              } else {
                // If LLM returns non-array, try to extract Q&A from the response
                this.logger.warn(
                  "LLM returned non-array, attempting to extract Q&A",
                );
                result = this.extractQAFromText(llmResponse.text, topic, count);
                reasoning = "Extracted Q&A from LLM text response";
              }
            } catch (parseError) {
              this.logger.warn(
                `JSON parsing failed: ${parseError}, attempting text extraction`,
              );
              result = this.extractQAFromText(
                llmResponse.text || "",
                topic,
                count,
              );
              reasoning = `Extracted Q&A from raw LLM response (parse error: ${parseError})`;
            }
          } else {
            throw new Error(
              "LLM returned empty response - check API configuration",
            );
          }
        } catch (error) {
          this.logger.error(`LLM call failed: ${error}`);
          throw error; // Don't fallback to mock in real mode
        }
      } else {
        // dry-run preview
        result = this.mock(topic, count);
        reasoning = "Dry-run preview (mock Q/A returned)";
      }
    } else {
      // Fallback: template generator
      result = this.mock(topic, count);
      reasoning = "Feature off — template-based Q/A generated";
    }

    // Return the result array with metadata
    const finalResult =
      result.length > 0
        ? result
        : [
            {
              question: `기본 질문: ${topic}에 대해 설명해주세요`,
              answer: `기본 답변: ${topic}는 중요한 주제입니다.`,
              confidence: 0.7,
              domain: topic,
            },
          ];

    return {
      result: finalResult,
      metadata: {
        reasoning,
        tokensUsed,
        generated: finalResult.length,
        topic,
        featureOn,
        dryRun,
      },
    };
  }

  private extractQAFromText(
    text: string,
    topic: string,
    count: number,
  ): QAPair[] {
    // Try to extract Q&A pairs from free-form text
    const lines = text.split("\n").filter((line) => line.trim());
    const pairs: QAPair[] = [];

    let currentQ = "";
    let currentA = "";

    for (const line of lines) {
      const trimmed = line.trim();

      // Look for question patterns
      if (trimmed.match(/^[QqAa][:.]?\s*\d*[:.)]?\s*/)) {
        if (trimmed.toLowerCase().startsWith("q") || trimmed.includes("?")) {
          // Save previous pair if exists
          if (currentQ && currentA) {
            pairs.push({
              question: currentQ.trim(),
              answer: currentA.trim(),
              confidence: 0.7,
              domain: topic,
            });
          }
          currentQ = trimmed.replace(/^[QqAa][:.]?\s*\d*[:.)]?\s*/, "");
          currentA = "";
        } else if (trimmed.toLowerCase().startsWith("a")) {
          currentA = trimmed.replace(/^[QqAa][:.]?\s*\d*[:.)]?\s*/, "");
        }
      } else if (currentQ && !currentA) {
        // Continue question
        currentQ += " " + trimmed;
      } else if (currentQ && currentA) {
        // Continue answer
        currentA += " " + trimmed;
      }
    }

    // Add final pair
    if (currentQ && currentA) {
      pairs.push({
        question: currentQ.trim(),
        answer: currentA.trim(),
        confidence: 0.7,
        domain: topic,
      });
    }

    // If extraction failed, generate at least one meaningful pair from the text
    if (pairs.length === 0 && text.length > 0) {
      pairs.push({
        question: `${topic}에 대해 설명해주세요.`,
        answer:
          text.substring(0, 500).trim() + (text.length > 500 ? "..." : ""),
        confidence: 0.6,
        domain: topic,
      });
    }

    return pairs.slice(0, count);
  }

  private mock(topic: string, count: number): QAPair[] {
    // Only used in dry-run mode
    const arr: QAPair[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        question: `[DRY-RUN] ${topic}에 대해 알아야 할 점은 무엇인가요? (${i + 1})`,
        answer: `[DRY-RUN] 실제 API 키를 설정하면 진짜 AI가 ${topic}에 대한 상세한 답변을 생성합니다.`,
        confidence: 0.5,
        domain: "dry-run",
      });
    }
    return arr;
  }
}
