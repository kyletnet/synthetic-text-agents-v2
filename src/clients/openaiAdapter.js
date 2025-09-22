/**
 * P0 Hardened OpenAI Adapter
 * - Placeholder for OpenAI routing through single client layer
 * - Currently routes to Anthropic adapter (per P0 focus on Anthropic)
 * - Maintains interface compatibility for future OpenAI single client
 */

const { callAnthropicViaSingleClient } = require('./anthropicAdapter');

/**
 * Call OpenAI API (currently routed to Anthropic in P0)
 * @param {Object} params - API call parameters
 * @returns {Promise<Object>} Standardized response
 */
async function callOpenAI({ model = 'gpt-4o-mini', system = '', user = '', json = false }) {
  // For P0, route to Anthropic single client (maintains interface)
  console.warn('OpenAI calls routed to Anthropic in P0 hardening. Use ANTHROPIC_API_KEY.');

  // Map to Anthropic model
  const anthropicModel = mapOpenAIModelToAnthropic(model);

  const result = await callAnthropicViaSingleClient({
    model: anthropicModel,
    system,
    user,
    max_tokens: 1000
  });

  // Add provider override for compatibility
  return {
    ...result,
    provider: 'openai_via_anthropic',
    originalModel: model,
    mappedModel: anthropicModel
  };
}

/**
 * Map OpenAI model names to Anthropic equivalents
 * @param {string} openaiModel - OpenAI model name
 * @returns {string} Anthropic model name
 */
function mapOpenAIModelToAnthropic(openaiModel) {
  const modelMap = {
    'gpt-4o-mini': 'claude-3-haiku-20240307',
    'gpt-4o': 'claude-3-5-sonnet-20241022',
    'gpt-4': 'claude-3-5-sonnet-20241022',
    'gpt-3.5-turbo': 'claude-3-haiku-20240307'
  };

  return modelMap[openaiModel] || 'claude-3-5-sonnet-20241022';
}

/**
 * Get adapter status
 * @returns {Object} Status information
 */
function getStatus() {
  return {
    adapter: 'openai',
    note: 'Routed to Anthropic in P0 hardening',
    routedTo: 'anthropic',
    recommendation: 'Use callAnthropicViaSingleClient directly'
  };
}

module.exports = {
  callOpenAI,
  mapOpenAIModelToAnthropic,
  getStatus
};