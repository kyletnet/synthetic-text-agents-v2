# 슬래시 명령어 통합 계획

**작성일**: 2025-10-05
**목적**: 명령어 중복 제거, MECE 달성, 워크플로우 최적화

---

## 📊 현황 분석

### 1. 문서 모니터링 & 정리 ✅

**현재 명령어**:

```bash
# 문서 생명주기 관리
npm run doc:lifecycle              # 전체 분석
npm run doc:lifecycle:stale        # 90일 이상 미수정 문서 탐지
npm run doc:lifecycle:cleanup      # 만료된 문서 정리

# 문서-코드 drift 탐지
npm run docs:drift-scan            # 코드 변경 vs 문서 미변경 탐지
npm run docs:drift-scan:fix        # lastVerified 자동 업데이트
npm run docs:drift-scan:report     # 상세 리포트 생성
```

**통합 필요**: `/inspect`에 포함 ❌ (독립 실행)
**이유**: 문서 관리는 개발 워크플로우와 별도

**권장**: 주간 스케줄링

```yaml
# .github/workflows/weekly-housekeeping.yml
schedule:
  - cron: "0 9 * * MON" # 매주 월요일 9am
jobs:
  doc-cleanup:
    runs-on: ubuntu-latest
    steps:
      - run: npm run doc:lifecycle:stale
      - run: npm run docs:drift-scan:report
```

---

### 2. 설계/구현 지속 모니터링 ✅

#### 현재 메커니즘

| 명령어              | 목적                     | 실행 시점      | 자동화 |
| ------------------- | ------------------------ | -------------- | ------ |
| `design:validate`   | 설계 원칙 준수 검증      | `/ship`, CI/CD | ✅     |
| `_arch:validate`    | 아키텍처 불변성 검증     | CI/CD          | ✅     |
| `integration:audit` | 통합 품질 검사           | `/ship`        | ✅     |
| `advanced:audit`    | 리팩토링 안전성 검사     | `/ship`        | ✅     |
| `gap:scan`          | 설계-구현 gap 탐지       | 수동           | ❌     |
| `/gaps`             | P0/P1/P2 gap 탐지 (신규) | 수동           | ❌     |

#### ⚠️ 중복 발견: `gap:scan` vs `/gaps`

**`gap:scan`** (기존):

```typescript
// scripts/gap-scanner.ts
- Guidelines 미구현
- Doc lifecycle 미연결
- Quality history 미사용
```

**`/gaps`** (신규):

```typescript
// scripts/gaps-engine.ts
- Guidelines 미구현
- CI/CD 통합
- Quality history
- Doc drift
- Test coverage
- Promised features
```

**결론**: `/gaps`가 더 포괄적 → `gap:scan` deprecated 처리

---

### 3. `/gaps` 명령어 워크플로우 통합

#### 현재 위치 (독립)

```bash
/inspect → /maintain → /fix → /ship
                                   └─ (독립) /gaps
```

#### 제안: 주기적 실행

**일상 개발** (매일):

```bash
/inspect → /maintain → /fix → git commit
```

**주간 점검** (주 1회):

```bash
/inspect --deep → /gaps → /maintain → /fix → /ship
     ↓             ↓
  진단 (5-10분)  Gap 탐지
```

**배포 전** (릴리즈):

```bash
/inspect → /gaps → /maintain → /fix → /ship
                                        ↓
                                   검증 + 배포
```

#### `/gaps` 자동 실행 제안

**옵션 A**: `/inspect --deep`에 통합

```typescript
// inspection-engine.ts
if (mode === "deep") {
  await runDiagnostics();
  await detectGaps(); // /gaps 자동 실행
}
```

**옵션 B**: 독립 유지 + CI/CD 추가

```yaml
# .github/workflows/gap-detection.yml (주 1회)
schedule:
  - cron: "0 9 * * MON"
jobs:
  gap-detection:
    - run: npm run gaps -- --create-issues
```

**권장**: **옵션 B** (관심사 분리)

---

### 4. 명령어 논리 구조 개선

#### 현재 문제점

**문제 1: 중복된 검증 명령어**

```bash
/validate           # scripts/validate-engine.ts
validate:llm-io     # scripts/validate-llm-io.ts
/verify             # scripts/verify-engine.ts
_arch:validate      # scripts/validate-architecture.ts
design:validate     # scripts/design-validator.ts
```

→ **5개 validate/verify 명령어** (역할 불명확)

**문제 2: 중복된 audit 명령어**

```bash
advanced:audit      # scripts/smart-refactor-auditor.ts
integration:audit   # scripts/integration-enforcement-system.ts
docs:audit:full     # scripts/docs/doc-audit.ts
```

