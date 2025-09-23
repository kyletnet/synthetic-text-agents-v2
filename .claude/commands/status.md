# /status

시스템 전반적인 상태를 확인합니다.

## 동작

1. Git 상태 확인
2. TypeScript 컴파일 체크
3. 테스트 결과 요약
4. 시스템 건강성 점검

## 실행

```bash
echo "🔍 Git Status:" && git status --short && echo "" && echo "🔧 TypeScript Check:" && npm run typecheck && echo "" && echo "🧪 Quick Test:" && npm run test && echo "" && echo "✅ 시스템 상태 점검 완료"
```
