# 워크플로우 갭 분석 (MECE 검증)

## 🚨 발견된 문제점

### 1. `/refactor`의 의존성 문제

**현재 상황:**

```typescript
// refactor-engine.ts:62
const cachedResults = this.loadInspectionCache();
```

**의미:**

- `/refactor`는 `inspection-results.json` 캐시에 **100% 의존**
- `/inspect` 없이는 실행 불가능
- TTL 5분 → 5분 지나면 `/refactor` 실패

**문제:**

```bash
# 시나리오: 주말 리팩토링
/radar      # OK - 10분 걸림
# 15분 후...
/refactor   # ❌ FAIL - inspection cache 없음!
```

---

### 2. `/inspect` vs `/radar` 중복

**`/inspect`가 검사하는 것:**

```typescript
// inspection-engine.ts:121-131
const checks = [
  "Prettier",
  "ESLint",
  "TypeScript",
  "Tests",
  "Security",
  "Architecture",
  "Workarounds", // TODO/FIXME
  "Documentation",
  "Refactoring", // refactoringQueue
];
```

**`/radar`가 검사하는 것:**

```typescript
// radar-engine.ts
1. 테스트되지 않은 Critical 파일
2. 거대 파일 (1000줄+) + 품질 영향 분석
3. Deprecated 파일 불일치
4. 불필요한 백업 파일
5. 중복 의존성
6. Dead code (unused exports)
7. 보안 취약점
8. Git 이슈
```

**중복 항목:**

- ✅ Security (둘 다 npm audit)
- ✅ Workarounds (둘 다 TODO/FIXME)
- ✅ Tests (inspect=실패, radar=커버리지)

**차이:**

- ❌ `/inspect`에는 없지만 `/radar`에만 있음:
  - 거대 파일 품질 분석
  - 중복 의존성
  - Dead code
  - Git 이슈

---

### 3. `/refactor` vs `/radar` 관계 불명확

**현재 MD 문서:**

```markdown
# radar.md

/radar → /refactor
발견 실행
```

**실제 코드:**

```typescript
// refactor-engine.ts:62
// /inspect 캐시를 읽음 (radar 아님!)
const cachedResults = this.loadInspectionCache();
```

**모순:**

- 문서: `/radar` → `/refactor`
- 코드: `/inspect` → `/refactor`

---

## 🎯 근본 원인

### 원인 1: 캐시 구조 불일치

```
/inspect → inspection-results.json (TTL 5분)
           ↓
           /maintain, /fix, /refactor 모두 이 캐시 의존

/radar → 출력만 (캐시 없음)
         ↓
         아무도 사용 안 함
```

### 원인 2: 역할 중복

두 명령어가 사실상 같은 역할:

- `/inspect`: 빠른 진단 (1-2분)
- `/radar`: 느린 진단 (5-10분)

하지만 **둘 다 진단만** 함!

---

## 💡 해결 방안 (3가지 옵션)

### 옵션 A: `/radar` 제거 (간단)

**변경:**

```bash
# Before
/inspect → /maintain → /fix → /ship
/radar → /refactor

# After
/inspect → /maintain → /fix → /refactor → /ship
```

**장점:**

- MECE 완벽
- 중복 제거
- 캐시 일관성

**단점:**

- 품질 영향 분석 손실
- 심층 스캔 불가능

**평가:** ❌ 너무 단순화

---

### 옵션 B: `/inspect`를 `/radar`로 통합 (중간)

**변경:**

```bash
# Before
/inspect (빠름) + /radar (느림)

# After
/inspect --quick   # 기본 (1-2분)
/inspect --deep    # /radar 수준 (5-10분)
```

**장점:**

- 명령어 하나로 통합
- 캐시 일관성
- 깊이 조절 가능

**단점:**

- `/radar` 브랜딩 손실
- 품질 영향 분석이 옵션에 묻힘

**평가:** ⚠️ 괜찮지만 아쉬움

---

### 옵션 C: 2-Track 시스템 (권장) ⭐

**설계:**

```
Track 1: Daily Development (빠름, 표면)
========================================
/inspect → /maintain → /fix → /ship
(5분)      (3분)      (10분)  (5분)

- inspection-results.json 캐시 (TTL: 5분)
- 즉시 해결 가능한 것만
- TypeScript, ESLint, TODO


Track 2: Weekly Cleanup (느림, 심층)
========================================
/radar → /refactor
(10분)    (1-2시간)

- radar-results.json 캐시 (TTL: 30분) ⭐
- 장기 부채, 아키텍처
- 품질 영향 분석, Dead code
```

**핵심 변경:**

1. **`/radar`에 캐시 추가:**

```typescript
// radar-engine.ts
interface RadarResults {
  timestamp: string;
  healthScore: number;
  p0Issues: Issue[];
  p1Issues: Issue[]; // 구조 문제
  p2Issues: Issue[]; // 품질 필수
  refactoringQueue: RefactorItem[]; // ⭐ 이게 핵심
}

// 저장
writeFileSync("reports/radar-results.json", JSON.stringify(results));
```

2. **`/refactor` 수정:**

```typescript
// refactor-engine.ts
private loadRefactoringQueue() {
  // 1순위: radar-results.json (30분 TTL)
  if (exists('radar-results.json') && !expired()) {
    return loadRadarCache().refactoringQueue;
  }

  // 2순위: inspection-results.json (5분 TTL)
  if (exists('inspection-results.json') && !expired()) {
    return loadInspectionCache().refactoringQueue;
  }

  throw new Error('Run /inspect or /radar first');
}
```

