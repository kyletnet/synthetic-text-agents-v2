# System Governance Philosophy

**Version**: 2.0
**Last Updated**: 2025-10-01
**Status**: Active

---

## Core Philosophy

> **"사람의 실수를 시스템이 막는다"**

시스템 거버넌스는 개발자의 실수를 방지하고, 코드 품질을 자동으로 보장하며, 모든 작업을 투명하게 기록하는 것을 목표로 합니다.

---

## Three Pillars

### 1. No Bypass (우회 불가)

**원칙**: 어떤 상황에서도 거버넌스 규칙을 우회할 수 없습니다.

**설계:**

- ❌ `SKIP_GOVERNANCE` 환경 변수 없음
- ❌ `--force` 플래그 없음
- ❌ 타임아웃 건너뛰기 없음
- ✅ 모든 작업에 거버넌스 강제 적용

**이유:**

- 편의성보다 안정성 우선
- 개발자 실수로 인한 시스템 무결성 훼손 방지
- 일관된 품질 기준 유지

**예외:**

- 없음. 진짜 긴급 상황이라면 코드 수정 후 재배포.

---

### 2. Infinite Wait ≠ Infinite Loop (무한 대기 ≠ 무한 루프)

**핵심 통찰**: 사용자 승인을 기다리는 것과 무한루프는 다릅니다.

#### Operation Type별 정책

| Type               | Timeout            | Rationale        | Example                    |
| ------------------ | ------------------ | ---------------- | -------------------------- |
| **user-input**     | `null` (무한 대기) | 사용자 결정 필요 | `/fix` 승인 대기           |
| **system-command** | 10분 (600초)       | 시스템 작업      | `npm install`, `git clone` |
| **validation**     | 2분 (120초)        | 빠른 검증        | TypeScript 컴파일, ESLint  |
| **file-operation** | 30초               | I/O 작업         | 파일 읽기/쓰기             |

#### 무한루프 감지 메커니즘

**1. Count-based Detection (횟수 기반)**

```typescript
if (iterations > 1000) {
  throw new InfiniteLoopError(operationId, iterations, duration);
}
```

**2. Rate-based Detection (속도 기반)**

```typescript
if (ratePerSecond > 100) {
  console.warn(`Suspicious loop: ${ratePerSecond} iter/sec`);
}
```

**3. Whitelist (화이트리스트)**

```json
{
  "loopDetection": {
    "whitelist": ["user-approval-wait", "self-validation", "retry-with-backoff"]
  }
}
```

**주기적 알림 (Periodic Reminders)**

```typescript
// 사용자 대기 중 5분마다 알림
const reminder = setInterval(() => {
  console.log("⏳ Waiting for user input...");
}, 300000); // 5분
```

---

### 3. Single Source of Truth (유일한 진실의 원천)

**원칙**: `inspection-results.json`이 모든 진단의 유일한 출처입니다.

#### 설계

```
┌─────────────────────────────────────┐
│   inspection-results.json (SoT)     │
│   - Created by: /inspect only       │
│   - TTL: 5 minutes                  │
│   - Read by: /maintain, /fix        │
└─────────────────────────────────────┘
             ↓
    ┌────────┼────────┐
    ↓        ↓        ↓
maintain    fix    verify
(read)    (read)   (read)
```

**강제 순서:**

```bash
npm run status    # 1. CREATE cache
npm run maintain  # 2. READ cache
npm run fix       # 3. READ cache
```

**TTL (Time To Live): 5분**

- 이유: 코드 변경 후 진단 재실행 강제
- 효과: 항상 최신 상태 보장
- 구현: `InspectionCache.enforceInspectFirst()`

**우회 차단:**

```typescript
if (!validation.valid) {
  console.error("⚠️  maintain를 실행하기 전에 /inspect를 먼저 실행하세요");
  process.exit(1); // 강제 종료
}
```

---

## Design Decisions

### Why No Bypass?

**질문**: "긴급 상황에서 우회가 필요하지 않나요?"

**답변**: 아니요. 진짜 긴급 상황이라면:

1. 거버넌스 규칙을 수정 (governance-rules.json)
2. 코드를 수정하여 규칙 통과
3. 새 규칙을 배포

**이유:**

- "긴급"은 대부분 계획 부족의 결과
- 우회 옵션이 있으면 남용됨
- 시스템 무결성 > 일시적 편의

### Why 5-Minute TTL?

**질문**: "TTL이 너무 짧지 않나요?"

**답변**: 아니요. 5분은 적절합니다.

**시나리오 분석:**

- **Case 1**: 코드 변경 없음 → 5분 내 재실행 → 캐시 재사용 ✅
- **Case 2**: 코드 변경 있음 → 재진단 필요 → TTL 만료 OK ✅
- **Case 3**: 장시간 작업 → 5분 초과 → 재진단 강제 ✅

