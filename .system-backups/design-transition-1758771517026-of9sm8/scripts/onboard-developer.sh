#!/bin/bash

# 개발자 온보딩 자동화 스크립트
# 새로운 개발자가 즉시 표준을 따라 개발할 수 있도록 환경 설정

set -e

echo "🚀 개발자 온보딩을 시작합니다..."

# 1. 환경 검증
echo "📋 1. 환경 검증..."

# Node.js 버전 확인
NODE_VERSION=$(node --version)
REQUIRED_NODE_VERSION="18.18.0"

if ! node -pe "process.exit(process.version.slice(1).split('.').map(Number).reduce((a, v, i) => a * 1000 + v) >= '$REQUIRED_NODE_VERSION'.split('.').map(Number).reduce((a, v, i) => a * 1000 + v) ? 0 : 1)"; then
    echo "❌ Node.js $REQUIRED_NODE_VERSION 이상이 필요합니다. 현재: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js 버전: $NODE_VERSION"

# 2. 의존성 설치
echo "📦 2. 의존성 설치..."
npm install --silent

# 3. Git hooks 설정
echo "🔧 3. Git hooks 설정..."
if [ ! -f .git/hooks/pre-commit ]; then
    echo "❌ pre-commit hook이 없습니다. 설정이 필요합니다."
    exit 1
fi

# pre-commit hook 실행 권한 확인
chmod +x .git/hooks/pre-commit
echo "✅ Pre-commit hook 설정 완료"

# 4. 개발 표준 문서 확인
echo "📚 4. 개발 표준 문서 확인..."

REQUIRED_DOCS=(
    "docs/DEVELOPMENT_STANDARDS.md"
    "docs/TYPESCRIPT_GUIDELINES.md"
    "CLAUDE.md"
    "README.md"
)

for doc in "${REQUIRED_DOCS[@]}"; do
    if [ ! -f "$doc" ]; then
        echo "❌ 필수 문서가 없습니다: $doc"
        exit 1
    fi
    echo "✅ 확인: $doc"
done

# 5. 개발 환경 테스트
echo "🧪 5. 개발 환경 테스트..."

echo "  TypeScript 검사..."
if npm run typecheck --silent; then
    echo "✅ TypeScript 검사 통과"
else
    echo "❌ TypeScript 검사 실패 - 코드베이스에 문제가 있습니다."
    exit 1
fi

echo "  ESLint 검사..."
if npm run lint --silent; then
    echo "✅ ESLint 검사 통과"
else
    echo "⚠️  ESLint 경고가 있습니다. 정상적인 경우일 수 있습니다."
fi

echo "  테스트 실행..."
if npm run test --silent; then
    echo "✅ 모든 테스트 통과"
else
    echo "❌ 테스트 실패 - 코드베이스에 문제가 있습니다."
    exit 1
fi

# 6. 개발자별 설정 안내
echo ""
echo "🎯 온보딩 완료! 다음 단계를 확인하세요:"
echo ""
echo "📖 필수 읽을 문서:"
echo "  1. docs/DEVELOPMENT_STANDARDS.md - 개발 표준 및 규칙"
echo "  2. docs/TYPESCRIPT_GUIDELINES.md - TypeScript 개발 가이드"
echo "  3. CLAUDE.md - 시스템 아키텍처 및 파일 구조"
echo ""
echo "🔧 개발 명령어:"
echo "  npm run dev          # 개발 서버 실행"
echo "  npm run typecheck    # TypeScript 검사"
echo "  npm run lint         # 코드 린팅"
echo "  npm run test         # 테스트 실행"
echo "  npm run ci:quality   # 전체 품질 검사"
echo ""
echo "🚀 새 에이전트 생성:"
echo "  npm run generate:agent -- --name=MyAgent"
echo ""
echo "❓ 질문이 있으면:"
echo "  1. 위 문서들을 먼저 확인"
echo "  2. 기존 코드 패턴 참조"
echo "  3. 팀에 문의"
echo ""
echo "✅ 온보딩 완료! 즐거운 개발 되세요! 🎉"