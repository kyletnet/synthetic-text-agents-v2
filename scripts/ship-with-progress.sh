#!/bin/bash
# Ship Pipeline with Progress Indicator
# Usage: npm run ship:progress

set -e

STEPS=(
  "design:validate|Design Validation"
  "validate|System Validation"
  "verify|Verification Checks"
  "_hidden:integration-guard|Integration Guard"
  "_hidden:system-integration|System Integration"
  "advanced:audit|Advanced Audit"
  "docs:refresh|Documentation Sync"
  "optimize:analyze|Optimization Analysis"
)

TOTAL=${#STEPS[@]}
CURRENT=0

echo "🚢 Ship Pipeline Starting..."
echo "═══════════════════════════════════════"
echo ""

START_TIME=$(date +%s)

for step in "${STEPS[@]}"; do
  CURRENT=$((CURRENT + 1))
  CMD="${step%%|*}"
  NAME="${step##*|}"

  STEP_START=$(date +%s)
  echo "⏳ [$CURRENT/$TOTAL] $NAME..."

  if npm run "$CMD" > /dev/null 2>&1; then
    STEP_END=$(date +%s)
    DURATION=$((STEP_END - STEP_START))
    echo "   ✅ Complete (${DURATION}s)"
  else
    echo "   ❌ Failed"
    echo ""
    echo "Re-run with verbose output:"
    echo "npm run $CMD"
    exit 1
  fi
done

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo "═══════════════════════════════════════"
echo "🚢 Ready for deployment (${TOTAL_DURATION}s total)"
echo ""
echo "📊 Summary:"
echo "   ✅ All $TOTAL steps completed"
echo "   ⏱️  Total time: ${TOTAL_DURATION}s"
echo ""
echo "💡 Next: Commit and push changes"
