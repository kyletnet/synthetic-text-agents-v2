# Command Workflow Guide - 실전 사용법

**Last Updated**: 2025-10-01
**Target**: 일반 개발자

---

## 🎯 핵심 3단계 (일상 개발)

### 반드시 해야 하는 명령어

```bash
# ✅ 이것만 하세요!
npm run status       # 1. 진단 (필수)
npm run maintain     # 2. 자동 수정 (필수)
npm run fix          # 3. 대화형 수정 (상황에 따라)
```

**언제?**
- 코드 변경 후
- Claude 개발 완료 후
- 커밋 전
- 5분 이상 지났을 때 (캐시 만료)

**결과:**
- ✅ 코드 품질 자동 보장
- ✅ TypeScript 오류 0개
- ✅ ESLint 경고 최소화
- ✅ 커밋 준비 완료

---

## 📋 명령어별 역할

### 1. npm run status (검사)

**역할**: 시스템 진단 + 캐시 생성

**실행 시점:**
- 개발 시작할 때
- 코드 변경 후
- 5분 경과 후
- maintain/fix 실행 전 (필수)

**출력:**
```
🔍 System Inspection Engine v2.0
═══════════════════════════════

⚡ Phase 1: Running Diagnostics...

   🎨 Checking code formatting (Prettier)...
   🔍 Checking code quality (ESLint)...
   📘 Checking TypeScript compilation...
   🧪 Checking tests...
   🛡️  Running security audit...
   🔧 Detecting workarounds (TODO/FIXME/HACK)...

📊 Inspection Results
═══════════════════════════════

🟢 Overall Health Score: 85/100

🎯 Quality Gates:
   TypeScript: ✅ PASS
   Code Style: ❌ FAIL
   Tests: ✅ PASS
   Security: ✅ PASS

📋 Issues Found:
   Total: 5개
   ✅ Auto-fixable: 2개
   ⚠️  Needs Approval: 3개

💾 Saving inspection results...
✅ Results saved to: reports/inspection-results.json
⏰ Valid for: 5 minutes

🚀 Next Steps:
1️⃣  Auto-fix 2 items: npm run maintain
2️⃣  Review 3 items: npm run fix
```

**소요 시간**: ~30초

---

### 2. npm run maintain (자동 수정)

**역할**: 자동 수정 + Self-Validation

**실행 시점:**
- status 실행 직후
- Auto-fixable 항목이 있을 때

**출력:**
```
🔧 Maintain Engine - Auto-fix + Self-Validation
═══════════════════════════════

📋 Checking inspection results...
✅ Using inspection results from 30초 전

🔧 Found 2 auto-fixable items

[1/2] 코드 포매팅 불일치
   → npx prettier --write .
   ✅ Completed (3.2s)

[2/2] ESLint 경고 5개
   → npm run lint:fix
   ✅ Completed (2.1s)

═══════════════════════════════
✅ Success: 2

🔄 Self-Validation...
═══════════════════════════════

   📘 TypeScript...
   🔍 ESLint...

✅ Self-validation passed (attempt 1/3)

📊 Auto-fix Summary:
   Total items: 2
   Estimated time saved: 20s

🚀 Next Steps:
⚠️  3 items need manual approval
   → npm run fix (interactive review)
```

**소요 시간**: ~1분

**특징:**
- ✅ 자동 수정 후 재검증 (최대 3회)
- ✅ 실패 시 자동 재시도
- ✅ TypeScript + ESLint 자동 체크

---

### 3. npm run fix (대화형 수정)

**역할**: 수동 승인 필요한 항목 처리

**실행 시점:**
- maintain 완료 후
- Manual approval 항목이 있을 때

**출력:**
```
⚠️  Fix Engine - Interactive Manual Approval
═══════════════════════════════

📋 Checking inspection results...
✅ Using inspection results from 1분 전

⚠️  Found 3 items needing approval

═══════════════════════════════════════
📋 항목 1/3 - 승인이 필요합니다
═══════════════════════════════════════

🚨 긴급: 워크어라운드/TODO 마커 147개

📊 상세 정보:
   • 심각도: CRITICAL
   • 발견 개수: 147개
   • 영향: 기술 부채 감소, 코드 품질 개선

💡 권장 조치:
   우선순위가 높은 항목부터 순차적으로 해결 (grep으로 검색 가능)

📁 영향 받는 파일 (상위 5개):
   1. src/rag/embeddings.ts
   2. src/rag/factory.ts
   3. scripts/metrics/baselineReportGenerator.ts
   ...

🤔 이것은 무엇인가요?
   TODO/FIXME 마커는 임시 해결책이나 나중에 수정해야 할 부분을 표시한 것입니다.

💬 개발자에게 물어볼 질문:
   1. 이 TODO 마커들 중 긴급한 것이 있나요?
   2. 언제까지 해결해야 하나요?
   3. 어떤 것부터 우선 처리해야 하나요?

──────────────────────────────────────
🔵 결정을 내려주세요:
   y = 승인 (이 문제를 해결하겠습니다)
   n = 건너뛰기 (나중에 처리)
   m = 수동 처리 (직접 확인 필요)
   a = 전체 중단
   i = 더 자세한 정보 보기
──────────────────────────────────────

👉 선택 [y/n/m/a/i]: _
```

**소요 시간**: 항목당 ~30초 (사용자 승인 시간)

**특징:**
- ⏳ 무한 대기 (사용자 입력 기다림)
- 📋 비개발자도 이해 가능한 설명
- 💡 개발자에게 물어볼 질문 제시

---

## 🚀 선택 명령어

### npm run validate (거버넌스 검증)

**역할**: 거버넌스 규칙 + 엔진 준수 검증