**장점:**

- 코드 변경 후 오래된 진단 사용 방지
- 캐시 무효화 자동화
- 개발자가 "언제 재진단?"을 고민할 필요 없음

### Why Self-Validation?

**질문**: "왜 maintain이 자동으로 재검증하나요?"

**답변**: Claude 개발 후 품질 보장을 위해.

**문제 상황:**

```bash
npm run maintain  # Claude가 코드 수정
# 수정 후 TypeScript 오류 발생?
# ESLint 경고 발생?
# 개발자가 직접 확인해야 함 (불편)
```

**해결책 (Self-Validation):**

```bash
npm run maintain
# 1. 자동 수정
# 2. TypeScript 검증
# 3. ESLint 검증
# 4. 실패 시 자동 재수정 (최대 3회)
# 5. 성공 시 완료
```

**장점:**

- 개발자 개입 최소화
- 품질 자동 보장
- Claude 개발 신뢰성 향상

---

## Governance Layers

### Layer 1: Preflight (실행 전)

**목적**: 실행 가능한 상태인지 검증

**체크 항목:**

1. 환경 변수 (Node.js 버전, etc.)
2. 캐시 유효성 (maintain/fix만)
3. Git 상태 (uncommitted changes 경고)
4. node_modules 존재
5. governance-rules.json 유효성

**실패 시**: 실행 차단

### Layer 2: Execution (실행 중)

**목적**: 안전하게 작업 수행

**적용사항:**

1. **SafeExecutor**: 타임아웃 관리
2. **LoopDetector**: 무한루프 감지
3. **Snapshot Before**: 시스템 상태 캡처

**실패 시**: 에러 발생 + 알림

### Layer 3: Verification (실행 후)

**목적**: 예상대로 작업 완료되었는지 검증

**체크 항목:**

1. **Snapshot After**: 시스템 상태 캡처
2. **Snapshot Diff**: 변경 사항 비교
3. **TypeScript 컴파일**: 타입 안정성 확인
4. **ESLint 검사**: 코드 품질 확인
5. **Unexpected Changes**: 의도치 않은 변경 감지

**실패 시**: 롤백 권장 + 상세 리포트

### Layer 4: Logging (감사)

**목적**: 모든 작업 영구 기록

**기록 내용:**

- 작업 ID, 타임스탬프
- 실행 전후 스냅샷 ID
- 성공/실패 상태
- 에러 메시지 (실패 시)
- 성능 메트릭 (duration, memory)

**저장 위치**: `reports/operations/governance.jsonl`

---

## Notification Strategy

### Multi-Channel Alerting

**채널:**

1. **Console**: 즉시 표시
2. **File**: `reports/alerts/*.json`
3. **Slack**: 팀 채널 알림
4. **GitHub Issues**: 자동 이슈 생성

**Event Types:**

| Event                  | Severity | Channels                           |
| ---------------------- | -------- | ---------------------------------- |
| **Infinite Loop**      | Critical | All (Console, File, Slack, GitHub) |
| **Timeout**            | High     | Console, File, Slack               |
| **Unexpected Change**  | High     | Console, File, GitHub              |
| **Validation Failure** | Medium   | Console, File                      |

### Example: Infinite Loop Alert

**Console:**

```
🚨 Infinite Loop Detected

Operation: self-validation
Iterations: 1001
Duration: 15.3s
Timestamp: 2025-10-01T10:00:00.000Z

Action Required: Investigate and fix loop condition
```

**Slack:**

```
🚨 Infinite Loop Detected
Operation: self-validation (1001 iterations)
Repository: synthetic-text-agents-v2
Branch: main
View logs: reports/loop-profile.json
```

**GitHub Issue:**

```
Title: 🚨 Infinite Loop: self-validation (1001 iterations)

**Details:**
- Operation: self-validation
- Iterations: 1001
- Duration: 15.3s
- Timestamp: 2025-10-01T10:00:00.000Z

**Logs:**
See reports/loop-profile.json

Auto-generated by Governance System
```

---

## Risk Domain Management

### What are Risk Domains?

**정의**: 변경 시 시스템에 큰 영향을 미치는 코드 영역

**예시:**

```json
{
  "riskDomains": [
    {
      "path": "src/rag/**",
      "reason": "RAG 시스템 변경은 신중히",
      "severity": "high",
      "requiresApproval": true
    },
    {
      "path": "package.json",
      "reason": "의존성 변경 검토 필요",
      "severity": "critical",
      "requiresApproval": true
    }
  ]
}
```

### How Risk Domains Work

**1. Detection (감지)**

```bash
git diff --name-only HEAD
# Output: src/rag/embeddings.ts
```

**2. Warning (경고)**

```
⚠️  Risk domain affected: src/rag/embeddings.ts
   RAG 시스템 변경은 신중히
   ⚠️  Requires manual approval
```

