import { spawn } from 'child_process';
/**
 * TypeScript adapter for tools/anthropic_client.sh
 * Ensures all API calls go through the unified wrapper with:
 * - Budget tracking and enforcement
 * - Rate limiting and retry logic
 * - Secret masking and security
 * - Comprehensive logging and telemetry
 */
export class AnthropicAdapter {
    clientPath;
    constructor(clientPath = './tools/anthropic_client.sh') {
        this.clientPath = clientPath;
    }
    /**
     * Call Anthropic API via the tools/anthropic_client.sh wrapper
     */
    async callAnthropic(payload, opts = {}) {
        const startTime = Date.now();
        const runId = opts.runId || process.env.RUN_ID || 'unknown';
        const itemId = opts.itemId || 'unknown';
        const agentRole = opts.agentRole || 'unknown';
        try {
            // Prepare the payload for the wrapper script
            const wrapperPayload = this.preparePayload(payload);
            // Set environment variables for the wrapper
            const env = {
                ...process.env,
                LLM_TIMEOUT_MS: (opts.timeoutMs || 180000).toString(),
                RUN_ID: runId,
                ITEM_ID: itemId,
                AGENT_ROLE: agentRole,
            };
            if (opts.budgetCents) {
                env.LLM_COST_CAP_USD = (opts.budgetCents / 100).toString();
            }
            // Execute the wrapper script
            const result = await this.executeWrapper(wrapperPayload, env);
            const latencyMs = Date.now() - startTime;
            // Parse and classify the response
            if (result.exitCode === 0) {
                try {
                    const response = JSON.parse(result.stdout);
                    // Extract cost information from usage
                    const cost = this.calculateCost(response, payload.model);
                    // Log structured telemetry
                    this.logTelemetry({
                        runId,
                        itemId,
                        agentRole,
                        cost,
                        latencyMs,
                        retries: 0, // Wrapper handles retries internally
                        success: true,
                    });
                    return {
                        success: true,
                        data: response,
                        cost,
                        latencyMs,
                        retries: 0,
                    };
                }
                catch (parseError) {
                    return {
                        success: false,
                        error: {
                            type: 'error',
                            error: {
                                type: 'parse_error',
                                message: `Failed to parse response: ${parseError}`,
                            },
                        },
                        errorClass: 'PERMANENT',
                        latencyMs,
                    };
                }
            }
            else {
                // Handle error responses
                const errorClass = this.classifyError(result.exitCode, result.stderr);
                let errorResponse;
                try {
                    errorResponse = JSON.parse(result.stdout || result.stderr);
                }
                catch {
                    errorResponse = {
                        type: 'error',
                        error: {
                            type: 'wrapper_error',
                            message: result.stderr || 'Unknown error from wrapper script',
                        },
                    };
                }
                // Log error telemetry
                this.logTelemetry({
                    runId,
                    itemId,
                    agentRole,
                    cost: 0,
                    latencyMs,
                    retries: 0,
                    success: false,
                    errorClass,
                    errorMessage: errorResponse.error.message,
                });
                return {
                    success: false,
                    error: errorResponse,
                    errorClass,
                    latencyMs,
                };
            }
        }
        catch (executionError) {
            const latencyMs = Date.now() - startTime;
            // Log execution error telemetry
            this.logTelemetry({
                runId,
                itemId,
                agentRole,
                cost: 0,
                latencyMs,
                retries: 0,
                success: false,
                errorClass: 'PERMANENT',
                errorMessage: String(executionError),
            });
            return {
                success: false,
                error: {
                    type: 'error',
                    error: {
                        type: 'execution_error',
                        message: String(executionError),
                    },
                },
                errorClass: 'PERMANENT',
                latencyMs,
            };
        }
    }
    preparePayload(payload) {
        // Convert to the format expected by tools/anthropic_client.sh
        const wrapperPayload = {
            model: payload.model || 'claude-3-5-sonnet-20241022',
            max_tokens: payload.max_tokens || 1000,
            messages: payload.messages,
            temperature: payload.temperature,
        };
        if (payload.system) {
            wrapperPayload['system'] = payload.system;
        }
        return JSON.stringify(wrapperPayload);
    }
    async executeWrapper(payload, env) {
        return new Promise((resolve) => {
            const child = spawn('bash', [this.clientPath, '--chat'], {
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            child.on('close', (exitCode) => {
                resolve({
                    exitCode: exitCode || 0,
                    stdout,
                    stderr,
                });
            });
            // Send payload via stdin
            child.stdin.write(payload);
            child.stdin.end();
        });
    }
    classifyError(exitCode, stderr) {
        // Map exit codes to error classifications
        if (exitCode === 1) {
            if (stderr.includes('BUDGET EXCEEDED') || stderr.includes('POLICY VIOLATION')) {
                return 'POLICY';
            }
            if (stderr.includes('rate_limit') || stderr.includes('server_error')) {
                return 'TRANSIENT';
            }
        }
        if (exitCode === 2) {
            return 'PERMANENT'; // Authentication, configuration errors
        }
        return 'PERMANENT'; // Default to permanent for unknown errors
    }
    calculateCost(response, model) {
        if (!response.usage)
            return 0;
        const { input_tokens, output_tokens } = response.usage;
        // Cost per 1K tokens (approximate rates as of 2024)
        let inputCostPer1k = 0.003; // Default to Sonnet pricing
        let outputCostPer1k = 0.015;
        const modelName = model || response.model || '';
        if (modelName.includes('haiku')) {
            inputCostPer1k = 0.00025;
            outputCostPer1k = 0.00125;
        }
        else if (modelName.includes('opus')) {
            inputCostPer1k = 0.015;
            outputCostPer1k = 0.075;
        }
        const inputCost = (input_tokens / 1000) * inputCostPer1k;
        const outputCost = (output_tokens / 1000) * outputCostPer1k;
        return Number((inputCost + outputCost).toFixed(6));
    }
    logTelemetry(data) {
        // Emit structured logs compatible with existing logging infrastructure
        const logEntry = {
            timestamp: new Date().toISOString(),
            component: 'anthropic_adapter',
            run_id: data.runId,
            item_id: data.itemId,
            agent_role: data.agentRole,
            cost_usd: data.cost,
            latency_ms: data.latencyMs,
            retries: data.retries,
            success: data.success,
            error_class: data.errorClass,
            error_message: data.errorMessage,
        };
        // Log to structured format (similar to existing RUN_LOGS pattern)
        console.log(`[ADAPTER_TELEMETRY] ${JSON.stringify(logEntry)}`);
    }
}
/**
 * Convenience function for simple chat calls
 */
export async function callAnthropic(payload, opts = {}) {
    const adapter = new AnthropicAdapter();
    return adapter.callAnthropic(payload, opts);
}
/**
 * Legacy compatibility: match the interface from src/shared/llm.ts
 */
export class LLMAdapter {
    adapter;
    constructor() {
        this.adapter = new AnthropicAdapter();
    }
    async chatJSONOnly(userPrompt, systemPrompt) {
        const policy = "반드시 유효한 JSON만 출력. 코드펜스/설명/추가텍스트 금지.";
        const finalSystemPrompt = systemPrompt ? `${systemPrompt}\n${policy}` : policy;
        const payload = {
            model: process.env.LLM_MODEL || 'claude-3-5-sonnet-latest',
            max_tokens: 800,
            system: finalSystemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        };
        // Implement retry logic similar to original
        const maxRetries = 3;
        const backoffs = [0, 250, 750];
        for (let i = 0; i < maxRetries; i++) {
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, backoffs[i]));
            }
            const result = await this.adapter.callAnthropic(payload);
            if (result.success && result.data) {
                const text = result.data.content.map(c => c.text || '').join('\n').trim();
                if (!text.startsWith('{')) {
                    if (i === maxRetries - 1) {
                        throw new Error('Non-JSON response after all retries');
                    }
                    continue; // Retry
                }
                return {
                    text,
                    usage: result.data.usage,
                    model: result.data.model,
                    latency_ms: result.latencyMs,
                    status: 200,
                };
            }
            else if (result.errorClass === 'TRANSIENT' && i < maxRetries - 1) {
                continue; // Retry transient errors
            }
            else {
                const errorMsg = result.error?.error.message || 'Unknown error';
                throw new Error(`LLM chat failed: ${errorMsg}`);
            }
        }
        throw new Error('LLM chat failed after all retries');
    }
}
//# sourceMappingURL=anthropic_adapter.js.map