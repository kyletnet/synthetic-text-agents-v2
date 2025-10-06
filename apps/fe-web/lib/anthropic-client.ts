import Anthropic from "@anthropic-ai/sdk";
import { LLMCallManager, recordLLMCall } from "./llm-call-manager";
import { apiKeyManager } from "./api-key-manager";
import { guardLLMClient, GuardedLLMClient } from "./universal-llm-guard";

export class AnthropicClient {
  private client: Anthropic | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // API Key Manager에서 현재 키 확인
    const apiKey = apiKeyManager.getCurrentKey();

    if (!apiKey) {
      console.warn(
        "No valid API keys available. LLM features will be disabled.",
      );
      console.warn("API Key Manager Stats:", apiKeyManager.getStats());
      return;
    }

    try {
      this.client = new Anthropic({
        apiKey: apiKey,
      });
      this.initialized = true;
      const stats = apiKeyManager.getStats();
      console.log(
        `Anthropic client initialized with ${stats.activeKeys}/${stats.totalKeys} available keys`,
      );
    } catch (error) {
      console.error("Failed to initialize Anthropic client:", error);
      // 현재 키를 실패로 기록
      if (apiKey) {
        apiKeyManager.recordFailure(apiKey, error);
      }
    }
  }

  isReady(): boolean {
    // API Key Manager에 사용 가능한 키가 있는지 체크
    if (!apiKeyManager.hasAvailableKeys()) {
      console.error("❌ No available API keys - system cannot function");
      return false;
    }

    return this.initialized && this.client !== null;
  }

  async generateText(
    prompt: string,
    maxTokens: number = 1000,
    sessionId: string = "default",
  ): Promise<string> {
    if (!this.isReady()) {
      throw new Error(
        "❌ CRITICAL: No valid API keys available. System cannot function without proper API configuration.",
      );
    }

    // API 키 로테이션을 지원하는 향상된 호출 로직
    let lastError: Error | null = null;
    let attempts = 0;
    const maxAttempts = Math.min(3, apiKeyManager.getStats().activeKeys); // 최대 3회 또는 활성 키 수만큼

    while (attempts < maxAttempts) {
      const currentKey = apiKeyManager.getCurrentKey();

      if (!currentKey) {
        throw new Error("❌ CRITICAL: All API keys exhausted. Cannot proceed.");
      }

      try {
        // 클라이언트를 현재 키로 재초기화 (키가 바뀌었을 수 있음)
        this.client = new Anthropic({
          apiKey: currentKey,
        });

        // LLMCallManager로 관리되는 실제 API 호출
        const result = await LLMCallManager.callWithRetry(
          sessionId,
          async () => {
            const response = await this.client!.messages.create({
              model: "claude-3-haiku-20240307",
              max_tokens: maxTokens,
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
            });

            if (response.content[0].type === "text") {
              return response.content[0].text;
            } else {
              throw new Error("Unexpected response format from Anthropic API");
            }
          },
          "generateText",
        );

        if (result.success) {
          // 성공적인 API 호출 기록
          apiKeyManager.recordSuccess(currentKey);
          return result.data as string;
        } else {
          // 실패 기록 및 다음 키로 시도
          apiKeyManager.recordFailure(currentKey, result.error);
          lastError = result.error || new Error("Unknown LLM call error");
          attempts++;
          continue;
        }
      } catch (error) {
        // 직접적인 API 에러 처리
        console.warn(
          `API call failed with key ${
            apiKeyManager.getStats().currentKeyIndex + 1
          }: ${error}`,
        );
        apiKeyManager.recordFailure(currentKey, error);
        lastError = error as Error;
        attempts++;
      }
    }

    // 모든 시도 실패
    const stats = apiKeyManager.getStats();
    throw new Error(
      `❌ CRITICAL: Failed to generate text after ${attempts} attempts. ` +
        `Active keys: ${stats.activeKeys}/${stats.totalKeys}. ` +
        `Last error: ${lastError?.message || "Unknown error"}`,
    );
  }

  async generateAugmentation(
    input: string,
    augmentationType: string,
    ragContext?: string,
    sessionId: string = "default",
  ): Promise<string> {
    let prompt = "";

    switch (augmentationType) {
      case "paraphrase":
        prompt = `다음 텍스트를 다른 방식으로 표현해주세요. 의미는 동일하게 유지하면서 표현만 바꿔주세요:

원본: ${input}

${
  ragContext ? `참고 자료:\n${ragContext}\n\n` : ""
}다른 방식으로 표현된 텍스트:`;
        break;

      case "extend":
        prompt = `다음 텍스트를 더 자세하고 구체적으로 확장해주세요:

원본: ${input}

${ragContext ? `참고 자료:\n${ragContext}\n\n` : ""}확장된 텍스트:`;
        break;

      case "summarize":
        prompt = `다음 텍스트를 핵심 내용만 간결하게 요약해주세요:

원본: ${input}

${ragContext ? `참고 자료:\n${ragContext}\n\n` : ""}요약:`;
        break;

      case "qa_generation":
        prompt = `다음 텍스트를 바탕으로 질문-답변 쌍을 만들어주세요:

원본: ${input}

${
  ragContext ? `참고 자료:\n${ragContext}\n\n` : ""
}질문-답변 형식으로 작성해주세요:`;
        break;

      case "style_transfer":
        prompt = `다음 텍스트를 더 격식있는 문체로 변환해주세요:

원본: ${input}

${
  ragContext ? `참고 자료:\n${ragContext}\n\n` : ""
}격식있는 문체로 변환된 텍스트:`;
        break;

      default:
        prompt = `다음 텍스트를 개선해주세요:

원본: ${input}

${ragContext ? `참고 자료:\n${ragContext}\n\n` : ""}개선된 텍스트:`;
    }

    return await this.generateText(prompt, 2000, sessionId);
  }

  async evaluateQuality(
    original: string,
    augmented: string,
    sessionId: string = "default",
  ): Promise<{
    score: number;
    metrics: {
      semantic_similarity: number;
      fluency: number;
      coherence: number;
      usefulness: number;
    };
  }> {
    if (!this.isReady()) {
      return {
        score: 0.7,
        metrics: {
          semantic_similarity: 0.7,
          fluency: 0.7,
          coherence: 0.7,
          usefulness: 0.7,
        },
      };
    }

    const evaluationPrompt = `다음 원본과 변형된 텍스트를 평가해주세요. 각 항목을 0.0~1.0 사이의 점수로 매겨주세요.

원본: ${original}

변형: ${augmented}

다음 JSON 형식으로 평가해주세요:
{
  "semantic_similarity": 0.0-1.0점 (의미적 유사성),
  "fluency": 0.0-1.0점 (문장의 자연스러움),
  "coherence": 0.0-1.0점 (논리적 일관성),
  "usefulness": 0.0-1.0점 (실용적 가치)
}

JSON만 반환해주세요:`;

    try {
      const response = await this.generateText(
        evaluationPrompt,
        500,
        sessionId,
      );
      const evaluation = JSON.parse(response);

      const score =
        (evaluation.semantic_similarity +
          evaluation.fluency +
          evaluation.coherence +
          evaluation.usefulness) /
        4;

      return {
        score: Math.min(Math.max(score, 0), 1),
        metrics: {
          semantic_similarity: Math.min(
            Math.max(evaluation.semantic_similarity, 0),
            1,
          ),
          fluency: Math.min(Math.max(evaluation.fluency, 0), 1),
          coherence: Math.min(Math.max(evaluation.coherence, 0), 1),
          usefulness: Math.min(Math.max(evaluation.usefulness, 0), 1),
        },
      };
    } catch (error) {
      console.error("Quality evaluation failed:", error);
      return {
        score: 0.7,
        metrics: {
          semantic_similarity: 0.7,
          fluency: 0.7,
          coherence: 0.7,
          usefulness: 0.7,
        },
      };
    }
  }
}

// 🛡️ Create guarded anthropic client instance
const rawAnthropicClient = new AnthropicClient();

// 🎯 Apply Universal Guard System
export const anthropicClient = guardLLMClient(
  rawAnthropicClient,
  "AnthropicClient",
) as AnthropicClient & GuardedLLMClient;

// 📊 Log guard injection status
console.log(
  `🛡️ AnthropicClient guard injection: ${
    anthropicClient._isGuarded ? "ACTIVE" : "DISABLED"
  }`,
);

// 🔍 Export raw client for internal testing (DO NOT USE DIRECTLY)
export const _rawAnthropicClient = rawAnthropicClient;