3. **역할 명확화:**

| 명령어      | 캐시                    | TTL  | 용도        | refactoringQueue |
| ----------- | ----------------------- | ---- | ----------- | ---------------- |
| `/inspect`  | inspection-results.json | 5분  | 일상 (표면) | 기본 항목        |
| `/radar`    | radar-results.json      | 30분 | 주간 (심층) | 품질 분석 포함   |
| `/maintain` | inspection 읽기         | -    | 자동 수정   | -                |
| `/fix`      | inspection 읽기         | -    | 수동 수정   | -                |
| `/refactor` | **radar 우선** 읽기     | -    | 구조 개선   | ✅               |

---

## 🎯 옵션 C 상세 설계

### `/inspect`가 생성하는 refactoringQueue

**범위:** 단순 구조 문제만

```typescript
interface InspectionRefactorItem {
  type: "duplicate-export" | "unused-import" | "config-drift";
  severity: "low" | "medium";
  file: string;
  fix: "auto" | "manual";
}
```

**예시:**

- 중복 export 10개
- Unused import 20개
- tsconfig.json vs tsconfig.build.json 차이

---

### `/radar`가 생성하는 refactoringQueue

**범위:** 품질 영향 분석 포함

```typescript
interface RadarRefactorItem {
  type: "large-file" | "dead-code" | "duplicate-dependency";
  severity: "P0" | "P1" | "P2";
  file: string;
  reason: string; // ⭐ 품질 영향 분석
  isQualityEssential: boolean; // ⭐
  fix: "auto" | "manual" | "review-needed";
}
```

**예시:**

- linguisticsEngineer.ts (P1) - 중복 boilerplate 다수
- domainConsultant.ts (P2) - 도메인 지식 포함 (품질 필수)

---

### `/refactor`의 우선순위 로직

```typescript
async loadRefactoringQueue() {
  // 1. radar cache 확인 (30분 TTL)
  const radarCache = this.loadRadarCache();
  if (radarCache && !radarCache.expired) {
    console.log('✅ Using radar-results.json (deep analysis)');

    // P2 (품질 필수) 필터링
    const safeItems = radarCache.refactoringQueue.filter(
      item => !item.isQualityEssential
    );

    return safeItems;
  }

  // 2. inspection cache 확인 (5분 TTL)
  const inspectionCache = this.loadInspectionCache();
  if (inspectionCache && !inspectionCache.expired) {
    console.log('⚠️  Using inspection-results.json (basic analysis)');
    console.log('💡 Run /radar for deep quality analysis');

    return inspectionCache.refactoringQueue;
  }

  // 3. 캐시 없음
  throw new Error('❌ No valid cache found. Run /inspect or /radar first');
}
```

---

## 📊 옵션 비교

| 항목             | 옵션 A (radar 제거) | 옵션 B (통합)  | 옵션 C (2-Track) |
| ---------------- | ------------------- | -------------- | ---------------- |
| MECE             | ✅                  | ✅             | ✅               |
| 간결성           | ✅                  | ✅             | ⚠️ 복잡          |
| 품질 영향 분석   | ❌ 손실             | ⚠️ 옵션에 묻힘 | ✅ 핵심 기능     |
| 캐시 일관성      | ✅                  | ✅             | ✅               |
| 명확한 역할 분리 | ⚠️ 하나만           | ⚠️ 플래그      | ✅ 2개 트랙      |
| `/refactor` 개선 | ❌                  | ⚠️             | ✅ P2 자동 필터  |
| 구현 난이도      | 쉬움                | 중간           | 어려움           |

---

## 🚀 최종 권장사항: 옵션 C (2-Track)

### 이유

1. **품질 분석이 핵심 가치**
   - 오늘 발견: 거대 파일을 무조건 리팩토링하면 품질 저하
   - `/radar`의 품질 영향 분석이 없으면 위험

2. **실제 사용 패턴 반영**
   - 매일: 빠른 체크 필요 (`/inspect`)
   - 주말: 심층 분석 필요 (`/radar`)

3. **`/refactor` 안전성 향상**
   - P2 (품질 필수) 자동 필터링
   - radar 캐시 사용 시 더 똑똑함

### 구현 우선순위

**Phase 1 (즉시):**

1. ✅ `radar-results.json` 캐시 구조 정의
2. ✅ `/radar`에 캐시 저장 로직 추가
3. ✅ `/refactor`에 radar 캐시 우선 읽기 추가

**Phase 2 (주말):**

1. ⬜ `/inspect`의 refactoringQueue 간소화
2. ⬜ `/radar`의 refactoringQueue 강화
3. ⬜ 통합 테스트

**Phase 3 (다음 주):**

1. ⬜ 문서 업데이트
2. ⬜ 사용자 가이드 작성

---

## 📋 남은 갭 체크리스트

- [ ] `/refactor`가 `/radar` 없이도 동작하는가? (inspection 캐시로)
- [ ] `/radar` 캐시가 expire되면? (inspection fallback)
- [ ] P2 항목을 `/refactor`가 자동 스킵하는가?
- [ ] TTL 30분이 적절한가?
- [ ] 두 캐시가 충돌하면?

---

_Last updated: 2025-10-03_
