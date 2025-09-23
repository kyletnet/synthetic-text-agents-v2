export interface AnthropicChatPayload {
  model?: string;
  max_tokens?: number;
  system?: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
}
export interface AnthropicResponse {
  id: string;
  type: string;
  role?: string;
  model: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  stop_reason?: string;
  stop_sequence?: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}
export interface AnthropicError {
  type: "error";
  error: {
    type: string;
    message: string;
  };
}
export interface CallOptions {
  timeoutMs?: number;
  budgetCents?: number;
  runId?: string;
  itemId?: string;
  agentRole?: string;
}
export type ErrorClassification = "TRANSIENT" | "PERMANENT" | "POLICY";
export interface AdapterResult {
  success: boolean;
  data?: AnthropicResponse;
  error?: AnthropicError;
  errorClass?: ErrorClassification;
  cost?: number;
  latencyMs?: number;
  retries?: number;
}
/**
 * TypeScript adapter for tools/anthropic_client.sh
 * Ensures all API calls go through the unified wrapper with:
 * - Budget tracking and enforcement
 * - Rate limiting and retry logic
 * - Secret masking and security
 * - Comprehensive logging and telemetry
 */
export declare class AnthropicAdapter {
  private readonly clientPath;
  constructor(clientPath?: string);
  /**
   * Call Anthropic API via the tools/anthropic_client.sh wrapper
   */
  callAnthropic(
    payload: AnthropicChatPayload,
    opts?: CallOptions,
  ): Promise<AdapterResult>;
  private preparePayload;
  private executeWrapper;
  private classifyError;
  private calculateCost;
  private logTelemetry;
}
/**
 * Convenience function for simple chat calls
 */
export declare function callAnthropic(
  payload: AnthropicChatPayload,
  opts?: CallOptions,
): Promise<AdapterResult>;
/**
 * Legacy compatibility: match the interface from src/shared/llm.ts
 */
export declare class LLMAdapter {
  private adapter;
  constructor();
  chatJSONOnly(
    userPrompt: string,
    systemPrompt?: string,
  ): Promise<{
    text: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
    model?: string;
    latency_ms?: number;
    status?: number;
  }>;
}
//# sourceMappingURL=anthropic_adapter.d.ts.map
