#!/usr/bin/env bash
set -Eeuo pipefail

# 전역 건강성 체크 - 환경변수 로딩 누락 감지
# 사용법: ./tools/health_check.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

# 색상 헬퍼
ok()   { printf "\033[32m[OK]\033[0m %s\n" "$*"; }
warn() { printf "\033[33m[WARN]\033[0m %s\n" "$*"; }
fail() { printf "\033[31m[FAIL]\033[0m %s\n" "$*"; }

check_env_coverage() {
  echo "[HEALTH] Checking environment loading coverage..."

  local missing_files=()
  local anthropic_scripts=()
  local total_scripts=0

  # bash 스크립트 전체 스캔
  while IFS= read -r -d '' script; do
    # node_modules, .git, reports 등 제외
    if [[ "$script" =~ (node_modules|\.git|reports/_archive|\.npm-cache) ]]; then
      continue
    fi

    ((total_scripts++))

    # 첫 줄이 bash shebang인지 확인
    if head -1 "$script" | grep -q "#!/.*bash"; then
      # ANTHROPIC_API_KEY를 실제로 사용하는지 확인 (단순 패턴/주석이 아닌 실제 사용)
      if grep -q "\$ANTHROPIC_API_KEY\|anthropic_client\.sh\|curl.*anthropic\.com\|fetch.*anthropic\.com" "$script" 2>/dev/null; then
        # 실제 API 호출이 있는지 확인 (주석/패턴 제외)
        if ! grep -q "^[[:space:]]*#.*anthropic\|pattern.*anthropic\|echo.*anthropic" "$script" ||
           grep -q "curl.*anthropic\.com\|fetch.*anthropic\.com\|\$ANTHROPIC_API_KEY" "$script"; then
          anthropic_scripts+=("$script")

          # 환경변수 로딩 코드가 있는지 확인
          # 단, shimmed scripts는 직접 실행이 불가능하므로 안전한 것으로 간주
          if head -10 "$script" | grep -q "EXECUTION SHIM"; then
            # Shimmed script는 통합 런처를 통해서만 실행 가능하므로 안전
            continue
          elif ! grep -q "source.*\.env\|load_anthropic_env\|load_env\.sh" "$script" 2>/dev/null; then
            missing_files+=("$script")
          fi
        fi
      fi
    fi
  done < <(find . -name "*.sh" -type f -print0)

  echo "[HEALTH] Scanned $total_scripts bash scripts"
  echo "[HEALTH] Found ${#anthropic_scripts[@]} scripts using Anthropic API"

  # 결과 보고
  if [[ ${#missing_files[@]} -eq 0 ]]; then
    ok "All Anthropic API scripts have environment loading"
    return 0
  else
    fail "Found ${#missing_files[@]} scripts missing environment loading:"
    for file in "${missing_files[@]}"; do
      echo "  - $file"
    done
    echo
    echo "Fix by adding one of these patterns:"
    echo "  source tools/load_env.sh && load_anthropic_env"
    echo "  set -a; source .env; set +a"
    return 1
  fi
}

check_registry_coverage() {
  echo "[HEALTH] Checking entrypoints registry coverage..."

  if [[ ! -f scripts/entrypoints.jsonl ]]; then
    warn "Entrypoints registry not found: scripts/entrypoints.jsonl"
    return 0
  fi

  local registered_scripts=()
  local major_scripts=()
  local unregistered=()

  # 레지스트리에 등록된 스크립트 목록
  while IFS= read -r line; do
    local script
    script=$(echo "$line" | grep -o '"script":"[^"]*"' | cut -d'"' -f4)
    registered_scripts+=("$script")
  done < scripts/entrypoints.jsonl

  # 주요 실행 스크립트 식별 (루트 레벨의 .sh 파일들)
  while IFS= read -r -d '' script; do
    local basename_script
    basename_script=$(basename "$script")

    # 주요 스크립트 패턴 (step*, handoff*, export* 등)
    if [[ "$script" =~ ^\./[^/]+\.sh$ ]] && [[ "$basename_script" =~ (step|handoff|export|run|build|test) ]]; then
      major_scripts+=("$script")

      # 레지스트리에 등록되어 있는지 확인
      local found=false
      for registered in "${registered_scripts[@]}"; do
        if [[ "$script" == "$registered" ]]; then
          found=true
          break
        fi
      done

      if [[ "$found" == "false" ]]; then
        unregistered+=("$script")
      fi
    fi
  done < <(find . -maxdepth 1 -name "*.sh" -type f -print0)

  echo "[HEALTH] Found ${#major_scripts[@]} major scripts"
  echo "[HEALTH] Registry contains ${#registered_scripts[@]} entries"

  if [[ ${#unregistered[@]} -eq 0 ]]; then
    ok "All major scripts are registered"
    return 0
  else
    warn "Found ${#unregistered[@]} unregistered major scripts:"
    for script in "${unregistered[@]}"; do
      echo "  - $script"
    done
    echo
    echo "Consider adding to scripts/entrypoints.jsonl"
    return 0  # Warning only, not failure
  fi
}

check_tool_dependencies() {
  echo "[HEALTH] Checking tool dependencies..."

  local required_tools=("load_env.sh" "preflight.sh" "smoke_anthropic.sh")
  local missing_tools=()

  for tool in "${required_tools[@]}"; do
    if [[ ! -f "tools/$tool" ]]; then
      missing_tools+=("tools/$tool")
    elif [[ ! -x "tools/$tool" ]]; then
      warn "tools/$tool exists but is not executable"
    fi
  done

  if [[ ${#missing_tools[@]} -eq 0 ]]; then
    ok "All required tools are present"
    return 0
  else
    fail "Missing required tools:"
    for tool in "${missing_tools[@]}"; do
      echo "  - $tool"
    done
    return 1
  fi
}

# 메인 체크 실행
main() {
  echo "[HEALTH] Starting system health check..."
  echo

  local checks_failed=0

  # 도구 의존성 체크
  if ! check_tool_dependencies; then
    ((checks_failed++))
  fi
  echo

  # 환경변수 로딩 커버리지 체크
  if ! check_env_coverage; then
    ((checks_failed++))
  fi
  echo

  # 레지스트리 커버리지 체크 (경고만)
  check_registry_coverage
  echo

  # 최종 결과
  if [[ $checks_failed -eq 0 ]]; then
    ok "All health checks passed"
    return 0
  else
    fail "$checks_failed health check(s) failed"
    return 1
  fi
}

# 직접 실행된 경우
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi