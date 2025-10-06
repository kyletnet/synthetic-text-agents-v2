# `/radar` 필요성 냉정 분석

## 📊 현황

### 역사

- **2일 전 (Oct 2)**: `/audit` → `/radar` 이름 변경
- **오늘 (Oct 3)**: 품질 영향 분석 로직 추가

### 현재 `/radar`가 하는 일

```typescript
1. ✅ 테스트 커버리지 갭 분석 (0% 파일 찾기)
2. ✅ 거대 파일 + 품질 영향 분석 ⭐ (오늘 추가)
3. ✅ 중복 의존성
4. ✅ Unused exports
5. ✅ 보안 취약점
6. ✅ Git 이슈
```

### `/inspect`가 하는 일

```typescript
1. TypeScript 에러
2. ESLint/Prettier
3. Tests (실패만)
4. Security audit
5. TODO/FIXME
6. Documentation
7. RefactoringQueue
```

---

## 🤔 핵심 질문: `/radar` 필요한가?

### 중복 검사

| 항목           | `/inspect` | `/radar` | 차이점          | 중복?    |
| -------------- | ---------- | -------- | --------------- | -------- |
| Security       | ✅         | ✅       | 둘 다 npm audit | **중복** |
| Tests          | 실패만     | 커버리지 | 다른 관점       | 보완     |
| TODO/FIXME     | ✅         | ❌       | inspect만       | 아님     |
| TypeScript     | ✅         | ❌       | inspect만       | 아님     |
| 거대 파일      | ❌         | ✅       | radar만         | 아님     |
| 중복 의존성    | ❌         | ✅       | radar만         | 아님     |
| Unused exports | ❌         | ✅       | radar만         | 아님     |

### 결론 1: 중복은 거의 없음

---

## 💡 `/radar`만의 차별화된 가치

### 1. 품질 영향 분석 ⭐⭐⭐ (오늘 추가)

**문제:**

```
domainConsultant.ts (1522줄)
→ 무조건 리팩토링 대상? ❌
```

**해결:**

```typescript
analyzeFileQualityImpact() {
  // 도메인 지식 데이터 패턴 감지
  // → P2 (품질 필수) 분류
  // → 리팩토링하면 품질 저하!
}
```

**가치:** **이것만으로도 충분히 가치 있음!**

### 2. 심층 스캔 (시간 투자)

- `/inspect`: 1-2분 (빠른 체크)
- `/radar`: 5-10분 (전체 스캔)

**차이:**

- 커버리지 리포트 생성 + 전체 분석
- package-lock.json 전체 파싱
- ts-prune 실행 (느림)

### 3. 다른 관점

| 명령어     | 관점             | 질문                          |
| ---------- | ---------------- | ----------------------------- |
| `/inspect` | "지금 고장났나?" | TypeScript 에러? 테스트 실패? |
| `/radar`   | "숨겨진 부채?"   | 커버리지 갭? Dead code?       |

---

## ⚖️ 필요성 판단 기준

### 케이스 A: `/radar` 없다면?

**문제 발생 시나리오:**

1. **거대 파일 무분별 리팩토링**

   ```
   domainConsultant.ts (1522줄) 발견
   → /inspect는 이걸 못 봄
   → 수동으로 리팩토링 시도
   → 1300줄 도메인 지식 삭제
   → QA 품질 저하
   ```

   **결과:** ❌ 오늘 실제로 발생함!

2. **커버리지 갭 발견 불가**

   ```
   src/shared/ 핵심 파일들
   → /inspect는 테스트 실패만 봄
   → 0% 커버리지 파일 발견 못 함
   → 기술 부채 누적
   ```

3. **중복 의존성 미탐지**
   ```
   40개 중복 패키지
   → /inspect는 안 봄
   → 번들 크기 증가
   → 버전 충돌 위험
   ```

### 케이스 B: `/radar` 있다면?

**장점:**

- ✅ 품질 영향 분석 (P2 자동 분류)
- ✅ 커버리지 갭 조기 발견
- ✅ Dead code 정기 청소
- ✅ 중복 의존성 관리

**단점:**

- ⚠️ 명령어 하나 더 배워야 함
- ⚠️ `/inspect`와 역할 혼동 가능
- ⚠️ `/refactor` 통합 필요 (갭 존재)

---

## 🎯 냉정한 결론

### 시나리오별 판단

#### 시나리오 1: `/radar` 완전 제거

**변경:**

```bash
# 품질 영향 분석을 /inspect에 통합
/inspect --deep  # radar 기능 포함
```

**pros:**

- ✅ 명령어 단순화
- ✅ 역할 혼동 없음
- ✅ 캐시 통합

**cons:**

- ❌ 품질 분석이 옵션에 묻힘
- ❌ "심층 스캔" 개념 손실
- ❌ 5-10분 걸리는 분석이 기본 `/inspect`를 느리게 만듦

**평가:** ⚠️ 가능하지만 아쉬움

---

#### 시나리오 2: `/radar` 유지 + 갭 해결

**변경:**

```bash
# radar-results.json 캐시 추가
/radar → radar-results.json → /refactor가 읽음
```

**pros:**

- ✅ 품질 영향 분석 유지
- ✅ 역할 명확 (Daily vs Weekly)
- ✅ `/refactor` P2 자동 필터링

**cons:**

- ⚠️ 구현 필요
- ⚠️ 명령어 2개

**평가:** ✅ 최선

---

#### 시나리오 3: `/inspect` 확장

