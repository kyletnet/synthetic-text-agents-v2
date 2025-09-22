#!/usr/bin/env bash
set -Eeuo pipefail

# 환경 설정 검증 (실행 전 필수 체크)
# 사용법: ./tools/preflight.sh

preflight_check() {
  local errors=0

  echo "[PREFLIGHT] Starting environment validation..."

  # .env 파일 존재 확인
  if [[ ! -f .env ]] && [[ ! -f .env.local ]]; then
    echo "[FAIL] Neither .env nor .env.local found"
    echo "       Create .env from .env.example and set ANTHROPIC_API_KEY"
    ((errors++))
  else
    echo "[OK] Environment file found"
  fi

  # ANTHROPIC_API_KEY 검증
  if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    echo "[FAIL] ANTHROPIC_API_KEY not set"
    echo "       Set API key in .env file"
    ((errors++))
  else
    # 키 길이 검증 (최소 30자)
    local key_length=${#ANTHROPIC_API_KEY}
    if [[ $key_length -lt 30 ]]; then
      echo "[FAIL] ANTHROPIC_API_KEY too short (${key_length} chars, minimum 30)"
      echo "       Check if key is complete"
      ((errors++))
    else
      echo "[OK] ANTHROPIC_API_KEY length valid (${key_length} chars)"
    fi

    # 키 형식 검증 (공백 금지, sk-ant- 시작)
    if [[ "$ANTHROPIC_API_KEY" =~ [[:space:]] ]]; then
      echo "[FAIL] ANTHROPIC_API_KEY contains whitespace"
      echo "       Remove spaces/newlines from key"
      ((errors++))
    elif [[ ! "$ANTHROPIC_API_KEY" =~ ^sk-ant- ]]; then
      echo "[WARN] ANTHROPIC_API_KEY doesn't start with 'sk-ant-'"
      echo "       Verify key format is correct"
    else
      local masked_key="${ANTHROPIC_API_KEY:0:8}****"
      echo "[OK] ANTHROPIC_API_KEY format valid: $masked_key"
    fi
  fi

  # Node.js 버전 확인
  if command -v node >/dev/null 2>&1; then
    local node_version
    node_version=$(node --version)
    echo "[OK] Node.js available: $node_version"
  else
    echo "[WARN] Node.js not found - some features may not work"
  fi

  # 결과 요약
  if [[ $errors -eq 0 ]]; then
    echo "[PREFLIGHT] ✓ All checks passed"
    return 0
  else
    echo "[PREFLIGHT] ✗ $errors error(s) found"
    echo "            Fix issues above before proceeding"
    return 1
  fi
}

# 직접 실행된 경우
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  # 환경변수 로드 후 검증
  if [[ -f tools/load_env.sh ]]; then
    source tools/load_env.sh
    load_anthropic_env
  fi

  preflight_check
fi