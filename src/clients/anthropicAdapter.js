/**
 * P0 Hardened Anthropic Adapter
 * - Routes all API calls through the single API client layer (tools/anthropic_client.sh)
 * - Enforces DRY_RUN, budget, offline mode, and retry policies
 * - Provides Node.js interface for the unified launcher system
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

// Configuration from environment
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 180000);
const DRY_RUN = process.env.DRY_RUN === 'true';
const OFFLINE_MODE = process.env.OFFLINE_MODE === 'true';
const BUDGET_USD = Number(process.env.BUDGET_USD || 5.0);

/**
 * Execute API call through the single API client layer
 * @param {Object} params - API call parameters
 * @param {string} params.model - Model name
 * @param {string} params.system - System prompt
 * @param {string} params.user - User message
 * @param {number} params.max_tokens - Maximum tokens
 * @returns {Promise<Object>} Standardized response
 */
async function callAnthropicViaSingleClient({ model = 'claude-3-5-sonnet-20241022', system = '', user = '', max_tokens = 1000 }) {
  const scriptPath = path.resolve(__dirname, '../../tools/anthropic_client.sh');

  // Check if single API client exists
  if (!require('fs').existsSync(scriptPath)) {
    throw new Error(`Single API client not found: ${scriptPath}`);
  }

  const started = Date.now();

  try {
    // Build command arguments
    const args = [
      '--message',
      '--text', user,
      '--model', model,
      '--max-tokens', max_tokens.toString()
    ];

    if (system) {
      args.push('--system', system);
    }

    if (OFFLINE_MODE) {
      args.push('--offline');
    }

    // Execute single API client
    const env = {
      ...process.env,
      DRY_RUN: DRY_RUN.toString(),
      OFFLINE_MODE: OFFLINE_MODE.toString(),
      BUDGET_USD: BUDGET_USD.toString(),
      LLM_TIMEOUT_MS: TIMEOUT_MS.toString()
    };

    const result = execSync(`bash "${scriptPath}" ${args.join(' ')}`, {
      env,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024 // 1MB buffer
    });

    // Parse the JSON response from the single API client
    const response = JSON.parse(result.trim());

    // Extract text content
    const text = response.content?.[0]?.text || '';
    const usage = response.usage || null;
    const latencyMs = Date.now() - started;

    // Standardize usage format
    const normUsage = usage ? {
      prompt_tokens: usage.input_tokens || 0,
      completion_tokens: usage.output_tokens || 0
    } : null;

    // Calculate cost (simplified - actual calculation in single client)
    const cost = calculateCost(normUsage);

    return {
      text,
      usage: normUsage,
      model: response.model || model,
      provider: 'anthropic',
      latencyMs,
      cost,
      ok: true,
      source: 'single_api_client'
    };

  } catch (error) {
    const latencyMs = Date.now() - started;

    // Handle different error types
    let errorType = 'unknown_error';
    let errorMessage = error.message;

    if (error.message.includes('timeout')) {
      errorType = 'timeout';
    } else if (error.message.includes('BUDGET EXCEEDED')) {
      errorType = 'budget_exceeded';
    } else if (error.message.includes('401')) {
      errorType = 'authentication_failed';
    } else if (error.message.includes('429')) {
      errorType = 'rate_limit';
    }

    return {
      text: '',
      usage: null,
      model,
      provider: 'anthropic',
      latencyMs,
      cost: { inTok: 0, outTok: 0, cost: 0 },
      ok: false,
      error: errorType,
      errorMessage,
      source: 'single_api_client'
    };
  }
}

/**
 * Calculate estimated cost based on token usage
 * @param {Object} usage - Token usage
 * @returns {Object} Cost breakdown
 */
function calculateCost(usage) {
  if (!usage) {
    return { inTok: 0, outTok: 0, cost: 0 };
  }

  const inTok = usage.prompt_tokens || 0;
  const outTok = usage.completion_tokens || 0;

  // Anthropic Claude-3.5-Sonnet pricing (approximate)
  const PRICE_IN = 0.003;   // per 1K input tokens
  const PRICE_OUT = 0.015;  // per 1K output tokens

  const cost = (inTok / 1000) * PRICE_IN + (outTok / 1000) * PRICE_OUT;

  return {
    inTok,
    outTok,
    cost: Number(cost.toFixed(6))
  };
}

/**
 * Test connection to single API client (smoke test)
 * @returns {Promise<boolean>} Success status
 */
async function smokeTest() {
  try {
    const result = await callAnthropicViaSingleClient({
      model: 'claude-3-5-sonnet-20241022',
      user: 'Hello, please respond with "API connection successful" to confirm the smoke test.',
      max_tokens: 50
    });

    return result.ok && result.text.includes('API connection successful');
  } catch (error) {
    console.error('Anthropic adapter smoke test failed:', error.message);
    return false;
  }
}

/**
 * Get adapter status and configuration
 * @returns {Object} Status information
 */
function getStatus() {
  const scriptPath = path.resolve(__dirname, '../../tools/anthropic_client.sh');
  const clientExists = require('fs').existsSync(scriptPath);

  return {
    adapter: 'anthropic',
    singleClientPath: scriptPath,
    singleClientExists: clientExists,
    dryRun: DRY_RUN,
    offlineMode: OFFLINE_MODE,
    budgetUSD: BUDGET_USD,
    timeoutMs: TIMEOUT_MS,
    enforcedPolicies: [
      'single_api_client_routing',
      'budget_enforcement',
      'rate_limiting',
      'secret_masking',
      'offline_mode_support',
      'retry_with_backoff'
    ]
  };
}

module.exports = {
  callAnthropicViaSingleClient,
  calculateCost,
  smokeTest,
  getStatus
};