**변경:**

```typescript
// inspection-engine.ts
async runDiagnostics(mode: 'quick' | 'deep') {
  if (mode === 'deep') {
    await this.analyzeFileQuality();  // radar 로직
    await this.scanCoverageGaps();
    await this.findDuplicateDeps();
  }
}
```

```bash
/inspect        # 기본 (1-2분)
/inspect --deep # radar 수준 (5-10분)
```

**pros:**

- ✅ 명령어 하나
- ✅ 캐시 자동 통합
- ✅ 역할 명확

**cons:**

- ⚠️ `/inspect`가 너무 커짐
- ⚠️ "radar" 브랜딩 손실

**평가:** ✅ 차선책

---

## 📊 최종 판단 매트릭스

| 기준                | 제거        | 유지+갭해결 | inspect통합 |
| ------------------- | ----------- | ----------- | ----------- |
| **필요성**          |             |             |             |
| 품질 영향 분석 유지 | ❌          | ✅          | ✅          |
| 커버리지 갭 분석    | ❌          | ✅          | ✅          |
| 중복 의존성 관리    | ❌          | ✅          | ✅          |
| **단순성**          |             |             |             |
| 명령어 개수         | ✅ 1개 감소 | ⚠️ 유지     | ✅ 1개 감소 |
| 역할 혼동           | ✅          | ✅          | ⚠️          |
| 학습 곡선           | ✅          | ⚠️          | ✅          |
| **구현**            |             |             |             |
| 구현 난이도         | ✅ 쉬움     | ⚠️ 중간     | ⚠️ 중간     |
| 캐시 일관성         | ✅          | ⚠️ 수정필요 | ✅          |
| **시스템 설계**     |             |             |             |
| MECE                | ✅          | ✅          | ✅          |
| 관심사 분리         | ⚠️          | ✅          | ⚠️          |
| 확장성              | ❌          | ✅          | ⚠️          |

---

## 🎯 최종 권장: 시나리오 3 (inspect 통합)

### 이유

1. **실제 사용 패턴**

   ```bash
   # 대부분의 경우
   /inspect → /maintain → /fix → /ship

   # 가끔 (주 1회)
   /inspect --deep → /refactor
   ```

2. **품질 분석은 필수**

   - 오늘 증명됨: 품질 영향 분석 없으면 위험
   - 하지만 별도 명령어일 필요는 없음

3. **단순성 > 완벽한 분리**
   - 개발자가 배울 명령어: 4개면 충분
   - `/radar`는 역할이 애매함

### 구현 제안

```typescript
// inspection-engine.ts
class InspectionEngine {
  async runFullInspection(options: {
    mode?: "quick" | "deep"; // default: 'quick'
  }) {
    // 기본 체크 (항상)
    await this.checkTypeScript();
    await this.checkESLint();
    await this.checkTests();

    // 심층 체크 (--deep 플래그 시)
    if (options.mode === "deep") {
      console.log("🔍 Deep inspection mode - analyzing quality impact...");

      await this.analyzeFileQuality(); // radar 로직
      await this.scanCoverageGaps(); // radar 로직
      await this.findDuplicateDeps(); // radar 로직
      await this.scanUnusedExports(); // radar 로직
    }
  }
}
```

```bash
# package.json
{
  "scripts": {
    "inspect": "tsx scripts/inspection-engine.ts",
    "inspect:deep": "tsx scripts/inspection-engine.ts --deep",
    "/inspect": "tsx scripts/inspection-engine.ts",
    "/inspect --deep": "tsx scripts/inspection-engine.ts --deep"
  }
}
```

### 마이그레이션

```bash
# Before
/radar → /refactor

# After
/inspect --deep → /refactor
```

---

## 🚫 `/radar` 제거 체크리스트

- [ ] `analyzeFileQuality()` → inspection-engine.ts 이동
- [ ] `scanCoverageGaps()` → inspection-engine.ts 이동
- [ ] `findDuplicateDeps()` → inspection-engine.ts 이동
- [ ] `--deep` 플래그 추가
- [ ] radar-engine.ts 삭제
- [ ] .claude/commands/radar.md 삭제
- [ ] package.json에서 radar 스크립트 제거
- [ ] 문서 업데이트

---

## 💭 반론 검토

### "하지만 radar는 브랜딩이 좋은데?"

**답변:**

- 브랜딩 < 단순성
- `/inspect --deep`도 충분히 명확
- "심층 검사"라는 의미 전달됨

### "하지만 Track 1/2 분리가 깔끔한데?"

**답변:**

- 이론적으로는 맞음
- 실제로는 대부분 `/inspect`만 씀
- `/radar`를 따로 실행할 이유가 약함

### "하지만 오늘 품질 분석 추가했는데 삭제?"

**답변:**

- 품질 분석 로직은 유지 (inspection에 통합)
- 삭제하는 건 별도 명령어일 뿐
- 기능은 그대로, 위치만 변경

---

## 🎯 결론

**`/radar` 제거하고 `/inspect --deep`로 통합**

**이유:**

1. 실제 사용 빈도 낮음 (주 1회)
2. `/inspect`와 역할 중복
3. 품질 분석은 필수지만 별도 명령어는 과함
4. 단순성 > 완벽한 분리

**하지만:**

- 품질 영향 분석 로직은 **반드시 유지**
- `--deep` 플래그로 접근성 보장
- `/refactor`는 deep inspection 캐시 읽기

---

_Last updated: 2025-10-03_
