# 파일 위치 가이드 - Trust Console Handoff (수정됨)

**프로젝트 루트**: `/Users/kyle/synthetic-text-agents-v2`

---

## ✅ 실제 존재하는 파일 경로 (검증 완료)

### 📂 핸드오프 문서 (방금 생성)

```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/HANDOFF_PACKAGE.md
open /Users/kyle/synthetic-text-agents-v2/HANDOFF_SNAPSHOT.md
open /Users/kyle/synthetic-text-agents-v2/FILE_LOCATIONS.md
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/HANDOFF_PACKAGE.md` ✅
- `/Users/kyle/synthetic-text-agents-v2/HANDOFF_SNAPSHOT.md` ✅
- `/Users/kyle/synthetic-text-agents-v2/FILE_LOCATIONS.md` ✅

---

### 📚 필수 구현 가이드

```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/docs/TRUST_CONSOLE_IMPLEMENTATION.md
open /Users/kyle/synthetic-text-agents-v2/docs/TRUST_INFRASTRUCTURE.md
open /Users/kyle/synthetic-text-agents-v2/docs/NEXT_ACTIONS.md
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/docs/TRUST_CONSOLE_IMPLEMENTATION.md` ✅
- `/Users/kyle/synthetic-text-agents-v2/docs/TRUST_INFRASTRUCTURE.md` ✅
- `/Users/kyle/synthetic-text-agents-v2/docs/NEXT_ACTIONS.md` ✅

---

### 📖 시스템 문서 (루트 디렉토리)

```bash
# 바로 열기 - 루트에 있는 파일들
open /Users/kyle/synthetic-text-agents-v2/CLAUDE.md
open /Users/kyle/synthetic-text-agents-v2/LLM_DEVELOPMENT_CONTRACT.md
open /Users/kyle/synthetic-text-agents-v2/DEVELOPMENT_STANDARDS.md
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/CLAUDE.md` ✅
- `/Users/kyle/synthetic-text-agents-v2/LLM_DEVELOPMENT_CONTRACT.md` ✅ (루트에 있음)
- `/Users/kyle/synthetic-text-agents-v2/DEVELOPMENT_STANDARDS.md` ✅ (루트에 있음)

---

### 📖 추가 개발 문서 (docs 디렉토리)

```bash
# 바로 열기 - docs에 있는 파일들
open /Users/kyle/synthetic-text-agents-v2/docs/DEVELOPMENT_STANDARDS.md
open /Users/kyle/synthetic-text-agents-v2/docs/llm_friendly_summary.md
open /Users/kyle/synthetic-text-agents-v2/docs/LLM_IO_CONVENTION.md
open /Users/kyle/synthetic-text-agents-v2/docs/TYPESCRIPT_GUIDELINES.md
open /Users/kyle/synthetic-text-agents-v2/docs/COMMAND_GUIDE.md
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/docs/DEVELOPMENT_STANDARDS.md` ✅ (docs에도 복사본 있음)
- `/Users/kyle/synthetic-text-agents-v2/docs/llm_friendly_summary.md` ✅
- `/Users/kyle/synthetic-text-agents-v2/docs/LLM_IO_CONVENTION.md` ✅
- `/Users/kyle/synthetic-text-agents-v2/docs/TYPESCRIPT_GUIDELINES.md` (확인 필요)
- `/Users/kyle/synthetic-text-agents-v2/docs/COMMAND_GUIDE.md` (확인 필요)

---

## 💻 백엔드 코드 (Trust Infrastructure - 완료됨)

### Trust Token Layer (P0)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-generator.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-verifier.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-types.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/index.ts
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-generator.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-verifier.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-types.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/src/core/trust/index.ts` ✅

### Evidence Store (P1)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/src/core/transparency/evidence-store.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/transparency/evidence-types.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/transparency/index.ts
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/src/core/transparency/evidence-store.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/src/core/transparency/evidence-types.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/src/core/transparency/index.ts` ✅

### Telemetry Interpreter (P2-1)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/src/core/telemetry/telemetry-interpreter.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/telemetry/telemetry-types.ts
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/src/core/telemetry/telemetry-interpreter.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/src/core/telemetry/telemetry-types.ts` ✅

### Snapshot Logger (P2-3)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/snapshot-logger.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/snapshot-types.ts
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/src/core/trust/snapshot-logger.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/src/core/trust/snapshot-types.ts` ✅

### Gate E - Explanation Stability (P2-2)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/src/core/transparency/explanation-cache.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/transparency/explanation-validator.ts
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/src/core/transparency/explanation-cache.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/src/core/transparency/explanation-validator.ts` ✅

---

## 🌐 프론트엔드 (구현 대상 - TODO)

### API Routes 디렉토리
```bash
# 디렉토리 확인
ls -la /Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/

# 예상 출력:
# actions/       (빈 디렉토리)
# compliance/    (빈 디렉토리)
# evidence/      (빈 디렉토리)
# telemetry/     (빈 디렉토리)
# token/         (빈 디렉토리)
```

**구현할 파일 경로** (TODO):
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/route.ts` ⏳
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/evidence/route.ts` ⏳
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/compliance/route.ts` ⏳
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/telemetry/route.ts` ⏳
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/snapshot/route.ts` ⏳

### UI Components 디렉토리
```bash
# 디렉토리 생성 (아직 없음)
mkdir -p /Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components
cd /Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust
```

**구현할 파일 경로** (TODO):
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/page.tsx` ⏳
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components/TrustBadge.tsx` ⏳
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components/EvidenceViewer.tsx` ⏳
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components/ComplianceBadge.tsx` ⏳
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components/ActionButtons.tsx` ⏳
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components/AuditTimeline.tsx` ⏳

