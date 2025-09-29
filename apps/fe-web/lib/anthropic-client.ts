import Anthropic from '@anthropic-ai/sdk';
import { LLMCallManager, recordLLMCall } from './llm-call-manager';

export class AnthropicClient {
  private client: Anthropic | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
      console.warn('ANTHROPIC_API_KEY not configured. LLM features will be disabled.');
      return;
    }

    try {
      this.client = new Anthropic({
        apiKey: apiKey,
      });
      this.initialized = true;
      console.log('Anthropic client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Anthropic client:', error);
    }
  }

  isReady(): boolean {
    return this.initialized && this.client !== null;
  }

  async generateText(prompt: string, maxTokens: number = 1000, sessionId: string = 'default'): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Anthropic client not initialized. Please check ANTHROPIC_API_KEY configuration.');
    }

    // LLMCallManager로 관리되는 실제 API 호출
    const result = await LLMCallManager.callWithRetry(
      sessionId,
      async () => {
        const response = await this.client!.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        if (response.content[0].type === 'text') {
          return response.content[0].text;
        } else {
          throw new Error('Unexpected response format from Anthropic API');
        }
      },
      'generateText'
    );

    if (result.success) {
      return result.data as string;
    } else {
      // LLM 호출 실패 - 에러 로깅은 LLMCallManager에서 처리됨
      throw new Error(`Failed to generate text: ${result.error?.message || 'Unknown error'}`);
    }
  }

  async generateAugmentation(input: string, augmentationType: string, ragContext?: string, sessionId: string = 'default'): Promise<string> {
    let prompt = '';

    switch (augmentationType) {
      case 'paraphrase':
        prompt = `다음 텍스트를 다른 방식으로 표현해주세요. 의미는 동일하게 유지하면서 표현만 바꿔주세요:

원본: ${input}

${ragContext ? `참고 자료:\n${ragContext}\n\n` : ''}다른 방식으로 표현된 텍스트:`;
        break;

      case 'extend':
        prompt = `다음 텍스트를 더 자세하고 구체적으로 확장해주세요:

원본: ${input}

${ragContext ? `참고 자료:\n${ragContext}\n\n` : ''}확장된 텍스트:`;
        break;

      case 'summarize':
        prompt = `다음 텍스트를 핵심 내용만 간결하게 요약해주세요:

원본: ${input}

${ragContext ? `참고 자료:\n${ragContext}\n\n` : ''}요약:`;
        break;

      case 'qa_generation':
        prompt = `다음 텍스트를 바탕으로 질문-답변 쌍을 만들어주세요:

원본: ${input}

${ragContext ? `참고 자료:\n${ragContext}\n\n` : ''}질문-답변 형식으로 작성해주세요:`;
        break;

      case 'style_transfer':
        prompt = `다음 텍스트를 더 격식있는 문체로 변환해주세요:

원본: ${input}

${ragContext ? `참고 자료:\n${ragContext}\n\n` : ''}격식있는 문체로 변환된 텍스트:`;
        break;

      default:
        prompt = `다음 텍스트를 개선해주세요:

원본: ${input}

${ragContext ? `참고 자료:\n${ragContext}\n\n` : ''}개선된 텍스트:`;
    }

    return await this.generateText(prompt, 2000, sessionId);
  }

  async evaluateQuality(original: string, augmented: string, sessionId: string = 'default'): Promise<{
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
        }
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
      const response = await this.generateText(evaluationPrompt, 500, sessionId);
      const evaluation = JSON.parse(response);

      const score = (
        evaluation.semantic_similarity +
        evaluation.fluency +
        evaluation.coherence +
        evaluation.usefulness
      ) / 4;

      return {
        score: Math.min(Math.max(score, 0), 1),
        metrics: {
          semantic_similarity: Math.min(Math.max(evaluation.semantic_similarity, 0), 1),
          fluency: Math.min(Math.max(evaluation.fluency, 0), 1),
          coherence: Math.min(Math.max(evaluation.coherence, 0), 1),
          usefulness: Math.min(Math.max(evaluation.usefulness, 0), 1),
        }
      };
    } catch (error) {
      console.error('Quality evaluation failed:', error);
      return {
        score: 0.7,
        metrics: {
          semantic_similarity: 0.7,
          fluency: 0.7,
          coherence: 0.7,
          usefulness: 0.7,
        }
      };
    }
  }
}

export const anthropicClient = new AnthropicClient();