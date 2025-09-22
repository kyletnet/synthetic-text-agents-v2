#!/usr/bin/env bash
set -Eeuo pipefail

# Anthropic API 스모크 테스트 (초저비용 연결 확인)
# 사용법: DRY_RUN=true ./tools/smoke_anthropic.sh
#         BUDGET_USD=0.01 ./tools/smoke_anthropic.sh
#
# Refactored to use tools/anthropic_client.sh for consistent API access

smoke_test_anthropic() {
  local dry_run="${DRY_RUN:-false}"
  local budget_usd="${BUDGET_USD:-0.05}"

  echo "[SMOKE] Starting Anthropic API test (dry_run=$dry_run, budget=\$$budget_usd)"

  # API 키 확인
  if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    echo "[FAIL] ANTHROPIC_API_KEY not set for smoke test"
    return 1
  fi

  local masked_key="${ANTHROPIC_API_KEY:0:8}****"
  echo "[SMOKE] Using API key: $masked_key"

  # DRY_RUN 모드: 오프라인 모드로 클라이언트 사용
  if [[ "$dry_run" == "true" ]]; then
    echo "[SMOKE] DRY_RUN mode - using offline client validation"

    # 키 길이 재검증
    if [[ ${#ANTHROPIC_API_KEY} -lt 30 ]]; then
      echo "[FAIL] API key too short for smoke test"
      return 1
    fi

    # 오프라인 모드로 클라이언트 테스트
    if OFFLINE_MODE=true ./tools/anthropic_client.sh --smoke; then
      echo "[SMOKE] ✓ DRY_RUN validation passed"
      return 0
    else
      echo "[FAIL] Client validation failed"
      return 1
    fi
  fi

  # 실제 API 호출 (tools/anthropic_client.sh 사용)
  echo "[SMOKE] Performing minimal API call using anthropic_client.sh..."

  # 예상 비용 확인 (하이쿠 모델, 최소 토큰)
  local estimated_cost=0.0001
  if command -v bc >/dev/null 2>&1; then
    if (( $(echo "$estimated_cost > $budget_usd" | bc -l) )); then
      echo "[FAIL] Estimated cost (\$$estimated_cost) exceeds budget (\$$budget_usd)"
      return 1
    fi
  fi

  # anthropic_client.sh의 스모크 테스트 사용
  if ./tools/anthropic_client.sh --smoke; then
    echo "[SMOKE] ✓ API connection successful via anthropic_client.sh"
    return 0
  else
    echo "[FAIL] Smoke test failed via anthropic_client.sh"
    return 1
  fi
}

# bc 명령어 존재 확인 (부동소수점 비교용)
check_dependencies() {
  if ! command -v bc >/dev/null 2>&1; then
    echo "[WARN] 'bc' not found - budget check disabled"
  fi
  # curl 체크 제거 - anthropic_client.sh가 처리함
}

# 직접 실행된 경우
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  # 의존성 확인
  check_dependencies

  # 환경변수 로드
  if [[ -f tools/load_env.sh ]]; then
    source tools/load_env.sh
    load_anthropic_env
  fi

  smoke_test_anthropic
fi