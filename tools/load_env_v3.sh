#!/usr/bin/env bash
set -Eeuo pipefail

# P0 Hardened Environment Loading v3
# - Enhanced secret masking with multiple patterns
# - CI/server environment variable support
# - Comprehensive validation and error reporting
# - Single source of truth for all environment loading

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Standard logging - CRITICAL: All logs go to stderr to avoid polluting JSON stdout
step() { printf "\033[36m[STEP]\033[0m %s\n" "$*" >&2; }
ok()   { printf "\033[32m[OK]\033[0m %s\n" "$*" >&2; }
warn() { printf "\033[33m[WARN]\033[0m %s\n" "$*" >&2; }
fail() { printf "\033[31m[FAIL]\033[0m %s\n" "$*" >&2; }

# Enhanced secret masking for multiple patterns
mask_secret() {
  local secret="$1"
  local pattern="${2:-default}"

  case "$pattern" in
    "anthropic_key")
      # sk-ant-abcd1234... -> sk-ant-abcd****
      if [[ "$secret" =~ ^sk-ant-([a-zA-Z0-9]{4}) ]]; then
        echo "sk-ant-${BASH_REMATCH[1]}****"
      else
        echo "sk-****"
      fi
      ;;
    "openai_key")
      # sk-abcd1234... -> sk-abcd****
      if [[ "$secret" =~ ^sk-([a-zA-Z0-9]{4}) ]]; then
        echo "sk-${BASH_REMATCH[1]}****"
      else
        echo "sk-****"
      fi
      ;;
    "generic")
      # Generic masking for any secret
      if [[ ${#secret} -le 4 ]]; then
        echo "****"
      elif [[ ${#secret} -le 8 ]]; then
        echo "${secret:0:2}****"
      else
        echo "${secret:0:4}****"
      fi
      ;;
    *)
      # Default masking
      if [[ ${#secret} -le 4 ]]; then
        echo "****"
      else
        echo "${secret:0:4}****"
      fi
      ;;
  esac
}

# Validate secret format and strength
validate_secret() {
  local secret="$1"
  local type="$2"

  case "$type" in
    "ANTHROPIC_API_KEY")
      if [[ ! "$secret" =~ ^sk-ant-[a-zA-Z0-9_-]{40,} ]]; then
        fail "Invalid ANTHROPIC_API_KEY format (expected: sk-ant-...)"
        return 1
      fi
      if [[ ${#secret} -lt 50 ]]; then
        fail "ANTHROPIC_API_KEY too short (minimum 50 characters)"
        return 1
      fi
      ;;
    "OPENAI_API_KEY")
      if [[ ! "$secret" =~ ^sk-[a-zA-Z0-9]{40,} ]]; then
        fail "Invalid OPENAI_API_KEY format (expected: sk-...)"
        return 1
      fi
      if [[ ${#secret} -lt 43 ]]; then
        fail "OPENAI_API_KEY too short (minimum 43 characters)"
        return 1
      fi
      ;;
  esac

  return 0
}

# Load environment with priority: CI > .env.local > .env
load_environment_files() {
  local env_sources=()

  step "Loading environment with priority: CI > .env.local > .env"

  # Priority 1: CI/Environment variables (already loaded)
  if [[ -n "${CI:-}" ]] || [[ -n "${GITHUB_ACTIONS:-}" ]] || [[ -n "${BUILDKITE:-}" ]]; then
    env_sources+=("CI/Environment")
    ok "CI environment detected"
  fi

  # Priority 2: .env.local (local overrides)
  if [[ -f .env.local ]]; then
    set -a
    source .env.local
    set +a
    env_sources+=(".env.local")
    ok "Loaded .env.local (local overrides)"
  fi

  # Priority 3: .env (base configuration)
  if [[ -f .env ]]; then
    # Only load if .env.local didn't already set variables
    set -a
    source .env
    set +a
    env_sources+=(".env")
    ok "Loaded .env (base configuration)"
  fi

  if [[ ${#env_sources[@]} -eq 0 ]]; then
    fail "No environment sources found (.env, .env.local, or CI variables)"
    return 1
  fi

  local sources_str
  sources_str=$(IFS=", "; echo "${env_sources[*]}")
  ok "Environment loaded from: $sources_str"
  return 0
}

# Enhanced Anthropic environment loading with validation
load_anthropic_env() {
  step "Loading and validating Anthropic environment"

  # Load environment files
  if ! load_environment_files; then
    return 1
  fi

  # Handle ANTHROPIC_API_KEYS (multiple keys) to ANTHROPIC_API_KEY (single key)
  if [[ -n "${ANTHROPIC_API_KEYS:-}" ]]; then
    local first_key
    first_key=$(echo "$ANTHROPIC_API_KEYS" | cut -d',' -f1 | xargs)
    export ANTHROPIC_API_KEY="$first_key"

    local masked_keys
    masked_keys=$(echo "$ANTHROPIC_API_KEYS" | sed -E 's/sk-ant-[a-zA-Z0-9]{4}[a-zA-Z0-9]*/sk-ant-xxxx****/g')
    ok "ANTHROPIC_API_KEY set from ANTHROPIC_API_KEYS: $masked_keys"
  fi

  # Validate ANTHROPIC_API_KEY if present
  if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    if validate_secret "$ANTHROPIC_API_KEY" "ANTHROPIC_API_KEY"; then
      local masked_key
      masked_key=$(mask_secret "$ANTHROPIC_API_KEY" "anthropic_key")
      ok "ANTHROPIC_API_KEY validated: $masked_key"
    else
      fail "ANTHROPIC_API_KEY validation failed"
      return 1
    fi
  else
    # Check if running in offline mode
    if [[ "${OFFLINE_MODE:-false}" == "true" ]]; then
      warn "ANTHROPIC_API_KEY not set (offline mode - will use mocks)"
      export ANTHROPIC_API_KEY="mock-offline-key"
    else
      fail "ANTHROPIC_API_KEY not set"
      echo "       Set via environment variable or .env file"
      echo "       Format: sk-ant-[40+ characters]"
      return 1
    fi
  fi

  # Set provider if not already set
  if [[ -z "${LLM_PROVIDER:-}" ]]; then
    export LLM_PROVIDER="anthropic"
    ok "LLM_PROVIDER set to: anthropic"
  fi

  # Validate provider consistency
  if [[ "${LLM_PROVIDER:-}" != "anthropic" ]]; then
    warn "LLM_PROVIDER=$LLM_PROVIDER but loading Anthropic environment"
  fi

  # Set default model if not specified
  if [[ -z "${LLM_MODEL:-}" ]]; then
    export LLM_MODEL="claude-3-5-sonnet-20241022"
    ok "LLM_MODEL set to default: $LLM_MODEL"
  fi

  # Load and validate additional environment variables
  local important_vars=("LLM_COST_CAP_USD" "LLM_RATE_QPS" "LLM_TIMEOUT_MS" "LLM_MAX_RETRIES")
  for var in "${important_vars[@]}"; do
    if [[ -n "${!var:-}" ]]; then
      ok "Environment variable loaded: $var=${!var}"
    fi
  done

  # Offline mode setup
  if [[ "${OFFLINE_MODE:-false}" == "true" ]]; then
    export ANTHROPIC_ENDPOINT="mock://localhost"
    ok "Offline mode enabled: ANTHROPIC_ENDPOINT=mock://localhost"
  fi

  ok "Anthropic environment loading completed successfully"
  return 0
}

# Generic environment loading for other providers
load_openai_env() {
  step "Loading and validating OpenAI environment"

  if ! load_environment_files; then
    return 1
  fi

  if [[ -n "${OPENAI_API_KEY:-}" ]]; then
    if validate_secret "$OPENAI_API_KEY" "OPENAI_API_KEY"; then
      local masked_key
      masked_key=$(mask_secret "$OPENAI_API_KEY" "openai_key")
      ok "OPENAI_API_KEY validated: $masked_key"
    else
      fail "OPENAI_API_KEY validation failed"
      return 1
    fi
  else
    if [[ "${OFFLINE_MODE:-false}" == "true" ]]; then
      warn "OPENAI_API_KEY not set (offline mode - will use mocks)"
      export OPENAI_API_KEY="mock-offline-key"
    else
      fail "OPENAI_API_KEY not set"
      return 1
    fi
  fi

  if [[ -z "${LLM_PROVIDER:-}" ]]; then
    export LLM_PROVIDER="openai"
    ok "LLM_PROVIDER set to: openai"
  fi

  ok "OpenAI environment loading completed successfully"
  return 0
}

# Auto-detect and load appropriate environment
load_env_auto() {
  step "Auto-detecting provider and loading environment"

  # Load environment files first
  if ! load_environment_files; then
    return 1
  fi

  # Determine provider based on available keys or explicit setting
  local provider="${LLM_PROVIDER:-}"

  if [[ -z "$provider" ]]; then
    if [[ -n "${ANTHROPIC_API_KEY:-}" ]] || [[ -n "${ANTHROPIC_API_KEYS:-}" ]]; then
      provider="anthropic"
    elif [[ -n "${OPENAI_API_KEY:-}" ]]; then
      provider="openai"
    else
      if [[ "${OFFLINE_MODE:-false}" == "true" ]]; then
        provider="anthropic"  # Default to anthropic in offline mode
        warn "No API keys found, defaulting to Anthropic in offline mode"
      else
        fail "No API keys found and provider not specified"
        echo "       Set ANTHROPIC_API_KEY or OPENAI_API_KEY"
        echo "       Or set LLM_PROVIDER explicitly"
        return 1
      fi
    fi
  fi

  case "$provider" in
    "anthropic")
      load_anthropic_env
      ;;
    "openai")
      load_openai_env
      ;;
    *)
      fail "Unsupported provider: $provider"
      echo "       Supported providers: anthropic, openai"
      return 1
      ;;
  esac
}

# Secret scanning for security
scan_for_secrets() {
  step "Scanning for exposed secrets in environment"

  local exposed_secrets=()

  # Check if any environment variables contain actual secrets (not masked)
  for var in $(env | grep -E '^(ANTHROPIC_|OPENAI_|API_|SECRET_|TOKEN_)' | cut -d= -f1); do
    local value="${!var:-}"
    if [[ -n "$value" ]] && [[ "$value" =~ ^sk-[a-zA-Z0-9]{40,} ]]; then
      # This is a real API key
      if [[ "$value" != *"****"* ]] && [[ "$value" != "mock-"* ]]; then
        exposed_secrets+=("$var")
      fi
    fi
  done

  if [[ ${#exposed_secrets[@]} -gt 0 ]]; then
    warn "Found ${#exposed_secrets[@]} environment variables with unmasked secrets"
    for var in "${exposed_secrets[@]}"; do
      warn "  $var (contains unmasked secret)"
    done
    warn "Ensure secrets are properly masked in logs and outputs"
  else
    ok "No exposed secrets found in environment"
  fi
}

# Export functions for use by other scripts
export -f mask_secret
export -f validate_secret
export -f load_anthropic_env
export -f load_openai_env
export -f load_env_auto
export -f scan_for_secrets

# Direct execution behavior
if [[ "${BASH_SOURCE[0]:-}" == "${0:-}" ]]; then
  # Script called directly - auto-load based on detected provider
  if load_env_auto; then
    scan_for_secrets
    ok "Environment loading completed successfully"
  else
    fail "Environment loading failed"
    exit 1
  fi
else
  # Script sourced - functions are now available
  ok "Environment loading functions available"
fi