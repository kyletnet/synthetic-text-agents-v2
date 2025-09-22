#!/usr/bin/env bash
set -Eeuo pipefail

# 환경변수 로딩 및 API 키 검증 (중앙화된 로더)
# 사용법: source tools/load_env.sh 또는 . tools/load_env.sh

load_anthropic_env() {
  local env_loaded=false

  # .env.local 우선, .env 후순위로 로드 (둘 다 로드해서 .env.local이 override)
  if [[ -f .env ]]; then
    set -a; source .env; set +a
    env_loaded=true
    echo "[ENV] Loaded .env"
  fi

  if [[ -f .env.local ]]; then
    set -a; source .env.local; set +a
    env_loaded=true
    echo "[ENV] Loaded .env.local (override)"
  fi

  if [[ "$env_loaded" == "false" ]]; then
    echo "[WARN] No .env or .env.local found"
    return 1
  fi

  # ANTHROPIC_API_KEYS가 있으면 첫 번째 키를 ANTHROPIC_API_KEY로 동기화 (역호환)
  if [[ -n "${ANTHROPIC_API_KEYS:-}" ]]; then
    local first_key
    first_key=$(echo "$ANTHROPIC_API_KEYS" | cut -d',' -f1 | xargs)
    export ANTHROPIC_API_KEY="$first_key"

    # 키 마스킹 출력 (앞 4자리만 표시)
    local masked_key="${first_key:0:4}****"
    echo "[ENV] ANTHROPIC_API_KEY set from ANTHROPIC_API_KEYS: $masked_key"
  elif [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    local masked_key="${ANTHROPIC_API_KEY:0:4}****"
    echo "[ENV] ANTHROPIC_API_KEY loaded: $masked_key"
  fi

  return 0
}

# 직접 실행된 경우 자동 로드
if [[ "${BASH_SOURCE[0]:-}" == "${0:-}" ]]; then
  load_anthropic_env
else
  # sourced된 경우 함수만 정의
  true
fi