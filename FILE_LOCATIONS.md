# 파일 위치 가이드 - Trust Console Handoff

**프로젝트 루트**: `/Users/kyle/synthetic-text-agents-v2`

---

## 📂 핸드오프 문서 (방금 생성됨)

### 바로 열기 명령어
```bash
cd /Users/kyle/synthetic-text-agents-v2

# 핸드오프 패키지
open HANDOFF_PACKAGE.md
open HANDOFF_SNAPSHOT.md
open FILE_LOCATIONS.md
```

### 파일 경로
- `/Users/kyle/synthetic-text-agents-v2/HANDOFF_PACKAGE.md`
- `/Users/kyle/synthetic-text-agents-v2/HANDOFF_SNAPSHOT.md`
- `/Users/kyle/synthetic-text-agents-v2/FILE_LOCATIONS.md`

---

## 📚 필수 문서

### 구현 가이드 (최우선)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/docs/TRUST_CONSOLE_IMPLEMENTATION.md
open /Users/kyle/synthetic-text-agents-v2/docs/TRUST_INFRASTRUCTURE.md
open /Users/kyle/synthetic-text-agents-v2/docs/NEXT_ACTIONS.md
```

### 파일 경로
- `/Users/kyle/synthetic-text-agents-v2/docs/TRUST_CONSOLE_IMPLEMENTATION.md`
- `/Users/kyle/synthetic-text-agents-v2/docs/TRUST_INFRASTRUCTURE.md`
- `/Users/kyle/synthetic-text-agents-v2/docs/NEXT_ACTIONS.md`

### 시스템 철학
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/CLAUDE.md
open /Users/kyle/synthetic-text-agents-v2/docs/DEVELOPMENT_STANDARDS.md
open /Users/kyle/synthetic-text-agents-v2/docs/LLM_DEVELOPMENT_CONTRACT.md
open /Users/kyle/synthetic-text-agents-v2/docs/HANDOFF_NAVIGATION.md
```

---

## 💻 백엔드 코드 (Trust Infrastructure)

### Trust Token Layer (P0)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-generator.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-verifier.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-types.ts
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-generator.ts`
- `/Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-verifier.ts`
- `/Users/kyle/synthetic-text-agents-v2/src/core/trust/trust-token-types.ts`

### Evidence Store (P1)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/src/core/transparency/evidence-store.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/transparency/evidence-types.ts
```

**파일 경로**:
- `/Users/kyle/synthetic-text-agents-v2/src/core/transparency/evidence-store.ts`
- `/Users/kyle/synthetic-text-agents-v2/src/core/transparency/evidence-types.ts`

### Telemetry Interpreter (P2-1)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/src/core/telemetry/telemetry-interpreter.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/telemetry/telemetry-types.ts
```

### Snapshot Logger (P2-3)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/snapshot-logger.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/trust/snapshot-types.ts
```

### Gate E - Explanation Stability (P2-2)
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/src/core/transparency/explanation-cache.ts
open /Users/kyle/synthetic-text-agents-v2/src/core/transparency/explanation-validator.ts
open /Users/kyle/synthetic-text-agents-v2/src/domain/preflight/gate-e-explanation-stability.ts
```

---

## 🌐 프론트엔드 (구현 대상)

### API Routes (TO DO)
```bash
# 디렉토리 이동
cd /Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust

# 구현할 파일 목록
ls -la
# → route.ts (TODO)
# → evidence/route.ts (TODO)
# → compliance/route.ts (TODO)
# → telemetry/route.ts (TODO)
# → snapshot/route.ts (TODO)
```

**파일 경로** (구현 예정):
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/route.ts`
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/evidence/route.ts`
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/compliance/route.ts`
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/telemetry/route.ts`
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/api/trust/snapshot/route.ts`

### UI Components (TO DO)
```bash
# 디렉토리 이동 (생성 필요)
mkdir -p /Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components
cd /Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust
```

**파일 경로** (구현 예정):
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/page.tsx`
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components/TrustBadge.tsx`
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components/EvidenceViewer.tsx`
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components/ComplianceBadge.tsx`
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components/ActionButtons.tsx`
- `/Users/kyle/synthetic-text-agents-v2/apps/fe-web/app/trust/components/AuditTimeline.tsx`

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

---

## 🧪 테스트 파일

### 기존 Trust Infrastructure 테스트
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/tests/core/trust/trust-token.test.ts
open /Users/kyle/synthetic-text-agents-v2/tests/core/trust/snapshot-logger.test.ts
open /Users/kyle/synthetic-text-agents-v2/tests/core/transparency/evidence-store.test.ts
open /Users/kyle/synthetic-text-agents-v2/tests/core/telemetry/telemetry-interpreter.test.ts
```

