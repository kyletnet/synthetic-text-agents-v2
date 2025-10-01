# Migration Guide: Cache-based Workflow v2 + Governance System

**Last Updated**: 2025-10-01
**Migration Type**: Breaking Changes
**Estimated Time**: 5-10 minutes

---

## Overview

이 마이그레이션은 **캐시 기반 워크플로우 v2**와 **완전한 거버넌스 시스템**을 도입합니다.

### What Changed?

1. **레거시 명령어 폐기** - 6개 파일 직접 실행 차단
2. **캐시 기반 아키텍처** - inspection-results.json이 Single Source of Truth
3. **거버넌스 시스템** - 모든 작업에 대한 preflight/post-verification
4. **Self-Validation** - maintain 실행 후 자동 검증 (최대 3회 재시도)
5. **무한 대기 vs 무한 루프 구분** - 사용자 입력은 무한 대기, 시스템 작업은 타임아웃

---

## Breaking Changes

### 1. 레거시 명령어 폐기

**❌ 더 이상 작동하지 않는 명령어:**

```bash
# 직접 실행 차단됨
tsx scripts/unified-dashboard.ts
tsx scripts/fix-orchestrator.ts
tsx scripts/smart-maintenance-orchestrator.ts
tsx scripts/ai-fix-engine.ts
tsx scripts/comprehensive-doc-updater.ts
tsx scripts/handoff-generator.ts
```

**✅ 새로운 명령어:**

```bash
npm run status      # 시스템 진단 (inspection-results.json 생성)
npm run maintain    # 자동 수정 + Self-Validation
npm run fix         # 대화형 수정 (사용자 승인)
npm run validate    # 거버넌스 규칙 검증
npm run verify      # 전체 시스템 무결성 검증
npm run ship        # 배포 준비
```

### 2. 워크플로우 변경

**Before (v1):**
```bash
npm run dev:maintain  # 독립 실행 (자체 진단)
```

**After (v2):**
```bash
npm run status     # 1. 진단 (필수, 캐시 생성)
npm run maintain   # 2. 자동 수정 (캐시 읽기 + Self-Validation)
npm run fix        # 3. 대화형 수정 (캐시 읽기)
```

**순서 강제:**
- `maintain`과 `fix`는 반드시 `status`를 먼저 실행해야 함
- 캐시 유효기간: 5분 (TTL)
- 캐시 만료 시 자동으로 재진단 요구

---

## New Features

### 1. 캐시 기반 아키텍처

**Single Source of Truth**: `reports/inspection-results.json`

```json
{
  "schemaVersion": "2025-10-inspect-v1",
  "timestamp": "2025-10-01T10:00:00.000Z",
  "ttl": 300,
  "autoFixable": [...],
  "manualApprovalNeeded": [...],
  "summary": {
    "healthScore": 85,
    "typescript": "pass",
    "codeStyle": "fail",
    "tests": "pass",
    "security": "pass"
  }
}
```

**장점:**
- 모든 명령어가 동일한 진단 결과 사용 (일관성)
- 중복 진단 제거 (성능 향상)
- 5분 TTL로 항상 최신 상태 보장

### 2. Governance System

**모든 작업에 적용되는 거버넌스:**

1. **Preflight Checks** - 실행 전 검증
   - 환경 변수 확인
   - 캐시 유효성 검증
   - Git 상태 확인
   - 거버넌스 규칙 검증

2. **Snapshot Capture** - 실행 전후 시스템 상태 캡처
   - 파일 해시 기록
   - 의존성 변경 추적
   - 예상치 못한 변경 감지

3. **Post-Verification** - 실행 후 검증
   - TypeScript 컴파일 확인
   - ESLint 검사
   - 스냅샷 비교

4. **Operation Logging** - 모든 작업 JSONL 기록
   - 감사 추적 (audit trail)
   - 포렌식 분석 가능
   - 성능 메트릭 추적

### 3. Self-Validation (maintain only)

**자동 품질 개선:**

```bash
npm run maintain
# 1. 자동 수정 실행
# 2. TypeScript + ESLint 검증
# 3. 실패 시 자동 재수정 (최대 3회)
# 4. 성공 시 완료
```

**동작 방식:**
- 최대 3회 재시도
- ESLint 경고는 `npm run lint:fix`로 자동 수정
- TypeScript 오류는 수동 개입 필요
- 루프 감지 (무한루프 방지)

### 4. 무한 대기 vs 무한 루프 구분

**핵심 철학**: "무한 대기 ≠ 무한 루프"

| 작업 타입 | 타임아웃 | 예시 |
|----------|---------|------|
| **user-input** | 없음 (무한 대기) | `/fix` 승인 대기 |
| **system-command** | 10분 | `npm install` |
| **validation** | 2분 | TypeScript 컴파일 |
| **file-operation** | 30초 | 파일 읽기/쓰기 |