**3. Approval (승인)**

- Critical/High severity → 수동 승인 필요
- Medium/Low severity → 경고만 표시

---

## Operation Logging

### JSONL Format

**Why JSONL?**

- 스트리밍 친화적
- 효율적인 append
- 파싱 간단

**Example:**

```jsonl
{"id":"op-123","timestamp":"2025-10-01T10:00:00Z","operation":"inspect","phase":"preflight","status":"started","duration":null}
{"id":"op-123","timestamp":"2025-10-01T10:00:15Z","operation":"end","phase":"verification","status":"success","duration":15000}
```

### Audit Trail

**목적**: 포렌식 분석, 컴플라이언스

**쿼리 예시:**

```typescript
// 최근 실패한 작업 조회
const failures = await logger.query({
  status: "failure",
  dateRange: { from: "2025-10-01", to: "2025-10-02" },
});

// 특정 작업 ID의 전체 로그
const operationLogs = await logger.getByOperationId("op-123");
```

---

## Best Practices

### For Developers

1. **항상 순서대로**

   ```bash
   npm run status → maintain → fix
   ```

2. **캐시 만료 이해하기**
   - 5분 이내: 재사용
   - 5분 초과: 재진단

3. **Self-Validation 신뢰하기**
   - maintain은 자동으로 재검증
   - 실패 시 수동 개입

4. **리스크 도메인 존중하기**
   - 경고 무시하지 않기
   - Critical 영역은 신중히 변경

### For System Administrators

1. **거버넌스 규칙 관리**

   ```bash
   vim governance-rules.json
   npm run validate
   ```

2. **알림 채널 설정**

   ```bash
   export SLACK_WEBHOOK_URL="https://..."
   export GITHUB_TOKEN="ghp_..."
   ```

3. **로그 모니터링**

   ```bash
   tail -f reports/operations/governance.jsonl
   ```

4. **정기 감사**
   ```bash
   npm run verify  # 주 1회
   ```

---

## Philosophy in Practice

### Scenario 1: 긴급 배포

**상황**: 프로덕션 버그, 즉시 수정 필요

**❌ 잘못된 접근:**

```bash
# 우회하려는 시도
SKIP_GOVERNANCE=true npm run deploy  # 작동 안 함!
```

**✅ 올바른 접근:**

```bash
# 1. 버그 수정
vim src/bug-file.ts

# 2. 정상 워크플로우
npm run status
npm run maintain
npm run verify

# 3. 배포
git push && deploy
```

**교훈**: 긴급 상황에서도 품질 보장. 우회는 더 큰 문제를 만듦.

### Scenario 2: Self-Validation 실패

**상황**: maintain 후 TypeScript 오류

```
❌ Self-validation failed after 3 attempts
   TypeScript errors: 5
```

**✅ 대응:**

```bash
# 1. 상세 오류 확인
npm run typecheck

# 2. 수동 수정
vim src/error-file.ts

# 3. 재실행
npm run maintain  # Self-Validation 다시 시도
```

**교훈**: Self-Validation은 최선을 다하지만, 수동 개입은 여전히 필요할 수 있음.

### Scenario 3: 무한루프 의심

**상황**: 작업이 너무 오래 걸림

```
⚠️  Suspicious loop detected: self-validation
   Rate: 150 iterations/second
   Total: 500 iterations
```

**시스템 대응:**

1. Console 경고
2. loop-profile.json 기록
3. Slack 알림
4. 1000회 도달 시 강제 종료

**교훈**: 시스템이 자동으로 감지하고 대응. 개발자 개입 불필요.

---

## Future Enhancements

1. **AI-based Anomaly Detection**
   - ML 모델로 비정상 패턴 감지
   - 자동 롤백 제안

2. **Enhanced Rollback**
   - Snapshot 기반 자동 롤백
   - 트랜잭션 시스템

3. **Performance Optimization**
   - 스냅샷 캡처 최적화
   - 병렬 검증

4. **Advanced Notifications**
   - PagerDuty 통합
   - 심각도별 에스컬레이션

---

## Summary

**Governance = Trust**

거버넌스 시스템은 신뢰를 제공합니다:

- ✅ 코드 품질 자동 보장
- ✅ 실수 방지
- ✅ 투명한 감사 추적
- ✅ 예측 가능한 동작

**No Bypass** → 일관성
**Infinite Wait ≠ Loop** → 유연성
**Single Source of Truth** → 신뢰성

---

**Questions?**

1. `npm run validate` - 거버넌스 규칙 검증
2. `npm run verify` - 전체 시스템 검증
3. `docs/MIGRATION_V2.md` - 마이그레이션 가이드
4. `docs/COMMAND_GUIDE.md` - 명령어 가이드

**We protect what we govern. We govern what we value.**
