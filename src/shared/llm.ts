// Use the unified anthropic adapter instead of direct SDK calls
import { LLMAdapter } from "../clients/anthropicAdapter.js";

export type ChatResult = {
  text: string;
  usage?: { input_tokens?: number; output_tokens?: number } | undefined;
  model?: string | undefined;
  latency_ms?: number | undefined;
  status?: number | undefined;
};

// Export the LLM class that uses the adapter internally
export class LLM {
  private adapter: LLMAdapter;

  constructor() {
    this.adapter = new LLMAdapter();
  }

  async chatJSONOnly(
    userPrompt: string,
    systemPrompt?: string,
  ): Promise<ChatResult> {
    return this.adapter.chatJSONOnly(userPrompt, systemPrompt);
  }
}
