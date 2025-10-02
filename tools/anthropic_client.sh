#!/usr/bin/env bash
set -Eeuo pipefail

# P0 Hardened Single API Client Layer v3
# - All Anthropic API calls must go through this layer
# - Offline/mock mode support
# - Rate limiting, retries, and error classification
# - Comprehensive logging and telemetry
# - Budget tracking and enforcement

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Standard logging - CRITICAL: All logs go to stderr to avoid polluting JSON stdout
step() { printf "\033[36m[STEP]\033[0m %s\n" "$*" >&2; }
ok()   { printf "\033[32m[OK]\033[0m %s\n" "$*" >&2; }
warn() { printf "\033[33m[WARN]\033[0m %s\n" "$*" >&2; }
fail() { printf "\033[31m[FAIL]\033[0m %s\n" "$*" >&2; }

# Default configuration
DEFAULT_TIMEOUT_MS=180000
DEFAULT_MAX_RETRIES=3
DEFAULT_RATE_QPS=1
DEFAULT_COST_CAP_USD=5.0
DEFAULT_MODEL="claude-3-5-sonnet-20241022"

# Global counters for session tracking
TOTAL_REQUESTS=0
TOTAL_COST_USD=0.00
TOTAL_TOKENS=0

# Mock responses for offline mode
generate_mock_response() {
  local model="$1"
  local prompt_length="$2"
  local mock_type="${3:-success}"

  local mock_id="mock_$(date +%s)_$(( RANDOM % 10000 ))"
  local mock_tokens=$(( prompt_length / 4 + 50 + RANDOM % 100 ))

  case "$mock_type" in
    "success")
      cat <<EOF
{
  "id": "$mock_id",
  "type": "message",
  "role": "assistant",
  "model": "$model",
  "content": [
    {
      "type": "text",
      "text": "This is a mock response generated in offline mode. The system is functioning correctly without network connectivity. Original prompt had approximately $prompt_length characters."
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": $(( prompt_length / 4 )),
    "output_tokens": $mock_tokens
  }
}
EOF
      ;;
    "error")
      cat <<EOF
{
  "type": "error",
  "error": {
    "type": "mock_error",
    "message": "Mock error for testing error handling in offline mode"
  }
}
EOF
      ;;
    "rate_limit")
      cat <<EOF
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "Mock rate limit error for testing backoff in offline mode"
  }
}
EOF
      ;;
  esac
}

# Calculate estimated cost based on model and token count
calculate_cost() {
  local model="$1"
  local input_tokens="$2"
  local output_tokens="$3"

  # Cost per 1K tokens (approximate rates as of 2024)
  local input_cost_per_1k output_cost_per_1k

  case "$model" in
    "claude-3-5-sonnet"*|"claude-3-sonnet"*)
      input_cost_per_1k=0.003
      output_cost_per_1k=0.015
      ;;
    "claude-3-haiku"*)
      input_cost_per_1k=0.00025
      output_cost_per_1k=0.00125
      ;;
    "claude-3-opus"*)
      input_cost_per_1k=0.015
      output_cost_per_1k=0.075
      ;;
    *)
      # Default to Sonnet pricing
      input_cost_per_1k=0.003
      output_cost_per_1k=0.015
      ;;
  esac

  local input_cost
  input_cost=$(awk "BEGIN {printf \"%.6f\", ($input_tokens / 1000) * $input_cost_per_1k}")
  local output_cost
  output_cost=$(awk "BEGIN {printf \"%.6f\", ($output_tokens / 1000) * $output_cost_per_1k}")
  local total_cost
  total_cost=$(awk "BEGIN {printf \"%.6f\", $input_cost + $output_cost}")

  echo "$total_cost"
}

# Exponential backoff with jitter
calculate_backoff() {
  local attempt="$1"
  local base_delay="${2:-1}"
  local max_delay="${3:-60}"

  local delay
  delay=$(awk "BEGIN {
    delay = $base_delay * (2 ^ ($attempt - 1))
    if (delay > $max_delay) delay = $max_delay
    jitter = delay * 0.1 * rand()
    printf \"%.2f\", delay + jitter
  }")

  echo "$delay"
}