→ **3개 audit 명령어** (MECE 위반)

**문제 3: gap 명령어 중복**

```bash
gap:scan            # scripts/gap-scanner.ts (기존)
/gaps               # scripts/gaps-engine.ts (신규, 더 포괄적)
```

#### 개선 계획

##### Phase 1: Deprecated 처리 (즉시)

```json
// package.json
{
  "scripts": {
    "gap:scan": "echo '⚠️  DEPRECATED: Use /gaps instead' && npm run /gaps",
    "gap:scan:quick": "echo '⚠️  DEPRECATED: Use /gaps instead' && npm run /gaps"
  }
}
```

##### Phase 2: Validate 명령어 통합 (1주일)

**현재 (분산)**:

```
/validate        → 뭘 검증?
validate:llm-io  → LLM I/O 검증
/verify          → 뭘 검증?
_arch:validate   → 아키텍처 검증
design:validate  → 설계 검증
```

**제안 (통합)**:

```
/validate               → 종합 검증 (아래 모두 실행)
  ├─ validate:arch      → 아키텍처
  ├─ validate:design    → 설계 원칙
  ├─ validate:llm-io    → LLM I/O
  └─ validate:integration → 통합
```

##### Phase 3: Audit 명령어 통합 (1주일)

**현재 (분산)**:

```
advanced:audit      → 리팩토링 안전성
integration:audit   → 통합 품질
docs:audit:full     → 문서 품질
```

**제안 (통합)**:

```
/audit                  → 종합 감사
  ├─ audit:refactor     → 리팩토링
  ├─ audit:integration  → 통합
  └─ audit:docs         → 문서
```

---

### 5. MECE 최종 구조

#### 핵심 워크플로우 (사용자 직접 실행)

| 명령어                | 역할        | 실행 빈도 | 소요 시간 |
| --------------------- | ----------- | --------- | --------- |
| **`/inspect`**        | 빠른 진단   | 매일      | 1-2분     |
| **`/inspect --deep`** | 심층 진단   | 주 1회    | 5-10분    |
| **`/maintain`**       | 자동 수정   | 매일      | ~1분      |
| **`/fix`**            | 대화형 수정 | 필요 시   | 대화형    |
| **`/gaps`**           | Gap 탐지    | 주 1회    | 2-3분     |
| **`/ship`**           | 배포 준비   | 릴리즈    | 5-8분     |

#### 지원 명령어 (내부/자동 실행)

| 명령어                | 역할       | 호출자       |
| --------------------- | ---------- | ------------ |
| **`/validate`**       | 종합 검증  | `/ship`      |
| **`/audit`**          | 종합 감사  | `/ship`      |
| **`/refactor`**       | 구조 개선  | 선택적       |
| **`doc:lifecycle`**   | 문서 관리  | CI/CD (주간) |
| **`docs:drift-scan`** | Drift 탐지 | CI/CD (주간) |

#### Deprecated (삭제 예정)

```bash
/guard              → /inspect로 대체
/radar              → /inspect --deep로 대체
gap:scan            → /gaps로 대체
```

---

### 6. 캐시 & 의존성 흐름도

```mermaid
graph TD
    A[/inspect] -->|생성| B[inspection-results.json]
    A -->|생성| C[quality-history/]

    B -->|읽기| D[/maintain]
    B -->|읽기| E[/fix]

    F[/gaps] -->|독립| G[reports/gaps/latest.json]

    D --> H[자동 수정 실행]
    E --> I[대화형 승인]

    J[/ship] -->|독립| K[/validate]
    J -->|독립| L[/audit]
    J -->|독립| M[docs:refresh]

    style A fill:#90EE90
    style F fill:#90EE90
    style J fill:#FFB6C1
```

**캐시 정책**:

- `inspection-results.json`: 30분 TTL
- `reports/gaps/latest.json`: 무제한 (수동 갱신)
- Quality history: 30일 보존

---

### 7. 순서 & 맥락

#### 일상 개발 워크플로우

```bash
# 1. 진단 (매일 아침)
npm run status

# 2. 자동 수정 (발견된 이슈)
npm run maintain

# 3. 대화형 수정 (남은 이슈)
npm run fix

# 4. 커밋
git add -A && git commit -m "fix: 품질 개선"
```

#### 주간 점검 워크플로우

```bash
# 월요일 아침
npm run status:deep    # 심층 진단 (5-10분)
npm run gaps           # Gap 탐지 (2-3분)

# Gap 발견 시
npm run maintain       # 자동 수정
npm run fix            # 수동 수정

# 선택적: 리팩토링
npm run /refactor-preview
npm run /refactor

# 완료
npm run ship
```