**실행 시점:**
- 새 엔진 추가했을 때
- 거버넌스 의심될 때
- 주 1회 (선택)

**출력:**
```
🔍 Governance Validation Engine
═══════════════════════════════

📋 Validating governance-rules.json...
   ✓ Schema version: 2025-10-governance-v1
   ✓ Enabled rules: 4/4
   ✓ Risk domains: 5
   ✓ Deprecated files: 6

🔍 Checking legacy imports...
   ✓ No legacy imports detected

📦 Validating inspection cache...
   ✓ Cache valid (2분 전)
   ✓ Health score: 85/100

⚖️  Governance enforcement...
   ✓ All 3 engines are governance-compliant

📊 Governance Status...
   📊 Risk domains: 5 total
      🔴 Critical: 2
      🟡 High: 3

═══════════════════════════════
✅ All validations passed

💡 Governance system is healthy
```

**소요 시간**: ~10초

**자동 트리거**: 없음 (수동 실행만)

---

### npm run verify (최종 검증)

**역할**: 배포 전 전체 시스템 검증

**실행 시점:**
- 배포 전
- PR 생성 전
- 주 1회 (권장)

**출력:**
```
🔍 System Integrity Verification
═══════════════════════════════

📘 TypeScript Compilation...
   ✅ TypeScript: PASS

🔍 ESLint Validation...
   ✅ ESLint: PASS

🧪 Tests...
   ⚠️  Tests: SKIP (optional)

⚖️  Governance Rules...
   ✅ Governance: PASS

═══════════════════════════════
📊 Verification Summary:
═══════════════════════════════

🎉 All verifications passed!

✅ System is ready for deployment

💡 Next steps:
   - git add -A && git commit -m 'feat: ...'
   - git push
   - Deploy to production
```

**소요 시간**: ~2분

**자동 트리거**: ship 명령어에 포함됨

---

## 📊 워크플로우 비교

### 일상 개발 (3단계)

```bash
# ⏱️ 총 소요: ~2분
npm run status       # 30초
npm run maintain     # 1분
npm run fix          # 30초 (선택)

git commit -m "fix: 품질 개선"
```

### 배포 전 (4단계)

```bash
# ⏱️ 총 소요: ~4분
npm run status       # 30초
npm run maintain     # 1분
npm run fix          # 30초
npm run verify       # 2분 ⭐

git push
```

### 거버넌스 검증 (선택)

```bash
# ⏱️ 총 소요: ~10초
npm run validate     # 10초

# 언제: 주 1회 또는 필요시
```

---

## 🔄 자동화 옵션

### 현재 상태
```
✅ status → maintain → fix (수동 실행)
✅ verify (ship 명령어에 포함)
❌ validate (수동 실행만)
```

### CI 통합 (선택사항)

**`.github/workflows/governance.yml`** 추가 시:
```yaml
on: [push, pull_request]
jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - run: npm run validate  # ⭐ 자동 실행
      - run: npm run verify
```

**효과:**
- ✅ PR마다 자동 검증
- ✅ 거버넌스 위반 즉시 감지
- ✅ merge 전 차단 가능

---

## ⚡ 빠른 참조

| 명령어 | 필수? | 빈도 | 소요 시간 | 자동? |
|--------|------|------|-----------|-------|
| `npm run status` | ✅ 필수 | 코드 변경시 | 30초 | ❌ |
| `npm run maintain` | ✅ 필수 | status 후 | 1분 | ❌ |
| `npm run fix` | ⚠️ 상황에 따라 | maintain 후 | 30초/항목 | ❌ |
| `npm run validate` | ⏭️ 선택 | 주 1회 | 10초 | ❌ (CI 가능) |
| `npm run verify` | ⏭️ 배포시 | 배포 전 | 2분 | ✅ (ship에 포함) |

---

## 💡 실전 팁

### Tip 1: 캐시 활용
```bash
# 5분 내에 재실행
npm run status       # 캐시 생성
npm run maintain     # 캐시 사용 ✅
npm run fix          # 캐시 사용 ✅

# 5분 후
npm run maintain     # ❌ Error: 캐시 만료
npm run status       # 캐시 재생성
npm run maintain     # ✅ OK
```

### Tip 2: 순서 지키기
```bash
# ❌ 잘못된 순서
npm run maintain     # Error: enforce /inspect first

# ✅ 올바른 순서
npm run status       # 먼저 진단
npm run maintain     # 그 다음 수정
```

### Tip 3: Self-Validation 신뢰
```bash
npm run maintain
# → 자동으로 TypeScript + ESLint 검증
# → 실패 시 자동 재수정 (최대 3회)
# → 성공 시 완료

# 별도 검증 불필요!
```

---

## 🚨 문제 해결

### Q: "enforce /inspect first" 에러

```bash
# 에러
⚠️  maintain를 실행하기 전에 /inspect를 먼저 실행하세요

# 해결
npm run status
npm run maintain
```

### Q: 캐시 만료 에러

```bash
# 에러
⏰ 진단 결과가 오래되었습니다 (6분 전)

# 해결
npm run status    # 재진단
```

### Q: Self-Validation 실패

```bash
# 에러
❌ Self-validation failed: Manual intervention required

# 해결
npm run typecheck    # 오류 확인
# 수동 수정 후
npm run maintain     # 재실행
```

---

## 📚 관련 문서

- `docs/MIGRATION_V2.md` - 마이그레이션 가이드
- `docs/GOVERNANCE_PHILOSOPHY.md` - 거버넌스 철학
- `GOVERNANCE_SYSTEM_REPORT.md` - 최종 보고서

---

**요약**: 일상 개발은 `status → maintain → fix` 3단계만! 🚀
