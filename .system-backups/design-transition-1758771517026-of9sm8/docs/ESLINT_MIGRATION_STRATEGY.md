# ESLint 마이그레이션 전략

> **목적**: 1,309개의 ESLint 경고를 점진적으로 해결하는 현실적 전략

## 🚨 **현실 인식**

**현재 상황**: 1,309개 ESLint 경고/오류
**해결 전략**: 점진적 개선 (일시 해결 불가능)
**신규 개발자 영향**: 새 코드만 깨끗하게 유지하면 됨

## 🎯 **우선순위 기반 해결 전략**

### **P0 (즉시 차단, 0개)**

- TypeScript 컴파일 오류: ✅ **이미 해결됨** (0개)
- 빌드 실패 오류: ✅ **이미 해결됨**

### **P1 (신규 코드 품질 보장)**

```typescript
// 새로 작성하는 모든 코드는 다음 규칙 준수 필수
rules: {
  '@typescript-eslint/no-explicit-any': 'error',      // any 타입 금지
  'no-unused-vars': 'error',                          // 미사용 변수 금지
  'no-undef': 'error',                               // 정의되지 않은 변수 금지
}
```

### **P2 (기존 코드 점진적 개선)**

- **warning 수준**: 기존 코드는 경고만 표시
- **월별 목표**: 주당 1-2개 파일씩 개선
- **리팩토링 시**: 해당 파일의 ESLint 경고도 함께 해결

## 🛡️ **신규 개발자 보호 전략**

### **1. 새 파일 작성 시 - 엄격 적용**

```bash
# 새 파일은 반드시 ESLint 규칙 준수
npm run lint src/agents/newAgent.ts   # 개별 파일 검사
npm run lint:fix                      # 자동 수정 시도
```

### **2. 기존 파일 수정 시 - 점진적 개선**

```bash
# 기존 파일 수정 시 가능한 범위에서만 개선
# 예: qaGenerator.ts 수정 시 해당 파일의 any 타입만 수정
```

### **3. 전체 프로젝트 - 경고 무시**

```bash
# 전체 ESLint 실행 시 경고는 무시하고 에러만 체크
npm run lint 2>&1 | grep "error" | wc -l   # 에러 개수만 확인
```

## 📅 **점진적 개선 로드맵**

### **Phase 1: 신규 코드 품질 보장 (완료)**

- [x] 새 코드에 대한 엄격한 ESLint 규칙 적용
- [x] 자동화된 품질 검증 시스템
- [x] pre-commit hook 설정

### **Phase 2: 핵심 파일 우선 개선 (1개월)**

우선순위 파일들:

1. `src/core/baseAgent.ts` - 모든 에이전트의 기반
2. `src/shared/types.ts` - 전체 시스템 타입
3. `src/core/orchestrator.ts` - 핵심 오케스트레이션

### **Phase 3: 에이전트별 순차 개선 (3개월)**

월별 목표:

- **1개월**: qaGenerator.ts, qualityAuditor.ts
- **2개월**: promptArchitect.ts, cognitiveScientist.ts
- **3개월**: 나머지 4개 에이전트

### **Phase 4: 유틸리티 및 스크립트 정리 (지속적)**

- scripts/ 폴더는 낮은 우선순위
- 필요에 따라 점진적 개선

## 🔧 **실용적 해결 방법**

### **자동 수정 가능한 문제들**

```bash
# 1. nullish coalescing 자동 수정
npm run lint:fix   # 일부 자동 수정됨

# 2. 미사용 변수 제거
# 수동으로 제거하거나 언더스코어 접두사 사용: _unused
```

### **수동 수정 필요한 문제들**

```typescript
// 1. any 타입 제거
- function process(data: any)          // 나쁨
+ function process(data: AgentData)    // 좋음

// 2. 정의되지 않은 변수 수정
- if (process.env.NODE_ENV)            // 나쁨
+ if (process?.env?.NODE_ENV)          // 좋음
```

### **임시 억제 (최후 수단)**

```typescript
// 복잡한 레거시 코드에서만 사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyData: any = complexLegacyFunction();
```

## 📊 **진행 상황 추적**

### **주간 체크 명령어**

```bash
# ESLint 오류/경고 개수 추적
npm run lint 2>&1 | grep -c "error"    # 에러 개수
npm run lint 2>&1 | grep -c "warning"  # 경고 개수

# 개선 목표: 매주 경고 10-20개씩 감소
```

### **월간 리포트**

- 이번 달 해결한 파일 수
- 남은 경고 개수
- 새로 추가된 깨끗한 코드 라인 수

## 🎯 **성공 기준**

### **단기 목표 (1개월)**

- [x] 새 코드 ESLint 에러 0개 유지
- [ ] 핵심 3개 파일 ESLint 경고 80% 감소
- [x] 자동화 시스템 정상 작동

### **중기 목표 (3개월)**

- [ ] 전체 ESLint 경고 50% 감소 (650개 → 325개)
- [ ] 모든 에이전트 파일 경고 90% 해결
- [ ] 코드 품질 메트릭 개선

### **장기 목표 (6개월)**

- [ ] 전체 ESLint 경고 90% 감소 (130개 이하)
- [ ] 새 개발자 온보딩 시 ESLint 문제 0건
- [ ] 코드베이스 전체 품질 A등급

---

**🔑 핵심**: 신규 개발자는 기존 경고를 무시하고 새 코드만 깨끗하게 작성하면 됩니다.
**기존 1,309개 경고는 프로젝트 진행을 막지 않습니다.**
