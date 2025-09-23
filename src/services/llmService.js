/**
 * P0 Hardened LLM Service
 * - Routes all API calls through single client adapters
 * - No direct HTTP calls (fetch/axios/curl) - uses adapter layer
 * - Maintains compatibility while enforcing single client policy
 */

const { callAnthropicViaSingleClient } = require("../clients/anthropicAdapter");
const { callOpenAI } = require("../clients/openaiAdapter");

const PROVIDER = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
const RETRIES = Number(process.env.LLM_RETRIES || 2);

async function withRetry(fn, retries = RETRIES) {
  try {
    return await fn();
  } catch (e) {
    if (retries <= 0) throw e;
    await new Promise((r) => setTimeout(r, 500 * (RETRIES - retries + 1)));
    return withRetry(fn, retries - 1);
  }
}

async function callLLM({ system, user, json = false, provider = PROVIDER }) {
  return withRetry(() =>
    provider === "openai"
      ? callOpenAI({ system, user, json })
      : callAnthropicViaSingleClient({ system, user, max_tokens: 1000 }),
  );
}

module.exports = { callLLM };
