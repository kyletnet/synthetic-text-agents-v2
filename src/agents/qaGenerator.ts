import { BaseAgent } from '../core/baseAgent.js';
import { AgentMessage, AgentResult, AgentContext } from '../shared/types.js';
import { flag, str } from '../shared/env.js';
import { generateJSON } from '../shared/llmAdapter.js';
import { applyRulesToPrompt } from '../shared/rulesEngine.js';
import { Logger } from '../shared/logger.js';
import { LLM } from '../shared/llm.js';

type QAPair = { question: string; answer: string; confidence: number; domain: string };

export class QAGenerator extends BaseAgent {
  constructor() { 
    super('qa-generator', 'QAGenerator', ['qa-generation', 'llm-integration'], new Logger()); 
  }

  protected async handle(content: unknown, context?: AgentContext): Promise<unknown> {
    const req: any = content || {};
    const topic = req.topic || 'general';
    const count = req.count || 5;

    const featureOn = flag('FEATURE_LLM_QA', true);
    const dryRun = flag('DRY_RUN', false) || (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY);

    // Pull promptSpec if exists
    const promptSpec = (context?.sharedMemory?.['prompt-architect'] as any)?.result?.promptSpec || null;

    let result: QAPair[] = [];
    let reasoning = '';
    let tokensUsed = 0;

    if (featureOn) {
      const basePrompt = `당신은 교육용 Q/A 데이터셋을 생성하는 전문가입니다.
- 주제: ${topic}
- 갯수: ${count}
- 출력만 JSON 배열로 반환하세요. 항목 스키마: { "question": string, "answer": string, "confidence": number, "domain": string }
- confidence는 0.0~1.0 사이 실수로 자기평가하세요. domain에는 주제를 채우세요.`;

      const withRules = promptSpec ? applyRulesToPrompt(basePrompt, promptSpec.rules) : basePrompt;

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
                tokensUsed = (llmResponse.usage?.input_tokens || 0) + (llmResponse.usage?.output_tokens || 0);
              } else {
                result = this.mock(topic, count);
                reasoning = 'LLM returned non-array response, using mock data';
              }
            } catch (parseError) {
              result = this.mock(topic, count);
              reasoning = `JSON parsing failed (${parseError}), using mock data`;
            }
          } else {
            result = this.mock(topic, count);
            reasoning = 'LLM returned empty response, using mock data';
          }
        } catch (error) {
          result = this.mock(topic, count);
          reasoning = `LLM call failed (${error}), using mock data`;
        }
      } else {
        // dry-run preview
        result = this.mock(topic, count);
        reasoning = 'Dry-run preview (mock Q/A returned)';
      }
    } else {
      // Fallback: template generator
      result = this.mock(topic, count);
      reasoning = 'Feature off — template-based Q/A generated';
    }

    // Return the result array with metadata
    const finalResult = result.length > 0 ? result : [{
      question: `기본 질문: ${topic}에 대해 설명해주세요`,
      answer: `기본 답변: ${topic}는 중요한 주제입니다.`,
      confidence: 0.7,
      domain: topic
    }];

    return {
      result: finalResult,
      metadata: {
        reasoning,
        tokensUsed,
        generated: finalResult.length,
        topic,
        featureOn,
        dryRun
      }
    };
  }

  private mock(topic:string, count:number): QAPair[] {
    const arr: QAPair[] = [];
    for (let i=0;i<count;i++) {
      arr.push({
        question: `[MOCK] ${topic}에 대해 알아야 할 점은 무엇인가요? (${i+1})`,
        answer: `[MOCK] ${topic}의 핵심 개념과 예시를 쉬운 말로 설명합니다.`,
        confidence: 0.8 + (Math.random()*0.2),
        domain: topic
      });
    }
    return arr;
  }
}
