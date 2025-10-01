# Inspection Flow Architecture

> **Single Source of Truth** for all system diagnostics and quality management

## 🎯 Core Philosophy

```
inspect → maintain → fix → ship
   ↓          ↓         ↓       ↓
 진단      자동수정   수동수정  배포
```

**Golden Rule**: **모든 품질 관리는 항상 inspect → maintain → fix 순서를 지키세요**

---

## 📋 Workflow Overview

### 1️⃣ `/inspect` - Single Source of Truth

**Purpose**: 모든 시스템 진단을 수행하고 결과를 캐싱

**What it does**:
- TypeScript 컴파일 검사
- ESLint/Prettier 검사
- 테스트 실행 상태
- 보안 감사
- 워크어라운드 탐지 (TODO/FIXME/HACK)
- 컴포넌트 문서화 준수율
- 리팩토링 대기 항목

**Output**: `reports/inspection-results.json` (5분 TTL)

```json
{
  "schemaVersion": "2025-10-inspect-v1",
  "timestamp": "2025-10-01T12:00:00Z",
  "ttl": 300,
  "autoFixable": [
    { "id": "prettier", "command": "npx prettier --write ." }
  ],
  "manualApprovalNeeded": [
    { "id": "typescript-errors", "severity": "critical", "count": 5 }
  ],
  "summary": {
    "healthScore": 80,
    "totalIssues": 10
  }
}
```

---

### 2️⃣ `/maintain` - Auto-fix Only

**Purpose**: 자동 수정 가능 항목만 처리 (승인 불필요)

**Prerequisites**:
- ✅ `reports/inspection-results.json` must exist
- ✅ Cache must be fresh (< 5 minutes)
- ❌ NO diagnosis - reads from cache only

**What it does**:
1. Validate cache (enforceInspectFirst)
2. Read `autoFixable` items from cache
3. Execute commands without approval
4. Display results

**Example**:
```bash
npm run status      # Creates cache
npm run maintain    # Uses cache, auto-fixes
```

**Error if no cache**:
```
⚠️  maintain를 실행하기 전에 /inspect를 먼저 실행하세요

⏰ 진단 결과가 오래되었습니다 (7분 전)

✅ 올바른 순서: npm run status → npm run maintain
```

---

### 3️⃣ `/fix` - Interactive Manual Approval

**Purpose**: 수동 승인 필요 항목 대화형 처리

**Prerequisites**:
- ✅ `reports/inspection-results.json` must exist
- ✅ Cache must be fresh (< 5 minutes)
- ❌ NO diagnosis - reads from cache only

**What it does**:
1. Validate cache (enforceInspectFirst)
2. Read `manualApprovalNeeded` items from cache
3. Interactive approval (y/n/m/a/i)
4. Display results

**Approval Options**:
- `y`: Approve (mark for action)
- `n`: Skip
- `m`: Mark for manual handling
- `a`: Abort entire session
- `i`: Show additional info

**Example**:
```bash
npm run status      # Creates cache
npm run maintain    # Auto-fixes
npm run fix         # Manual approvals
```

---

## 🔒 Enforcement Rules

### Cache TTL: 5 Minutes

```typescript
const TTL_SECONDS = 300; // 5 minutes

// Cache validation
const ageSeconds = (Date.now() - inspectionTime) / 1000;
if (ageSeconds > TTL) {
  throw new Error("Cache expired - re-run /inspect");
}
```

**Why 5 minutes?**
- Short enough to stay fresh
- Long enough for full workflow
- Forces re-inspection after significant changes

---

### Order Enforcement

**NEVER auto-trigger fallback inspection**

```typescript
// ❌ WRONG
if (!hasCache()) {
  runDiagnosis(); // NO!
}

// ✅ CORRECT
if (!hasCache()) {
  console.error("Run /inspect first");
  process.exit(1);
}
```

**GPT Advice**:
> "Never auto-trigger fallback inspection inside /fix"
> "Respect TTL (5 min) for inspection cache"

---

## 📊 Data Flow