#### 릴리즈 워크플로우

```bash
# 1. 최종 진단
npm run status
npm run gaps

# 2. 이슈 해결
npm run maintain
npm run fix

# 3. 배포 준비
npm run ship    # Includes: validate + audit + docs:refresh + optimize

# 4. 배포
git push origin main
```

---

### 8. 개선 우선순위

#### P0 (즉시 - 오늘)

1. **`gap:scan` Deprecated 처리** ✅

   ```json
   "gap:scan": "echo '⚠️  DEPRECATED: Use /gaps' && npm run /gaps"
   ```

2. **Protected Files Pre-commit Hook** 🆕

   ```bash
   # .git/hooks/pre-commit
   npx tsx scripts/check-protected-files.ts
   ```

3. **`/gaps` → GitHub Issue 자동 생성** 🆕
   ```typescript
   // gaps-engine.ts 개선
   if (gap.severity === "P0") {
     await createGitHubIssue(gap);
   }
   ```

#### P1 (1주일)

4. **Validate 명령어 통합**
   - `/validate` → 종합 검증
   - `validate:arch`, `validate:design` 등 하위 명령어

5. **Audit 명령어 통합**
   - `/audit` → 종합 감사
   - `audit:refactor`, `audit:integration` 등

6. **CI/CD Gap Detection**
   ```yaml
   # .github/workflows/weekly-gap-scan.yml
   schedule:
     - cron: "0 9 * * MON"
   ```

#### P2 (1개월)

7. **성능 회귀 탐지**

   ```bash
   npm run perf:baseline
   npm run perf:check
   ```

8. **자동 Rollback**

   ```bash
   npm run rollback    # 마지막 snapshot 복구
   ```

9. **실시간 모니터링**
   ```bash
   npm run gaps:watch  # 파일 변경 감지
   ```

---

### 9. 리팩토링 위험 요소

#### 🔴 즉시 해결 필요

**1. 중복 리팩토링 스크립트**

```bash
scripts/refactor-engine.ts
scripts/refactor-preview-engine.ts
scripts/refactor-auditor.ts
scripts/smart-refactor-auditor.ts
```

→ **권장**: 단일 엔진으로 통합

**2. Protected Files 수정 차단 미흡**

- 현재: `/inspect`, CI/CD에서만 검사
- 누락: 직접 Edit 시 차단 없음
- **해결**: Pre-commit hook 추가

**3. Legacy 코드 미정리**

```bash
legacy/scripts/fix-orchestrator.ts
legacy/scripts/...
```

→ **권장**: `tsconfig.build.json`에서 `legacy/` 제외

---

### 10. 최종 MECE 검증

#### ✅ 달성된 MECE

| 영역 | 명령어                             | 중복 제거                |
| ---- | ---------------------------------- | ------------------------ |
| 진단 | `/inspect`, `/inspect --deep`      | ✅ (/radar 통합)         |
| 수정 | `/maintain`, `/fix`                | ✅                       |
| Gap  | `/gaps`                            | ✅ (gap:scan deprecated) |
| 배포 | `/ship`                            | ✅                       |
| 문서 | `doc:lifecycle`, `docs:drift-scan` | ✅                       |

#### ⚠️ 개선 필요 (중복 존재)

| 영역     | 문제                     | 해결             |
| -------- | ------------------------ | ---------------- |
| 검증     | 5개 validate 명령어 분산 | `/validate` 통합 |
| 감사     | 3개 audit 명령어 분산    | `/audit` 통합    |
| 리팩토링 | 4개 스크립트 중복        | 단일 엔진 통합   |

---

## 🎯 실행 계획

### 즉시 (오늘)

```bash
# 1. gap:scan deprecated
sed -i '' 's/"gap:scan":.*/"gap:scan": "echo DEPRECATED && npm run \/gaps",/' package.json

# 2. Protected files hook 생성
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
npx tsx scripts/check-protected-files.ts || exit 1
EOF
chmod +x .git/hooks/pre-commit

# 3. gaps → GitHub issue 연동
# scripts/gaps-engine.ts에 createGitHubIssue() 추가
```

### 1주일 내

```bash
# 4. Validate 통합
npm run /validate 실행 시 모든 검증 자동 실행

# 5. Audit 통합
npm run /audit 실행 시 모든 감사 자동 실행

# 6. CI/CD Gap Scan
.github/workflows/weekly-gap-scan.yml 생성
```

### 1개월 내

```bash
# 7. 성능 회귀 탐지
# 8. 자동 Rollback
# 9. 실시간 모니터링
```

---

**작성**: System Architect
**검토**: Quality Governance Team
**승인 필요**: P0 항목 즉시 착수