# Comprehensive error classification
classify_error() {
  local http_code="$1"
  local response_body="$2"

  case "$http_code" in
    200|201)
      echo "success"
      ;;
    400)
      if echo "$response_body" | grep -q "invalid_request"; then
        echo "invalid_request"
      else
        echo "bad_request"
      fi
      ;;
    401)
      echo "authentication_failed"
      ;;
    403)
      echo "permission_denied"
      ;;
    404)
      echo "not_found"
      ;;
    429)
      if echo "$response_body" | grep -q "rate_limit"; then
        echo "rate_limit"
      else
        echo "quota_exceeded"
      fi
      ;;
    500|502|503|504)
      echo "server_error"
      ;;
    *)
      echo "unknown_error"
      ;;
  esac
}

# Rate limiting enforcement
enforce_rate_limit() {
  local rate_qps="${LLM_RATE_QPS:-$DEFAULT_RATE_QPS}"
  local min_interval
  min_interval=$(awk "BEGIN {printf \"%.3f\", 1.0 / $rate_qps}")

  # Track last request time
  local last_request_file="/tmp/anthropic_client_last_request"
  local current_time
  current_time=$(date +%s.%3N)

  if [[ -f "$last_request_file" ]]; then
    local last_request
    last_request=$(cat "$last_request_file")
    local elapsed
    elapsed=$(awk "BEGIN {printf \"%.3f\", $current_time - $last_request}")

    if awk "BEGIN {exit ($elapsed < $min_interval) ? 0 : 1}"; then
      local sleep_time
      sleep_time=$(awk "BEGIN {printf \"%.3f\", $min_interval - $elapsed}")
      step "Rate limiting: sleeping ${sleep_time}s (QPS: $rate_qps)"
      sleep "$sleep_time"
    fi
  fi

  echo "$current_time" > "$last_request_file"
}

# Budget enforcement
check_budget() {
  local estimated_cost="$1"
  local cost_cap="${LLM_COST_CAP_USD:-$DEFAULT_COST_CAP_USD}"

  local projected_total
  projected_total=$(awk "BEGIN {printf \"%.6f\", $TOTAL_COST_USD + $estimated_cost}")

  if awk "BEGIN {exit ($projected_total > $cost_cap) ? 0 : 1}"; then
    fail "BUDGET EXCEEDED: Projected cost \$$projected_total exceeds cap \$$cost_cap"
    echo "       Current session cost: \$$TOTAL_COST_USD"
    echo "       This request cost: \$$estimated_cost"
    echo "       Increase budget with: --budget <higher_amount>"
    return 1
  fi

  return 0
}

