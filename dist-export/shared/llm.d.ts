export type ChatResult = {
  text: string;
  usage?:
    | {
        input_tokens?: number;
        output_tokens?: number;
      }
    | undefined;
  model?: string | undefined;
  latency_ms?: number | undefined;
  status?: number | undefined;
};
export declare class LLM {
  private adapter;
  constructor();
  chatJSONOnly(userPrompt: string, systemPrompt?: string): Promise<ChatResult>;
}
//# sourceMappingURL=llm.d.ts.map
