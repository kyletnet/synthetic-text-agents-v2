#!/usr/bin/env bash
set -euo pipefail

# 0) 루트 고정(가능하면 git 루트로)
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

TS="$(date +%Y%m%d-%H%M%S)"
OUT="reports/EXPORT"
mkdir -p "$OUT"

echo "==> Export start @ $TS"
echo "    output dir: $OUT"

# 1) 기본 제외 목록 정의
EXCLUDES=(
  ".git/*"
  "node_modules/*"
  ".cache/*"
  "outputs/*"
  "RUN_LOGS/*"
  "*.lock"
  "*.log"
  "*.tmp"
  "*.DS_Store"
)
# 추가로 제외하고 싶은 경로가 있으면 여기에 이어서 넣으세요.

# 2) 소스 스냅샷(zip): git이 있으면 git archive, 없으면 zip으로 대체
ZIP_PATH="$OUT/repo_source_${TS}.zip"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "==> Creating source snapshot via git archive..."
  git archive --format=zip -o "$ZIP_PATH" HEAD
else
  echo "==> Creating source snapshot via zip (no git)..."
  EX_PATTERNS=()
  for p in "${EXCLUDES[@]}"; do EX_PATTERNS+=("-x" "$p"); done
  (shopt -s dotglob; zip -r "$ZIP_PATH" . "${EX_PATTERNS[@]}")
fi
echo "    -> $ZIP_PATH"

# 3) git 히스토리 포함 번들(옵션): git이 있을 때만 생성
BUNDLE_PATH="$OUT/repo_history_${TS}.bundle"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "==> Creating git bundle (history included)..."
  git bundle create "$BUNDLE_PATH" --all
  echo "    -> $BUNDLE_PATH"
else
  echo "==> Skip git bundle (not a git repo)."
fi

# 4) 단일 Markdown 코드 덤프 생성(CODE_DUMP.md)
DUMP_PATH="$OUT/CODE_DUMP_${TS}.md"
echo "==> Building CODE_DUMP.md (this may take a bit)..."
{
  echo "# CODE_DUMP (${TS})"
  echo
  echo "> 단일 문서로 소스 핵심 파일들을 모았습니다."
  echo "> 자동 제외: 바이너리/대용량, node_modules, .git, outputs, RUN_LOGS, cache 등"
  echo

  FILES=()
  while IFS= read -r -d '' file; do
    FILES+=("$file")
  done < <(find . -type f \
    ! -path "./.git/*" \
    ! -path "./node_modules/*" \
    ! -path "./.cache/*" \
    ! -path "./outputs/*" \
    ! -path "./RUN_LOGS/*" \
    ! -path "./reports/EXPORT/*" \
    ! -name "*.png" ! -name "*.jpg" ! -name "*.jpeg" ! -name "*.gif" \
    ! -name "*.pdf" ! -name "*.zip" ! -name "*.tar" ! -name "*.gz" \
    ! -name "*.ico" ! -name "*.lock" ! -name "*.log" ! -name "*.tmp" \
    ! -name "*.mp4" ! -name "*.mp3" \
    -size -1M -print0 | sort -z)

  for f in "${FILES[@]}"; do
    if file "$f" | grep -qiE "text|utf-8|json|xml|yaml|yml|csv|javascript|typescript|html|css|markdown"; then
      echo
      echo "## $f"
      ext="${f##*.}"
      case "$ext" in
        js) lang="javascript" ;; ts) lang="ts" ;; tsx) lang="tsx" ;; jsx) lang="jsx" ;;
        json) lang="json" ;; yml|yaml) lang="yaml" ;; md) lang="md" ;;
        sh|bash) lang="bash" ;; html) lang="html" ;; css) lang="css" ;; sql) lang="sql" ;;
        *) lang="" ;;
      esac
      if [ -n "${lang}" ]; then
        echo "\`\`\`${lang}"
      else
        echo "\`\`\`"
      fi
      sed -n '1,400p' "$f" || true
      total_lines=$(wc -l < "$f" || echo 0)
      if [ "$total_lines" -gt 400 ]; then
        echo ""
        echo "[...] (truncated: $((total_lines-400)) lines omitted)"
      fi
      echo "\`\`\`"
    fi
  done

  echo
  echo "---"
  echo "_자동 생성: reports/EXPORT/CODE_DUMP_${TS}.md_"
} > "$DUMP_PATH"
echo "    -> $DUMP_PATH"

# 5) 민감정보 간단 스캔(보고만)
echo "==> Scanning for potential secrets (report-only)…"
SECRETS_REPORT="$OUT/POSSIBLE_SECRETS_${TS}.txt"
grep -RInE "api[_-]?key|secret|token|authorization|x-api-key|bearer|password|PRIVATE_KEY" \
  --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir=".cache" \
  --exclude-dir="outputs" --exclude-dir="RUN_LOGS" \
  --exclude-dir="reports/EXPORT" \
  . 2>/dev/null \
  || true | tee "$SECRETS_REPORT" >/dev/null || true
echo "    -> $SECRETS_REPORT (비어있을 수 있음; 업로드 전 눈으로 재확인!)"

echo "==> Export done."
echo ""
echo "Upload tips:"
echo "  1) 소스만 필요:   $ZIP_PATH"
[ -f "$BUNDLE_PATH" ] && echo "  2) 히스토리 포함: $BUNDLE_PATH"
echo "  3) 단일 문서 리뷰: $DUMP_PATH"
echo "  4) 시크릿 스캔 결과: $SECRETS_REPORT"