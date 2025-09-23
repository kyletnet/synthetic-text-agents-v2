// Use the unified anthropic adapter instead of direct SDK calls
import { LLMAdapter } from "../clients/anthropicAdapter.js";
// Export the LLM class that uses the adapter internally
export class LLM {
  adapter;
  constructor() {
    this.adapter = new LLMAdapter();
  }
  async chatJSONOnly(userPrompt, systemPrompt) {
    return this.adapter.chatJSONOnly(userPrompt, systemPrompt);
  }
}
//# sourceMappingURL=llm.js.map
