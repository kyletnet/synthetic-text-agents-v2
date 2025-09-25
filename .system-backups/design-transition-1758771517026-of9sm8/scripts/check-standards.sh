#!/bin/bash

# 개발 표준 준수 검증 스크립트
# 코드베이스가 정의된 표준을 따르는지 자동 검사

set -e

echo "🔍 개발 표준 준수 검증을 시작합니다..."

VIOLATIONS=0

# 1. 파일 명명 규칙 검사
echo "📁 1. 파일 명명 규칙 검사..."

# TypeScript 파일에서 snake_case 찾기 (scripts 폴더 제외)
echo "  TypeScript 파일 명명 규칙..."
SNAKE_CASE_TS=$(find src -name "*_*.ts" | grep -v "__" | grep -v "scripts/" | head -10)
if [ -n "$SNAKE_CASE_TS" ]; then
    echo "❌ snake_case TypeScript 파일 발견:"
    echo "$SNAKE_CASE_TS"
    ((VIOLATIONS++))
else
    echo "✅ TypeScript 파일 명명 규칙 준수"
fi

# 2. Import 경로 검사
echo "📦 2. Import 경로 검사..."

# .ts 확장자로 import하는 경우 찾기
TS_IMPORTS=$(grep -r "from.*\.ts['\"]" src/ | head -5) || true
if [ -n "$TS_IMPORTS" ]; then
    echo "❌ .ts 확장자로 import하는 파일 발견:"
    echo "$TS_IMPORTS"
    ((VIOLATIONS++))
else
    echo "✅ Import 경로 규칙 준수"
fi

# 3. TypeScript any 타입 사용률 검사
echo "🔍 3. TypeScript any 타입 사용률 검사..."

ANY_COUNT=$(grep -r ": any\|as any" src/ | wc -l | tr -d ' ')
TOTAL_TS_LINES=$(find src -name "*.ts" -exec wc -l {} + | tail -1 | awk '{print $1}')
ANY_PERCENTAGE=$(echo "scale=2; $ANY_COUNT * 100 / $TOTAL_TS_LINES" | bc -l 2>/dev/null || echo "0")

echo "  any 타입 사용: $ANY_COUNT 건 ($ANY_PERCENTAGE%)"

if (( $(echo "$ANY_PERCENTAGE > 5" | bc -l 2>/dev/null || echo "0") )); then
    echo "❌ any 타입 사용률이 5%를 초과했습니다"
    ((VIOLATIONS++))
else
    echo "✅ any 타입 사용률이 적절합니다"
fi

# 4. 테스트 커버리지 검사
echo "🧪 4. 테스트 커버리지 검사..."

AGENT_COUNT=$(find src/agents -name "*.ts" | grep -v "\.llm\.ts" | wc -l | tr -d ' ')
AGENT_TEST_COUNT=$(find tests -name "*agent*.test.ts" -o -name "*Agent*.test.ts" -o -name "psychologySpecialist.test.ts" -o -name "linguisticsEngineer.test.ts" -o -name "domainConsultant.test.ts" -o -name "promptArchitect.test.ts" -o -name "qaGenerator.test.ts" -o -name "qualityAuditor.test.ts" -o -name "cognitiveScientist.test.ts" | wc -l | tr -d ' ')

echo "  에이전트 파일: $AGENT_COUNT 개"
echo "  에이전트 테스트: $AGENT_TEST_COUNT 개"

if [ "$AGENT_TEST_COUNT" -lt "$AGENT_COUNT" ]; then
    echo "⚠️  일부 에이전트에 테스트가 없습니다"
else
    echo "✅ 모든 에이전트에 테스트가 있습니다"
fi

# 5. 문서 일관성 검사
echo "📚 5. 문서 일관성 검사..."

# 필수 문서 존재 확인
REQUIRED_DOCS=(
    "docs/DEVELOPMENT_STANDARDS.md"
    "docs/TYPESCRIPT_GUIDELINES.md"
    "CLAUDE.md"
    "README.md"
)

MISSING_DOCS=()
for doc in "${REQUIRED_DOCS[@]}"; do
    if [ ! -f "$doc" ]; then
        MISSING_DOCS+=("$doc")
    fi
done

if [ ${#MISSING_DOCS[@]} -gt 0 ]; then
    echo "❌ 누락된 필수 문서:"
    printf '  %s\n' "${MISSING_DOCS[@]}"
    ((VIOLATIONS++))
else
    echo "✅ 모든 필수 문서가 존재합니다"
fi

# 6. Git hooks 설정 확인
echo "🔧 6. Git hooks 설정 확인..."

if [ ! -f ".git/hooks/pre-commit" ]; then
    echo "❌ pre-commit hook이 설정되지 않았습니다"
    ((VIOLATIONS++))
elif [ ! -x ".git/hooks/pre-commit" ]; then
    echo "❌ pre-commit hook에 실행 권한이 없습니다"
    ((VIOLATIONS++))
else
    echo "✅ pre-commit hook이 올바르게 설정되었습니다"
fi

# 7. 설정 파일 일관성 검사
echo "⚙️ 7. 설정 파일 일관성 검사..."

CONFIG_FILES=(
    "package.json"
    "tsconfig.json"
    "tsconfig.build.json"
    "eslint.config.js"
)

MISSING_CONFIGS=()
for config in "${CONFIG_FILES[@]}"; do
    if [ ! -f "$config" ]; then
        MISSING_CONFIGS+=("$config")
    fi
done

if [ ${#MISSING_CONFIGS[@]} -gt 0 ]; then
    echo "❌ 누락된 설정 파일:"
    printf '  %s\n' "${MISSING_CONFIGS[@]}"
    ((VIOLATIONS++))
else
    echo "✅ 모든 설정 파일이 존재합니다"
fi

# 8. 빌드 및 테스트 상태 확인
echo "🚀 8. 빌드 및 테스트 상태 확인..."

echo "  TypeScript 컴파일 검사..."
if npm run typecheck --silent; then
    echo "✅ TypeScript 컴파일 성공"
else
    echo "❌ TypeScript 컴파일 실패"
    ((VIOLATIONS++))
fi

echo "  테스트 실행..."
if npm run test --silent; then
    echo "✅ 모든 테스트 통과"
else
    echo "❌ 테스트 실패"
    ((VIOLATIONS++))
fi

# 결과 요약
echo ""
echo "📊 검증 결과 요약"
echo "===================="

if [ $VIOLATIONS -eq 0 ]; then
    echo "🎉 축하합니다! 모든 표준을 준수하고 있습니다."
    echo ""
    echo "📈 품질 지표:"
    echo "  - TypeScript 에러: 0개"
    echo "  - any 타입 사용률: $ANY_PERCENTAGE%"
    echo "  - 에이전트 테스트 커버리지: $AGENT_TEST_COUNT/$AGENT_COUNT"
    echo "  - 문서 완성도: 100%"
    exit 0
else
    echo "⚠️  $VIOLATIONS개의 표준 위반이 발견되었습니다."
    echo ""
    echo "🔧 수정 방법:"
    echo "  1. 위에 표시된 문제들을 확인하세요"
    echo "  2. docs/DEVELOPMENT_STANDARDS.md를 참조하세요"
    echo "  3. 자동 수정: npm run lint:fix"
    echo "  4. 수정 후 다시 실행: npm run check:standards"
    echo ""
    exit 1
fi