```
┌─────────────┐
│  /inspect   │ Creates SoT
│             │────────────┐
└─────────────┘            │
                           ▼
              ┌──────────────────────────┐
              │ inspection-results.json  │
              │ (5-minute TTL)           │
              └──────────────────────────┘
                     │            │
         ┌───────────┘            └───────────┐
         ▼                                    ▼
┌─────────────────┐                  ┌─────────────────┐
│   /maintain     │                  │     /fix        │
│                 │                  │                 │
│ autoFixable[]   │                  │ manualNeeded[]  │
└─────────────────┘                  └─────────────────┘
```

---

## 🛡️ Safety Guarantees

### 1. Consistency

✅ maintain과 fix는 **동일한 진단 결과** 사용
- No race conditions
- No duplicate diagnosis
- Perfect consistency

### 2. Traceability

✅ 모든 수정은 **진단 시점** 기록
- `inspection-results.json`에 timestamp
- 언제 무엇이 발견됐는지 추적 가능

### 3. Reproducibility

✅ 같은 캐시로 **반복 실행** 가능
- maintain 실패 → 재실행 가능
- fix 중단 → 나중에 재개 가능

---

## 🚀 Usage Examples

### Daily Development

```bash
# Morning: Full inspection
npm run status

# Auto-fix formatting
npm run maintain

# Review critical issues
npm run fix

# Commit
git add -A
git commit -m "fix: quality improvements"
```

### Before Deployment

```bash
# Fresh inspection
npm run status

# Auto-fix everything
npm run maintain

# Manual review
npm run fix

# Final verification
npm run ship
```

### CI/CD Pipeline

```yaml
# .github/workflows/quality.yml
- name: Inspect
  run: npm run status

- name: Auto-fix
  run: npm run maintain

# fix는 CI에서 실행 안 함 (수동 승인 필요)
```

---

## ⚠️ Common Pitfalls

### ❌ Wrong: Skip /inspect

```bash
npm run maintain  # ERROR: No cache!
```

**Fix**: Always run `/inspect` first

---

### ❌ Wrong: Stale cache

```bash
npm run status              # 10 minutes ago
# ... code changes ...
npm run maintain            # ERROR: Cache expired!
```

**Fix**: Re-run `/inspect` after significant changes

---

### ❌ Wrong: Manual diagnosis in /fix

```typescript
// In fix-engine.ts - WRONG!
if (!hasCache()) {
  const issues = await runDiagnosis(); // NO!
}
```

**Fix**: Enforce cache requirement

```typescript
// CORRECT
cache.enforceInspectFirst("fix");
```

---

## 📖 Schema Version

```typescript
export interface InspectionResults {
  schemaVersion: "2025-10-inspect-v1";  // For future migration
  timestamp: string;
  ttl: number;
  autoFixable: AutoFixableItem[];
  manualApprovalNeeded: ManualApprovalItem[];
  summary: InspectionSummary;
}
```

**Versioning**: `YYYY-MM-inspect-v{N}`
- Allows automatic migration
- Detects incompatible formats

---

## 🔧 Implementation Files

| File | Purpose |
|------|---------|
| `scripts/inspection-engine.ts` | Run all diagnostics, create cache |
| `scripts/maintain-engine.ts` | Auto-fix from cache |
| `scripts/fix-engine.ts` | Interactive approval from cache |
| `scripts/lib/inspection-schema.ts` | Type definitions |
| `scripts/lib/inspection-cache.ts` | Cache validation & enforcement |

---

## 📚 References

- **COMMAND_GUIDE.md**: User-facing workflow guide
- **DEVELOPMENT_STANDARDS.md**: Code quality standards
- **LLM_DEVELOPMENT_CONTRACT.md**: Development contract

---

## ✨ Key Takeaways

1. **Always** run `/inspect` first (creates SoT)
2. **Never** diagnose in `/maintain` or `/fix`
3. **Respect** 5-minute TTL
4. **Enforce** workflow order programmatically
5. **Trust** the cache for consistency

---

_This architecture ensures safe, consistent, and traceable quality management across the entire system._

**Last Updated**: 2025-10-01
