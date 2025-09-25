#!/usr/bin/env bash
set -euo pipefail

# LLM 친화적 코드 덤프 생성 (핵심 파일만)
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

TS="$(date +%Y%m%d-%H%M%S)"
OUT="reports/EXPORT"
mkdir -p "$OUT"

DUMP_PATH="$OUT/CODE_DUMP_SMART_${TS}.md"
echo "==> Building SMART CODE_DUMP.md (LLM-friendly)..."

{
  echo "# SMART CODE_DUMP (${TS})"
  echo
  echo "> LLM 친화적 버전: 핵심 소스 파일만 포함 (최대 5MB 목표)"
  echo "> 포함: TypeScript/JavaScript 핵심 로직, 설정, 문서"
  echo "> 제외: 테스트, 빌드 출력, node_modules, 로그, 캐시"
  echo

  # 핵심 파일 우선순위 목록
  PRIORITY_FILES=(
    "CLAUDE.md"
    "docs/OPS_BRIEF.md"
    "README.md"
    "package.json"
    "tsconfig.json"
    ".env.example"
    "src/shared/types.ts"
    "src/core/*.ts"
    "src/agents/*.ts"
    "src/cli/main.ts"
    "step4_2.sh"
    "tools/s4_2_evaluate.cjs"
    "tools/llm.cjs"
    "handoff_one.sh"
  )

  # 우선순위 파일들 먼저 처리
  for pattern in "${PRIORITY_FILES[@]}"; do
    if [[ "$pattern" == *"*"* ]]; then
      # 와일드카드 패턴 처리
      for file in $pattern; do
        if [[ -f "$file" ]]; then
          echo "## 📁 $file"
          echo
          echo '```'
          head -200 "$file"  # 최대 200줄만
          if [[ $(wc -l < "$file") -gt 200 ]]; then
            echo "... [truncated: $(wc -l < "$file") total lines]"
          fi
          echo '```'
          echo
        fi
      done
    else
      # 단일 파일
      if [[ -f "$pattern" ]]; then
        echo "## 📁 $pattern"
        echo
        echo '```'
        head -200 "$pattern"  # 최대 200줄만
        if [[ $(wc -l < "$pattern") -gt 200 ]]; then
          echo "... [truncated: $(wc -l < "$pattern") total lines]"
        fi
        echo '```'
        echo
      fi
    fi
  done

  # 추가 핵심 파일들 (크기 제한)
  echo "## 📁 기타 핵심 파일들"
  echo

  find . -type f \
    -name "*.ts" -o -name "*.js" -o -name "*.sh" \
    ! -path "./node_modules/*" \
    ! -path "./dist/*" \
    ! -path "./test/*" \
    ! -path "./tests/*" \
    ! -path "./.git/*" \
    ! -path "./RUN_LOGS/*" \
    ! -path "./outputs/*" \
    ! -path "./reports/*" \
    -size -50k | \
  head -20 | \
  while read -r file; do
    if [[ ! "$file" =~ (test|spec|mock) ]]; then
      echo "### $file"
      echo '```'
      echo "$(basename "$file" | sed 's/.*\.//'))"
      head -50 "$file"  # 최대 50줄만
      echo '```'
      echo
    fi
  done

} > "$DUMP_PATH"

SIZE=$(ls -lh "$DUMP_PATH" | awk '{print $5}')
echo "    -> $DUMP_PATH ($SIZE)"
echo "==> Smart dump complete! LLM-friendly size."