# Core API request with full P0 features
make_api_request() {
  local endpoint="$1"
  local payload="$2"
  local retry_count="${3:-0}"

  local api_key="${ANTHROPIC_API_KEY:-}"
  local timeout_ms="${LLM_TIMEOUT_MS:-$DEFAULT_TIMEOUT_MS}"
  local max_retries="${LLM_MAX_RETRIES:-$DEFAULT_MAX_RETRIES}"

  # Offline mode handling
  if [[ "${OFFLINE_MODE:-false}" == "true" ]] || [[ "${ANTHROPIC_ENDPOINT:-}" == "mock://localhost" ]]; then
    step "Offline mode: generating mock response"

    local prompt_length
    prompt_length=$(echo "$payload" | jq -r '.messages[0].content // ""' | wc -c)
    local model
    model=$(echo "$payload" | jq -r '.model // "claude-3-5-sonnet-20241022"')

    # Simulate processing delay
    sleep 0.5

    generate_mock_response "$model" "$prompt_length" "success"
    return 0
  fi

  # Validate required parameters
  if [[ -z "$api_key" ]]; then
    fail "ANTHROPIC_API_KEY not set"
    return 1
  fi

  if [[ "$api_key" == "mock-"* ]]; then
    fail "Mock API key detected in non-offline mode"
    return 1
  fi

  # Pre-request budget check (estimate based on input)
  local input_tokens
  input_tokens=$(echo "$payload" | jq -r '.messages[0].content // ""' | wc -w)
  input_tokens=$(( input_tokens * 4 / 3 ))  # Rough word-to-token conversion

  local estimated_cost
  estimated_cost=$(calculate_cost "$(echo "$payload" | jq -r '.model')" "$input_tokens" 150)

  if ! check_budget "$estimated_cost"; then
    return 1
  fi

  # Rate limiting
  enforce_rate_limit

  # Prepare request
  local curl_timeout
  curl_timeout=$(( timeout_ms / 1000 ))
  local request_id="req_$(date +%s)_$$"

  step "Making API request (attempt $((retry_count + 1))/$((max_retries + 1)))"

  # Make HTTP request
  local response_file="/tmp/anthropic_response_${request_id}"
  local http_code

  http_code=$(curl -w "%{http_code}" -o "$response_file" \
    --connect-timeout 30 \
    --max-time "$curl_timeout" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $api_key" \
    -H "anthropic-version: 2023-06-01" \
    -H "x-request-id: $request_id" \
    -d "$payload" \
    "https://api.anthropic.com/v1/messages" 2>/dev/null || echo "000")

  # Increment request counter
  ((TOTAL_REQUESTS++))

  # Error classification and handling
  local response_body
  response_body=$(cat "$response_file" 2>/dev/null || echo "{}")
  local error_type
  error_type=$(classify_error "$http_code" "$response_body")

  case "$error_type" in
    "success")
      ok "API request successful (HTTP $http_code)"

      # Extract and update usage statistics
      local input_tokens output_tokens
      input_tokens=$(echo "$response_body" | jq -r '.usage.input_tokens // 0')
      output_tokens=$(echo "$response_body" | jq -r '.usage.output_tokens // 0')

      if [[ "$input_tokens" != "0" ]] && [[ "$output_tokens" != "0" ]]; then
        local actual_cost
        actual_cost=$(calculate_cost "$(echo "$payload" | jq -r '.model')" "$input_tokens" "$output_tokens")
        TOTAL_COST_USD=$(awk "BEGIN {printf \"%.6f\", $TOTAL_COST_USD + $actual_cost}")
        TOTAL_TOKENS=$((TOTAL_TOKENS + input_tokens + output_tokens))

        ok "Usage: ${input_tokens}+${output_tokens} tokens, cost: \$$actual_cost"
      fi

      echo "$response_body"
      rm -f "$response_file"
      return 0
      ;;

    "rate_limit"|"server_error")
      if [[ $retry_count -lt $max_retries ]]; then
        local backoff_delay
        backoff_delay=$(calculate_backoff $((retry_count + 1)))

        warn "Transient error ($error_type), retrying in ${backoff_delay}s..."
        sleep "$backoff_delay"

        rm -f "$response_file"
        make_api_request "$endpoint" "$payload" $((retry_count + 1))
        return $?
      else
        fail "Max retries exceeded for $error_type"
        echo "$response_body"
        rm -f "$response_file"
        return 1
      fi
      ;;

    *)
      fail "API request failed: $error_type (HTTP $http_code)"
      echo "$response_body"
      rm -f "$response_file"
      return 1
      ;;
  esac
}

# High-level message sending interface
send_message() {
  local model="$1"
  local system_prompt="$2"
  local user_message="$3"
  local max_tokens="${4:-1000}"

  # Construct payload
  local payload
  payload=$(jq -n \
    --arg model "$model" \
    --arg system "$system_prompt" \
    --arg user "$user_message" \
    --argjson max_tokens "$max_tokens" \
    '{
      model: $model,
      max_tokens: $max_tokens,
      messages: [
        {role: "user", content: $user}
      ]
    } + (if $system != "" then {system: $system} else {} end)')

  make_api_request "messages" "$payload"
}

# Smoke test interface
smoke_test() {
  step "Running Anthropic API smoke test"

  local model="${LLM_MODEL:-$DEFAULT_MODEL}"
  local test_message="Hello, please respond with 'API connection successful' to confirm the smoke test."

  if send_message "$model" "" "$test_message" 50; then
    ok "Smoke test passed"
    return 0
  else
    fail "Smoke test failed"
    return 1
  fi
}

# Session statistics
print_session_stats() {
  echo
  echo "=== API Client Session Statistics ==="
  echo "Total requests: $TOTAL_REQUESTS"
  echo "Total cost: \$$TOTAL_COST_USD"
  echo "Total tokens: $TOTAL_TOKENS"
  echo "Average cost per request: \$$(awk "BEGIN {printf \"%.6f\", $TOTAL_COST_USD / ($TOTAL_REQUESTS == 0 ? 1 : $TOTAL_REQUESTS)}")"
  echo "Cost cap: \$${LLM_COST_CAP_USD:-$DEFAULT_COST_CAP_USD}"
  echo "Remaining budget: \$$(awk "BEGIN {printf \"%.6f\", ${LLM_COST_CAP_USD:-$DEFAULT_COST_CAP_USD} - $TOTAL_COST_USD}")"
  echo "======================================"
}

# CLI interface
show_usage() {
  echo "P0 Hardened Anthropic API Client v3"
  echo "Usage: $0 [command] [options]"
  echo
  echo "Commands:"
  echo "  --smoke               Run smoke test"
  echo "  --message             Send a message (requires --text)"
  echo "  --chat                Send a chat message (JSON payload via stdin)"
  echo "  --stats               Show session statistics"
  echo
  echo "Options:"
  echo "  --model <model>       Specify model (default: $DEFAULT_MODEL)"
  echo "  --text <message>      Message text for --message command"
  echo "  --system <prompt>     System prompt for --message command"
  echo "  --max-tokens <n>      Max tokens for response (default: 1000)"
  echo "  --offline             Use offline/mock mode"
  echo
  echo "Environment Variables:"
  echo "  ANTHROPIC_API_KEY     API key (required unless --offline)"
  echo "  LLM_MODEL            Default model"
  echo "  LLM_TIMEOUT_MS       Request timeout in milliseconds"
  echo "  LLM_MAX_RETRIES      Maximum retry attempts"
  echo "  LLM_RATE_QPS         Rate limit in queries per second"
  echo "  LLM_COST_CAP_USD     Maximum session cost"
  echo "  OFFLINE_MODE         Enable offline mode (true/false)"
  echo
  echo "Examples:"
  echo "  $0 --smoke"
  echo "  $0 --message --text 'Hello, world!'"
  echo "  $0 --message --text 'Analyze this' --system 'You are a data analyst'"
  echo "  $0 --smoke --offline"
}

# Main execution logic
main() {
  local command=""
  local message_text=""
  local system_prompt=""
  local model="${LLM_MODEL:-$DEFAULT_MODEL}"
  local max_tokens=1000

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --smoke)
        command="smoke"
        ;;
      --message)
        command="message"
        ;;
      --chat)
        command="chat"
        ;;
      --stats)
        command="stats"
        ;;
      --text)
        if [[ $# -lt 2 ]]; then
          fail "--text requires a value"
          return 1
        fi
        message_text="$2"
        shift
        ;;
      --system)
        if [[ $# -lt 2 ]]; then
          fail "--system requires a value"
          return 1
        fi
        system_prompt="$2"
        shift
        ;;
      --model)
        if [[ $# -lt 2 ]]; then
          fail "--model requires a value"
          return 1
        fi
        model="$2"
        shift
        ;;
      --max-tokens)
        if [[ $# -lt 2 ]]; then
          fail "--max-tokens requires a value"
          return 1
        fi
        max_tokens="$2"
        shift
        ;;
      --offline)
        export OFFLINE_MODE=true
        ;;
      --help|-h)
        show_usage
        return 0
        ;;
      *)
        fail "Unknown option: $1"
        show_usage
        return 1
        ;;
    esac
    shift
  done

  # Load environment if not already loaded
  if ! command -v load_anthropic_env >/dev/null 2>&1; then
    if [[ -f "$SCRIPT_DIR/load_env_v3.sh" ]]; then
      source "$SCRIPT_DIR/load_env_v3.sh"
    elif [[ -f "$SCRIPT_DIR/load_env.sh" ]]; then
      source "$SCRIPT_DIR/load_env.sh"
    else
      fail "Environment loader not found"
      return 1
    fi
  fi

  # Execute command
  case "$command" in
    "smoke")
      smoke_test
      ;;
    "message")
      if [[ -z "$message_text" ]]; then
        fail "--message command requires --text option"
        return 1
      fi
      send_message "$model" "$system_prompt" "$message_text" "$max_tokens"
      ;;
    "chat")
      # Read JSON payload from stdin and make API request
      local payload
      payload=$(cat)
      if [[ -z "$payload" ]]; then
        fail "--chat command requires JSON payload via stdin"
        return 1
      fi
      make_api_request "messages" "$payload"
      ;;
    "stats")
      print_session_stats
      ;;
    "")
      fail "No command specified"
      show_usage
      return 1
      ;;
    *)
      fail "Unknown command: $command"
      show_usage
      return 1
      ;;
  esac
}

# Export session statistics on exit
trap 'export ANTHROPIC_CLIENT_TOTAL_COST=$TOTAL_COST_USD; export ANTHROPIC_CLIENT_TOTAL_TOKENS=$TOTAL_TOKENS; export ANTHROPIC_CLIENT_TOTAL_REQUESTS=$TOTAL_REQUESTS' EXIT

# Execute if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi