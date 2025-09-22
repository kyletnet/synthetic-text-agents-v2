#!/usr/bin/env bash
set -euo pipefail

SCRATCH="$(mktemp -d 2>/dev/null || mktemp -d -t repostate)"
trap 'rm -rf "$SCRATCH"' EXIT

ROOT="$(pwd)"
GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "${GIT_ROOT:-}" ] && cd "$GIT_ROOT" || true

ts(){ date -Iseconds; }
have(){ command -v "$1" >/dev/null 2>&1; }
cap(){ local out="$SCRATCH/$(date +%s%N).out"; ( set +e; "$@" ) >"$out" 2>&1 || true; printf "%s" "$out"; }

# ---- basics
BASICS="$SCRATCH/basics.txt"
{
  echo "cwd: $(pwd)"
  if [ -d .git ]; then
    echo "git_root: $(pwd)"
    git --no-pager log -1 --pretty='head: %h %ad %s' --date=iso 2>/dev/null || true
    echo -n "working_changes: "; git status --porcelain 2>/dev/null | wc -l
  else
    echo "(not a git repo)"
  fi
  ls -la CLAUDE.md SYSTEM_MAP.md 2>/dev/null || true
} > "$BASICS"

# ---- docs stale probe (read-only)
DOCS="$SCRATCH/docs.json"
if have curl; then
  cp "$(cap curl -sS --max-time 2 http://localhost:3000/api/docs/status)" "$DOCS"
fi

# ---- bounded scans
COUNT_TS="$SCRATCH/count_ts.txt"
find src -type f -name "*.ts" 2>/dev/null | wc -l > "$COUNT_TS" || true

scan() { local out="$1"; shift; ( set +e; eval "$*" | head -200 ) > "$out" 2>/dev/null || true; }
scan "$SCRATCH/rag.list"     'find src -type f -iname "*rag*.*" -o -iname "*chunk*.*" -o -iname "*retriev*.*" | sed "s/^/RAG:/"'
scan "$SCRATCH/aug.list"     'find src -type f -iname "*augment*.*" -o -iname "*paraphr*.*" -o -iname "*difficulty*.*" -o -iname "*mcq*.*" -o -iname "*error*inject*.*" | sed "s/^/AUG:/"'
scan "$SCRATCH/agents.list"  'find src -type f -path "*/agents/*" -maxdepth 2 -name "*.ts" | sed "s/^/AGENT:/"'
scan "$SCRATCH/core.list"    'find src -type f -path "*/core/*"   -maxdepth 2 -name "*.ts" | sed "s/^/CORE:/"'

scan "$SCRATCH/grep_inputs"  'grep -RIn "seed_doc_path\|gold_pairs_path\|mixed inputs\|TaskRequest" src apps'
scan "$SCRATCH/grep_gates"   'grep -RIn "QualityGate\|Guardian\|min_score\|veto" src'
scan "$SCRATCH/grep_logs"    'grep -RIn "RUN_LOGS\|DECISIONS\|EXPERIMENTS" apps'

WATCH="$SCRATCH/watch.snip"
if   [ -f apps/fe-web/docs/.watch_paths.json ]; then head -400 apps/fe-web/docs/.watch_paths.json > "$WATCH"
elif [ -f config/watch_paths.json ]; then        head -400 config/watch_paths.json        > "$WATCH"
fi

present_or_missing(){
  local tag="$1" pat="$2" hit="$SCRATCH/hit.$(echo "$tag"|tr ' ' _)"
  if grep -RIl --exclude-dir=node_modules -E "$pat" src apps 2>/dev/null | head -5 > "$hit"; then
    [ -s "$hit" ] && echo "$tag: present" || echo "$tag: missing"
  else
    echo "$tag: missing"
  fi
}

PRES="$SCRATCH/presence.txt"
{
  present_or_missing "Inputs routing (seed_doc_path/gold_pairs_path/mixed)" "seed_doc_path|gold_pairs_path|mixed inputs"
  present_or_missing "RAG (chunk/retrieve/index)" "chunk|retriev|index"
  present_or_missing "Augmentation (paraphrase/difficulty,mcq,error)" "paraphr|difficulty|mcq|error"
  present_or_missing "QA Gates (QualityGate/Guardian/min_score/veto)" "QualityGate|Guardian|min_score|veto"
} > "$PRES"

REPORT="REPORT_CURRENT_STATE.md"
{
  echo "# Repo State & Next-Dev Readiness (v2 — manual snapshot)"
  echo "Generated: $(ts)"
  echo
  echo "## Repo Basics"
  echo "```"
  cat "$BASICS"
  echo "```"
  echo
  echo "## Docs Freshness (read-only probe)"
  echo "```"
  if [ -s "$DOCS" ]; then head -200 "$DOCS"; else echo "(status endpoint not reachable)"; fi
  echo "```"
  echo
  if [ -f SYSTEM_MAP.md ]; then
    echo "## SYSTEM_MAP.md (first 200 lines)"; echo "```"; sed -n '1,200p' SYSTEM_MAP.md; echo "```"
  fi
  if [ -f CLAUDE.md ]; then
    echo "## CLAUDE.md (first 120 lines)"; echo "```"; sed -n '1,120p' CLAUDE.md; echo "```"
  fi
  echo
  echo "## Evidence (bounded)"
  echo "- TypeScript files in src: $(cat "$COUNT_TS" 2>/dev/null || echo 0)"
  for pair in RAG:$SCRATCH/rag.list AUG:$SCRATCH/aug.list AGENTS:$SCRATCH/agents.list CORE:$SCRATCH/core.list; do
    k="${pair%%:*}"; f="${pair#*:}"
    echo "### $k"; echo "```"; [ -s "$f" ] && cat "$f" || echo "(none)"; echo "```"
  done
  echo "### Greps"; echo "```"
  echo "-- Inputs";       [ -s "$SCRATCH/grep_inputs" ] && cat "$SCRATCH/grep_inputs" || echo "(none)"
  echo; echo "-- Gates";    [ -s "$SCRATCH/grep_gates" ]  && cat "$SCRATCH/grep_gates"  || echo "(none)"
  echo; echo "-- Logs/Idx"; [ -s "$SCRATCH/grep_logs" ]   && cat "$SCRATCH/grep_logs"   || echo "(none)"
  echo "```"
  echo
  echo "## Watch Config"; echo "```"; [ -s "$WATCH" ] && cat "$WATCH" || echo "(no watch config)"; echo "```"
  echo
  echo "## Present vs Missing (signals)"; echo "```"; cat "$PRES"; echo "```"
  echo
  echo "## Ready-to-Act Next Steps"
  echo "- Docs stale? run:  curl -X POST http://localhost:3000/api/docs/refresh -H \"x-docs-refresh-token: <your-token>\""
  echo "- Inputs routing: add API schema/router stub behind FF (apps/fe-web/app/api/run/route.ts)."
  echo "- Minimal RAG: ensure src/rag/{chunk,retrieve}.ts and orchestrator wiring."
  echo "- Augmentation: src/augmentation/{paraphrase,difficulty,mcq,error}.ts + quality gate."
  echo "- Regression hooks: dev/runs/*.json payloads & RUN_LOGS/INDEX.md."
  echo
  echo "## Go / No-Go Checklist"
  echo "- Docs OK; Safety(FLAG/Fallback/Docs) present; Guardian/gates present; Owners clear."
} > "$REPORT"

echo "Wrote $REPORT"
