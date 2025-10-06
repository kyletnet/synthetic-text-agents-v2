# 🎛️ Command Directory - 전체 명령어 가이드

현재 프로젝트에 **49개의 npm 스크립트**와 **8개의 슬래시 명령어**가 있습니다.
**언제 무엇을 사용해야 하는지** 명확한 가이드를 제공합니다.

## 📋 핵심 워크플로우별 명령어

### 🚀 **일상 개발 워크플로우**

```bash
# 1. 개발 시작
npm run dev                    # 데모 실행
npm run build                  # TypeScript 컴파일
npm run test                   # 테스트 실행

# 2. 코드 품질 체크
npm run ci:quality             # 전체 품질 체크 (typecheck + lint + test)
npm run lint:fix               # 자동 수정 가능한 것들 수정

# 3. 빠른 실행
npm run run:min                # 최소 QA 생성 루프 실행
npm run smoke                  # 오프라인 스모크 테스트
```

### 📚 **문서 관리 워크플로우**

```bash
# 📊 문서 품질 감사 (새로운 핵심 기능!)
npm run docs:audit             # 종합 문서 품질 분석
npm run docs:gate              # 품질 게이트 (릴리스 차단)
npm run docs:lint              # 문서 구조 검증

# 🧩 LLM 최적화 (새로운 기능!)
npm run docs:signals:inject    # RAG/LLM 최적화 태그 삽입
npm run docs:signals:validate  # 태그 무결성 검증

# 📄 기본 문서 관리
npm run docs:refresh           # 문서 자동 생성/업데이트
npm run docs:systemmap        # 시스템 아키텍처 맵 생성
```

### 🔧 **리팩토링 & 품질 관리**

```bash
# 🧠 스마트 리팩토링 (핵심!)
npm run refactor:audit         # 전체 코드베이스 리팩토링 분석
npm run refactor:summary       # 현재 상태 요약
npm run refactor:next          # 다음 할 일 제시

# 🔧 TypeScript 문제 해결 (새로운 기능!)
npm run ts:check               # 컴파일 오류 → 리팩토링 추천
npm run ts:issues              # 오류를 리팩토링 이슈로 변환

# ✅ 배포 준비
npm run ship                   # 전체 검증 + 배포 준비
npm run ship:fast             # 빠른 배포 검증
```

### 🧪 **테스트 & 검증**

```bash
# 🔍 품질 게이트 (CI/CD용)
npm run ci:strict              # 엄격한 품질 검증
npm run guard:all              # 모든 안전장치 확인

# 📊 메트릭 & 리포팅
npm run report:baseline        # 품질 기준선 리포트
npm run verify:obs            # 관찰성 일관성 검증
```

---

## 🎯 **상황별 명령어 가이드**

### ❓ **"뭔가 이상한데 뭐부터 확인해야 할까?"**

```bash
npm run ci:quality             # 기본 품질 체크
npm run ts:check               # TypeScript 오류 → 수정 가이드
npm run refactor:audit         # 구조적 문제 분석
```

### ❓ **"문서가 최신인지 확인하고 싶다"**

```bash
npm run docs:audit             # 문서 신선도 + 커버리지 분석
npm run docs:freshness         # 오래된 문서 찾기
```

### ❓ **"배포하기 전에 모든게 괜찮은지 확인하고 싶다"**

```bash
npm run ship                   # 전체 검증 + 품질 게이트
npm run docs:gate              # 문서 품질 차단 체크
```

### ❓ **"코드 품질을 개선하고 싶다"**

```bash
npm run refactor:audit         # 개선점 찾기
npm run refactor:summary       # 현재 상태 파악
npm run refactor:next          # 구체적 다음 액션
```

---

## 🚨 **절대 사용하지 말아야 할 명령어들**

```bash
# ❌ 이런 명령어들은 혼란만 가중시킴
npm run docs:coverage          # → docs:audit 사용
npm run docs:freshness         # → docs:audit 사용
npm run baseline:tsnode        # → dev 사용
npm run demo                   # → dev 사용
```

---

## 📖 **슬래시 명령어 (Claude Code)**

```bash
/doc-audit                     # 문서 품질 종합 감사
/doc-gate                      # 문서 품질 게이트
/llm-signals                   # LLM 최적화 시그널링
/refactor-audit                # 리팩토링 감사
/sync                          # Git 동기화
```

---

## 🎛️ **명령어 우선순위별 분류**

### 🟢 **Daily Use (매일 사용)**

- `npm run dev`, `npm run build`, `npm run ci:quality`
- `npm run docs:audit`, `npm run refactor:audit`

### 🟡 **Weekly Use (주간 사용)**

- `npm run ship`, `npm run docs:gate`
- `npm run refactor:summary`, `npm run guard:all`

### 🔵 **As Needed (필요시만)**

- `npm run docs:signals:inject`, `npm run ts:check`
- `npm run verify:*`, `npm run baseline:*`

### 🔴 **Deprecated/Redundant (사용 중단 권장)**

- `npm run demo` → `npm run dev`
- `npm run docs:coverage` → `npm run docs:audit`
- `npm run baseline:tsnode` → `npm run dev`

---

## 🎯 **핵심 개선사항 (이번 작업)**

### ✅ **새로 추가된 핵심 기능**

1. **🔧 TypeScript 오류 → 리팩토링 추천**

   - `npm run ts:check` - 컴파일 오류를 구체적 수정 가이드로 변환

2. **📚 문서 품질 게이트**

   - `npm run docs:gate` - 릴리스 차단 기준 적용
   - Coverage < 80%, Stale > 7days 등 기준으로 배포 차단

3. **🧩 LLM 최적화 시그널링**
   - `npm run docs:signals:inject` - RAG/LLM 최적화 태그 자동 삽입

### 🎯 **권장 통합 워크플로우**

```bash
# 매일 개발 시작할 때
npm run ci:quality && npm run docs:audit

# 배포 준비할 때
npm run ship && npm run docs:gate

# 문제 해결할 때
npm run ts:check && npm run refactor:audit
```

---

**결론**: 49개 명령어 → **핵심 10개만 기억하면 됨** 🎯
