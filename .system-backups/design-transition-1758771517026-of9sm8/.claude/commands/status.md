# /status - 시스템 상태 통합 대시보드

전체 프로젝트의 건강도와 상태를 한눈에 파악할 수 있는 통합 대시보드입니다.

## 사용법

```bash
/status                 # 전체 시스템 상태 체크
/status quick           # 빠른 상태 체크 (기존 방식)
/status detailed        # 상세 분석 포함
/status health          # 시스템 건강도만
```

## 📊 AI 강화 상태 체크

### 🔧 **코드 품질 상태**

- TypeScript 컴파일 상태 + 오류 패턴 분석
- ESLint 품질 + 자동 수정 가능 항목
- 테스트 커버리지 + 품질 트렌드
- 빌드 성공률 + 성능 메트릭

### 📚 **문서 품질 상태**

- 문서 커버리지 (features 대비)
- 문서 신선도 (코드 변경 대비)
- 구조 준수도 (표준 대비)
- LLM 최적화 태그 보유율

### 🤖 **AI 시스템 상태**

- Fix Engine 성공률 및 최근 수정
- 학습 데이터 신선도
- Refactor Advisor 제안 수
- 패턴 감지 및 학습 진행도

## 🎯 통합 상태 예시

```
🟢 SYSTEM HEALTH: GOOD (8.2/10)
================================
✅ TypeScript: PASS (0 errors)
✅ Tests: PASS (78% coverage)
🟡 Docs: 4 stale items
✅ AI Systems: Learning from 18 patterns

🔥 Quick Actions:
   • /fix → 자동 수정 가능한 오류 없음
   • npm run docs:audit → 문서 업데이트 필요
   • npm run advisor:suggest → 8개 개선 제안 대기
```

## 실행 (기존 호환성 유지)

```bash
# 🚀 NEW: Smart Status (AI-Enhanced)
tsx scripts/smart-status.ts

# Legacy: Quick mode (기존 방식)
echo "🔍 Git Status:" && git status --short && echo "" && echo "🔧 TypeScript Check:" && npm run ts:check && echo "" && echo "🧪 Quick Test:" && npm run test && echo "" && echo "📊 AI Status:" && npm run advisor:suggest && echo "" && echo "✅ 통합 시스템 상태 점검 완료"
```

**기존 `/status` 기능 + AI 인사이트가 결합된 통합 대시보드**로 업그레이드! 🚀📊