### 구현할 테스트 (TO DO)
- `/Users/kyle/synthetic-text-agents-v2/tests/integration/trust-console-api.test.ts` (TODO)
- `/Users/kyle/synthetic-text-agents-v2/tests/e2e/trust-console.spec.ts` (TODO)

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

### 프로젝트 루트
```bash
# 바로 열기
open /Users/kyle/synthetic-text-agents-v2/package.json
open /Users/kyle/synthetic-text-agents-v2/tsconfig.json
```

---

## 🎯 RTF 컨텍스트 파일 위치

**중요**: 스크린샷에 보이는 RTF 파일들(`*_1006.rtf`)은 **Claude Code 세션 컨텍스트 파일**입니다.

이 파일들은 프로젝트 디렉토리가 아닌 **별도 위치**에 있습니다:
- macOS 파일 매니저나 Finder에서 표시되는 위치
- 일반적으로 임시 디렉토리 또는 Claude Code 앱 내부 스토리지

### RTF 파일 리스트 (14개)
1. `claude.md_1006.rtf` - CLAUDE.md 컨텐츠
2. `llm_development_contract_1006.rtf` - LLM_DEVELOPMENT_CONTRACT.md
3. `development_standard_1006.rtf` - DEVELOPMENT_STANDARDS.md
4. `llm_friendly_1006.rtf` - docs/llm_friendly_summary.md
5. `handoff_navigation_1006.rtf` - HANDOFF_NAVIGATION.md
6. `command_guide_1006.rtf` - docs/COMMAND_GUIDE.md
7. `tool_mode_1006.rtf` - (Tool usage patterns)
8. `tool_map_1006.rtf` - (Tool mapping)
9. `governance_philosophy_1006.rtf` - (Governance philosophy)
10. `governance_flow_1006.rtf` - (Governance workflow)
11. `governance_rules_1006.rtf` - (Governance rules)
12. `package_jason_1006.rtf` - package.json
13. `type_script_guide_1006.rtf` - docs/TYPESCRIPT_GUIDELINES.md
14. `tsconfig_1006.rtf` - tsconfig.json

### 대체 방법: 원본 Markdown 파일 사용
RTF 대신 프로젝트 내 원본 Markdown 파일을 사용하세요:

```bash
# 핵심 문서 모두 열기
open /Users/kyle/synthetic-text-agents-v2/CLAUDE.md
open /Users/kyle/synthetic-text-agents-v2/docs/LLM_DEVELOPMENT_CONTRACT.md
open /Users/kyle/synthetic-text-agents-v2/docs/DEVELOPMENT_STANDARDS.md
open /Users/kyle/synthetic-text-agents-v2/docs/llm_friendly_summary.md
open /Users/kyle/synthetic-text-agents-v2/docs/HANDOFF_NAVIGATION.md
open /Users/kyle/synthetic-text-agents-v2/docs/COMMAND_GUIDE.md
open /Users/kyle/synthetic-text-agents-v2/docs/TYPESCRIPT_GUIDELINES.md
```

---

## 🚀 빠른 시작 명령어 모음

### 1. 프로젝트 디렉토리로 이동
```bash
cd /Users/kyle/synthetic-text-agents-v2
```

### 2. 핸드오프 문서 확인
```bash
cat HANDOFF_PACKAGE.md
cat HANDOFF_SNAPSHOT.md
```

### 3. 구현 가이드 읽기
```bash
cat docs/TRUST_CONSOLE_IMPLEMENTATION.md
cat docs/TRUST_INFRASTRUCTURE.md
```

### 4. 현재 상태 확인
```bash
git status
npm test
```

### 5. 첫 번째 파일 구현 시작
```bash
# Main Trust API
code apps/fe-web/app/api/trust/route.ts

# 또는 vim
vim apps/fe-web/app/api/trust/route.ts
```

---

## 📋 디렉토리 트리 (복사용)

```
/Users/kyle/synthetic-text-agents-v2/
├── HANDOFF_PACKAGE.md              ← 핸드오프 가이드
├── HANDOFF_SNAPSHOT.md             ← 현재 상태 스냅샷
├── FILE_LOCATIONS.md               ← 이 파일
├── CLAUDE.md                       ← 시스템 철학
│
├── docs/
│   ├── TRUST_CONSOLE_IMPLEMENTATION.md  ← 구현 가이드
│   ├── TRUST_INFRASTRUCTURE.md          ← 기술 문서
│   ├── NEXT_ACTIONS.md                  ← 현재 작업
│   ├── DEVELOPMENT_STANDARDS.md
│   ├── LLM_DEVELOPMENT_CONTRACT.md
│   └── HANDOFF_NAVIGATION.md
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
│   └── components/ui/              ← 기존 UI 컴포넌트
│
└── tests/
    └── core/                       ← 기존 테스트 (842 passing)
```

---

**생성일**: 2025-10-08 23:45 KST
**용도**: 핸드오프 시 파일 위치 빠른 참조
