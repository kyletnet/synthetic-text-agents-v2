---
description: Deep technical debt discovery (Weekly/Pre-Release) - Detection only, no fixes
allowed-tools: Bash(npx tsx scripts/radar-engine.ts)
---

# /radar - Deep Technical Debt Discovery

**장기 부채 발견 전용 (수정은 안 함)**

주 1회 또는 큰 변경 전에 실행하여 숨겨진 기술 부채를 발견합니다.

## 🎯 `/radar`의 역할

**발견만 하고 수정은 안 합니다!**

- ✅ 심층 스캔으로 숨겨진 문제 발견
- ✅ 품질 영향 분석 (거대 파일이 왜 큰지 판단)
- ✅ 우선순위 분류 (P0/P1/P2)
- ❌ 수정은 `/refactor`에서 처리

## 📊 `/inspect` vs `/radar`

| 항목            | `/inspect` (매일) | `/radar` (주 1회)   |
| --------------- | ----------------- | ------------------- |
| 목적            | 일상 체크         | 심층 탐지           |
| TypeScript 에러 | ✅                | ✅                  |
| TODO/FIXME      | ✅                | ✅ + 패턴 분석      |
| 거대 파일       | ❌                | ✅ + 품질 영향 분석 |
| 중복 의존성     | ❌                | ✅                  |
| Dead code       | ❌                | ✅                  |
| 테스트 커버리지 | 실패만            | 갭 분석             |
| 실행 시간       | 1-2분             | 5-10분              |

## 🔍 검사 항목

**`/inspect`보다 훨씬 깊게:**

1. **테스트 커버리지 갭**
   - 핵심 파일 중 테스트 없는 것
   - 커버리지 0% 파일

2. **거대 파일 분석 + 품질 영향**
   - 1000줄+ 파일 감지
   - 도메인 지식 vs 구조 문제 구분
   - P1 (리팩토링 권장) vs P2 (품질 필수)

3. **중복 의존성**
   - package-lock.json 전체 분석
   - 버전 충돌 위험 감지

4. **사용되지 않는 코드**
   - Unused exports
   - Dead code 패턴

5. **보안 취약점**
   - npm audit 전체 스캔

6. **워크어라운드 패턴**
   - TODO/FIXME/HACK
   - 패턴 분석

## 💡 핵심 기능: 품질 영향 분석

**거대 파일을 똑똑하게 판단:**

```
[P1] 11개의 거대 파일 (리팩토링 권장)
  - linguisticsEngineer.ts - 중복 코드 다수
  - backupSystem.ts - boilerplate 다수
  → 실제 구조 문제

[P2] 2개의 거대 파일 (품질 유지 필요) ⭐
  - domainConsultant.ts - 도메인 지식 데이터 (QA 품질 필수)
  - psychologySpecialist.ts - 심리 분석 로직 (품질 필수)
  → 신중한 검토 후에만 리팩토링
```

**P2는 리팩토링하면 품질 저하 위험!**

## 📋 사용 시나리오

### 시나리오 1: 주말 기술 부채 정리

```bash
/radar      # 심층 스캔 (10분)
# 결과 확인 → P1 항목 11개 발견

/refactor   # P1 항목 처리 (1시간)
/inspect    # 검증
```

### 시나리오 2: 릴리즈 전 점검

```bash
/radar      # 전체 스캔
# P0 있으면 즉시 수정
# P1 있으면 /refactor 고려
# P2는 그대로 유지 (품질 필수)
```

## 📊 출력 예시

```
🎯 Health Score: 75/100

📋 Summary:
  Total Issues: 4
  🔴 P0 Critical: 0
  🟡 P1 High: 1
  🟢 P2 Medium: 3

🔍 Critical Issues:

  [P1] Code Structure: 11개의 거대 파일 (리팩토링 권장)
  Impact: 유지보수성 저하
  Files:
    - linguisticsEngineer.ts (1003 lines) - 중복 boilerplate
  💡 Fix: 모듈 분리 → /refactor로 처리

  [P2] Code Structure: 2개의 거대 파일 (품질 유지 필요)
  Impact: 도메인 지식/품질 필수
  Files:
    - domainConsultant.ts (1522 lines) - 도메인 지식 포함
  💡 Fix: 신중한 검토 후에만 리팩토링 (품질 영향 확인 필수)

🚀 Recommended Actions:
  1. [HIGH] P1 이슈 1주일 내 해결
  2. Run `/refactor` to address structural issues
```

## 🔄 올바른 워크플로우

```bash
# Phase 1: 일상 개발 (매일)
/inspect → /maintain → /fix → /ship

# Phase 2: 장기 부채 정리 (주 1회)
/radar → /refactor
   ↓        ↓
  발견     실행
```

## ⚠️ 주의사항

1. **수정하지 마세요**
   - `/radar`는 발견만
   - 수정은 `/refactor` 또는 `/fix`

2. **P2 항목 신중히**
   - P2 = 품질 필수 파일
   - 함부로 리팩토링하면 기능 저하

3. **빈도**
   - 매일 실행 금지 (너무 느림)
   - 주 1회 또는 릴리즈 전만

## 📌 다음 단계

Radar 실행 후:

1. **P0 있음** → 즉시 `/fix`로 수정
2. **P1 많음** → `/refactor`로 구조 개선 계획
3. **P2만 있음** → 그대로 유지 (품질 필수)

**중요:** `/radar`는 **발견 도구**입니다. 수정은 `/refactor`!

_Last updated: 2025-10-03_