### 참고용 기존 컴포넌트
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/apps/fe-web/components/ui/button.tsx
open /Users/kyle/synthetic-text-agents-v2/apps/fe-web/components/ui/badge.tsx
open /Users/kyle/synthetic-text-agents-v2/apps/fe-web/components/ui/card.tsx
```

### 참고용 기존 API Route
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/expert-feedback/route.ts
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/expert-feedback/route.ts` ✅

---

## 🧪 테스트 파일

### 기존 Trust Infrastructure 테스트 (완료)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/tests/core/trust/trust-token.test.ts
open /Users/kyle/synthetic-text-agents-v2/tests/core/trust/snapshot-logger.test.ts
open /Users/kyle/synthetic-text-agents-v2/tests/core/transparency/evidence-store.test.ts
open /Users/kyle/synthetic-text-agents-v2/tests/core/telemetry/telemetry-interpreter.test.ts
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/tests/core/trust/trust-token.test.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/tests/core/trust/snapshot-logger.test.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/tests/core/transparency/evidence-store.test.ts` ✅
- `/Users/kyle/synthetic-text-agents-v2/tests/core/telemetry/telemetry-interpreter.test.ts` ✅

### 구현할 테스트 (TODO)
- `/Users/kyle/synthetic-text-agents-v2/tests/integration/trust-console-api.test.ts` ⏳
- `/Users/kyle/synthetic-text-agents-v2/tests/e2e/trust-console.spec.ts` ⏳

---

## ⚙️ 설정 파일

### Next.js (Frontend)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/apps/fe-web/package.json
open /Users/kyle/synthetic-text-agents-v2/apps/fe-web/tsconfig.json
open /Users/kyle/synthetic-text-agents-v2/apps/fe-web/next.config.js
open /Users/kyle/synthetic-text-agents-v2/apps/fe-web/tailwind.config.ts
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/package.json` ✅
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/tsconfig.json` ✅
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/next.config.js` ✅
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/tailwind.config.ts` ✅

### 프로젝트 루트
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/package.json
open /Users/kyle/synthetic-text-agents-v2/tsconfig.json
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/package.json` ✅
- `/Users/kyle/synthetic-text-agents-v2/tsconfig.json` ✅

---

## 🎯 RTF 파일 → 실제 Markdown 파일 매핑

스크린샷의 RTF 파일들은 아래 Markdown 파일의 복사본입니다:

```bash
claude.md_1006.rtf                  → /Users/kyle/synthetic-text-agents-v2/CLAUDE.md
llm_development_contract_1006.rtf   → /Users/kyle/synthetic-text-agents-v2/LLM_DEVELOPMENT_CONTRACT.md
development_standard_1006.rtf       → /Users/kyle/synthetic-text-agents-v2/DEVELOPMENT_STANDARDS.md
llm_friendly_1006.rtf               → /Users/kyle/synthetic-text-agents-v2/docs/llm_friendly_summary.md
package_jason_1006.rtf              → /Users/kyle/synthetic-text-agents-v2/package.json (또는 apps/fe-web/package.json)
```

**⚠️ 중요**: RTF 파일 대신 **원본 Markdown 파일**을 사용하세요!

---

## 🚀 빠른 시작 스크립트

### 원라이너: 모든 핵심 문서 열기
```bash
\
open HANDOFF_PACKAGE.md && \
open docs/TRUST_CONSOLE_IMPLEMENTATION.md && \
open docs/TRUST_INFRASTRUCTURE.md && \
open CLAUDE.md && \
open LLM_DEVELOPMENT_CONTRACT.md
```

### VS Code로 프로젝트 열기
```bash
cd /Users/kyle/synthetic-text-agents-v2
code .
```

### 현재 상태 확인
```bash
cd /Users/kyle/synthetic-text-agents-v2
git status
npm test
```

---

## 📋 복사 가능한 디렉토리 트리

```
/Users/kyle/synthetic-text-agents-v2/
│
├── HANDOFF_PACKAGE.md              ← 핸드오프 가이드
├── HANDOFF_SNAPSHOT.md             ← 현재 상태 스냅샷
├── FILE_LOCATIONS_CORRECTED.md     ← 이 파일 (수정됨)
├── CLAUDE.md                       ← 시스템 철학
├── LLM_DEVELOPMENT_CONTRACT.md     ← 개발 계약 (루트에 있음!)
├── DEVELOPMENT_STANDARDS.md        ← 개발 표준 (루트에 있음!)
│
├── docs/
│   ├── TRUST_CONSOLE_IMPLEMENTATION.md  ← 구현 가이드
│   ├── TRUST_INFRASTRUCTURE.md          ← 기술 문서
│   ├── NEXT_ACTIONS.md                  ← 현재 작업
│   ├── DEVELOPMENT_STANDARDS.md         ← (docs에도 복사본)
│   ├── llm_friendly_summary.md          ← LLM 친화적 요약
│   └── LLM_IO_CONVENTION.md             ← LLM I/O 규약
│
├── src/core/
│   ├── trust/                      ← P0, P2-3 (완료)
│   ├── transparency/               ← P1, P2-2 (완료)
│   └── telemetry/                  ← P2-1 (완료)
│
├── apps/fe-web/
│   ├── app/
│   │   ├── api/trust/              ← API 구현 위치 (TODO)
│   │   └── trust/                  ← UI 구현 위치 (TODO)
│   └── components/ui/              ← 기존 UI 컴포넌트 (참고용)
│
└── tests/
    └── core/                       ← 기존 테스트 (842/842 passing)
```

---

**생성일**: 2025-10-08 23:50 KST
**수정 사항**: 실제 파일 경로 검증 및 수정
**용도**: 핸드오프 시 정확한 파일 위치 참조