**무한루프 감지:**
- 반복 횟수 기반 (최대 1000회)
- 속도 기반 (초당 100회 이상 의심)
- 화이트리스트 (의도적 재시도 루프 허용)

---

## Migration Steps

### Step 1: 기존 명령어 중단

레거시 명령어를 사용 중이라면:

```bash
# ❌ 이제 작동 안 함
npm run dev:maintain

# ✅ 새로운 방법
npm run status
npm run maintain
```

### Step 2: 새 워크플로우 습득

**일상 개발 (3단계):**

```bash
npm run status       # 1. 진단
npm run maintain     # 2. 자동 수정
npm run fix          # 3. 대화형 수정 (필요시)
git add -A && git commit -m "fix: 품질 개선"
```

**배포 전 (4단계):**

```bash
npm run status       # 1. 진단
npm run maintain     # 2. 자동 수정
npm run fix          # 3. 대화형 수정
npm run verify       # 4. 전체 시스템 검증
git push origin main
```

### Step 3: 거버넌스 규칙 이해

**governance-rules.json** 파일 확인:

```bash
cat governance-rules.json
```

**주요 섹션:**
- `rules`: 거버넌스 규칙 (NO_LEGACY_IMPORTS, INSPECT_FIRST, etc.)
- `timeoutPolicy`: 작업 타입별 타임아웃 설정
- `loopDetection`: 무한루프 감지 설정
- `riskDomains`: 고위험 코드 영역
- `deprecatedFiles`: 폐기된 파일 목록

### Step 4: 새 명령어 학습

```bash
# 거버넌스 검증
npm run validate

# 전체 시스템 검증
npm run verify

# 진단 + 자동 수정 + 대화형 수정
npm run status && npm run maintain && npm run fix
```

---

## Troubleshooting

### Q1: "enforce /inspect first" 에러

**문제:**
```
⚠️  maintain를 실행하기 전에 /inspect를 먼저 실행하세요
```

**해결:**
```bash
npm run status    # 먼저 진단 실행
npm run maintain  # 그 다음 maintain 실행
```

### Q2: 캐시 만료 에러

**문제:**
```
⏰ 진단 결과가 오래되었습니다 (6분 전)
```

**해결:**
```bash
npm run status    # 재진단
```

### Q3: Self-Validation 실패

**문제:**
```
❌ Self-validation failed: Manual intervention required
```

**해결:**
```bash
# TypeScript 오류 확인
npm run typecheck

# 수동 수정 후 다시 실행
npm run maintain
```

### Q4: 레거시 파일 실행 차단

**문제:**
```
❌ DEPRECATED: unified-dashboard.ts는 더 이상 직접 실행할 수 없습니다.
```

**해결:**
```bash
npm run status    # 올바른 명령어 사용
```

---

## FAQ

### Q: 왜 캐시 기반으로 변경했나요?

**A**: 일관성과 성능 향상
- 모든 명령어가 동일한 진단 결과 사용 (불일치 제거)
- 중복 진단 방지 (시간 절약)
- 5분 TTL로 항상 최신 상태 유지

### Q: Self-Validation이 실패하면 어떻게 되나요?

**A**: 최대 3회 자동 재시도
- ESLint 경고: 자동 수정 시도
- TypeScript 오류: 수동 개입 필요
- 3회 실패 시 에러 발생

### Q: 무한 대기가 위험하지 않나요?

**A**: 사용자 입력만 무한 대기
- 사용자 승인 필요 작업: 타임아웃 없음 (무한 대기 OK)
- 시스템 작업: 타임아웃 적용 (무한루프 방지)
- 루프 감지로 이중 보호

### Q: 거버넌스 우회 가능한가요?

**A**: 불가능 (No Bypass Philosophy)
- `SKIP_GOVERNANCE` 옵션 없음
- `--force` 플래그 없음
- 모든 작업에 거버넌스 강제 적용

### Q: 기존 테스트는 영향 받나요?

**A**: 영향 없음
- 레거시 파일 `import`는 허용 (테스트 호환성)
- 직접 실행만 차단됨

---

## Next Steps

1. ✅ 새 워크플로우 익히기 (status → maintain → fix)
2. ✅ 거버넌스 규칙 확인 (governance-rules.json)
3. ✅ Self-Validation 체험 (npm run maintain)
4. ✅ 전체 검증 실행 (npm run verify)
5. 📚 거버넌스 철학 읽기 (docs/GOVERNANCE_PHILOSOPHY.md)

---

## References

- **Governance Philosophy**: `docs/GOVERNANCE_PHILOSOPHY.md`
- **Command Guide**: `docs/COMMAND_GUIDE.md`
- **Inspection Flow**: `docs/INSPECTION_FLOW.md`
- **User Guide**: `docs/USER_GUIDE_INSPECT_WORKFLOW.md`

---

**마이그레이션 완료!** 🎉

문제가 있다면:
1. `npm run validate` 실행
2. 에러 메시지 확인
3. 이 가이드의 Troubleshooting 섹션 참조
