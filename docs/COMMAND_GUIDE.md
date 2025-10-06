# 명령어 가이드

## 🎯 5단계 워크플로우 (반드시 순서 준수!)

**⚠️ 중요**: 반드시 이 순서를 지켜야 합니다. 순서를 건너뛰면 오류가 발생합니다.

```bash
1. /inspect    # 정밀 진단 (Single Source of Truth 생성)
2. /maintain   # 자동 수정 (캐시 기반, 스타일)
3. /fix        # 대화형 수정 (캐시 기반, 오류)
4. /refactor   # 구조 개선 (캐시 기반, 아키텍처) - 선택적
5. /ship       # 배포 준비 + 실제 배포
```

**추가 명령어**:

```bash
/radar         # 📡 심층 시스템 스캔 (주 1회 또는 큰 변경 전)
               # - 테스트 커버리지 갭 (실제 커버리지 리포트 기반)
               # - 대형 파일 탐지 (1000줄+)
               # - Dead code 분석 (196개 발견)
               # - 보안 취약점 스캔
               # - 중복 의존성 (40개)
               # - Deprecated 파일 불일치
```

**핵심 원칙**:

- `/inspect`가 모든 진단을 수행하고, 나머지 명령어는 그 결과를 사용합니다.
- `/refactor`는 **선택적 단계**입니다. 구조 개선이 필요할 때만 실행하세요.
- `/radar`는 정기 점검용으로 일반 워크플로우와 별개입니다.

---

## 1️⃣ `/inspect` - 정밀 진단

```bash
bash scripts/slash-commands.sh inspect
# OR
npm run status
```

**목적**: Single Source of Truth - 모든 진단을 수행하고 결과를 캐싱

**출력**:

- `reports/inspection-results.json` (30분 TTL)
- 건강도 점수 (0-100)
- Auto-fixable 항목 목록
- Manual approval 항목 목록

**실행 내용**:

- TypeScript 컴파일 검사
- ESLint/Prettier 검사
- 테스트 실행 상태
- 보안 감사
- 워크어라운드 탐지
- 컴포넌트 문서화
- 리팩토링 대기 항목

**사용 시점**: 작업 시작 전, 코드 변경 후, 배포 전 (필수)

---

## 2️⃣ `/maintain` - 자동 수정

```bash
bash scripts/slash-commands.sh maintain
# OR
npm run maintain
```

**목적**: 자동 수정 가능 항목만 처리 (승인 불필요)

**전제조건**:

- ⚠️ **반드시 `/inspect` 먼저 실행** (30분 이내)
- ❌ 진단 안 함 - 캐시만 읽음

**자동 수정 항목** (캐시에서 읽음):

- ✅ Prettier 포맷팅
- ✅ ESLint 자동 수정 가능 경고

**오류 예시**:

```
⚠️ maintain를 실행하기 전에 /inspect를 먼저 실행하세요
⏰ 진단 결과가 오래되었습니다 (7분 전)
✅ 올바른 순서: /inspect → /maintain
```

**사용 시점**: `/inspect` 직후 (30분 이내)

---

## 3️⃣ `/fix` - 대화형 수정

```bash
bash scripts/slash-commands.sh fix
# OR
npm run fix
```

**목적**: 수동 승인 필요 항목 대화형 처리

**전제조건**:

- ⚠️ **반드시 `/inspect` 먼저 실행** (30분 이내)
- ❌ 진단 안 함 - 캐시만 읽음

**수정 항목** (캐시에서 읽음):

- Code Quality (TypeScript 오류, ESLint 에러)
- Component Documentation (문서화 누락)
- Workarounds (TODO/FIXME/HACK)
- Refactoring (리팩토링 대기)

**대화형 승인 옵션**:

- `y`: Approve (승인하고 실행)
- `n`: Skip (건너뛰기)
- `m`: Manual (수동 처리로 표시)
- `a`: Abort (전체 중단)
- `i`: Info (자세한 정보)

**사용 시점**: `/maintain` 직후 (30분 이내)

---

## 4️⃣ `/refactor` - 구조 개선 (선택적)

### 🔍 Step 4a: Preview (권장)

```bash
/refactor-preview    # 미리보기 (변경 없음)
```

**목적**: 리팩토링 영향도 분석 (READ-ONLY)

- 📋 변경 예정 항목 목록 표시
- 🎯 위험도 평가 (Low/Medium/High)
- 📊 영향받는 파일 수 표시
- ⚠️ **변경 없음 - 안전한 미리보기**

### 🔧 Step 4b: Apply

```bash
bash scripts/slash-commands.sh refactor
# OR
npm run refactor
```

**목적**: 구조적 개선 (파일 간 아키텍처 문제 해결)

**전제조건**:

- ⚠️ **반드시 `/inspect` 먼저 실행** (30분 이내)
- ❌ 진단 안 함 - 캐시만 읽음

**처리 항목** (캐시에서 읽음):

- 🔧 중복 export 제거
- 🔧 Config 파일 정규화 (tsconfig drift 등)
- 🔧 모듈 경계 위반 수정
- 🔧 사용하지 않는 import 대량 제거

**MECE 구분**:

| 명령어      | 범위           | 예시                       |
| ----------- | -------------- | -------------------------- |
| `/maintain` | 코드 스타일    | Prettier, ESLint --fix     |
| `/fix`      | 단일 파일 오류 | TypeScript 오류, TODO 마커 |
| `/refactor` | 파일 간 구조   | 중복 export, config drift  |

**안전성**:

- ⚠️ **모든 변경은 수동 승인 필요** (autoFix=false 기본값)
- 📸 Governance 통합 (스냅샷, 롤백 지원)
- 🔍 `/refactor-preview`로 미리 확인 권장

**권장 순서**:

```bash
1. /refactor-preview   # 먼저 미리보기
2. /refactor           # 확인 후 적용 (승인 필요)
3. npm run test        # 테스트 실행
4. /inspect            # 재진단으로 검증
```

**사용 시점**: 구조 개선이 필요할 때 (선택적)

**⚠️ 중요**:

- 이 단계는 **선택적**입니다. 리팩토링 항목이 없으면 건너뛰어도 됩니다.
- **반드시 `/refactor-preview`로 먼저 확인**하세요!

---

## 5️⃣ `/ship` - 배포 준비 + 실제 배포

```bash
bash scripts/slash-commands.sh ship
```

**목적**: 배포 직전 최종 검증 및 실제 배포

**실행 순서** (3단계):

### Phase 1: Pre-ship Validation

- 오래된 파일 정리
- 명령어 레퍼런스 업데이트

### Phase 2: Ship Pipeline

1. 설계 원칙 검증 (`design:validate`)
2. 시스템 검증 (`validate`)
3. 확인 (`verify`)
4. 통합 가드 (`integration-guard`)
5. 시스템 통합 분석 (`system-integration`)
6. 고급 감사 (`advanced:audit`)
7. 문서 동기화 (`docs:refresh`)
8. 최적화 분석 (`optimize:analyze`)

### Phase 3: Deploy

- Auto-commit with timestamp
- Push to remote repository

**사용 시점**: 배포 직전, PR 머지 후

---

## 🚀 완전한 워크플로우

### 일상 개발 (간단한 수정)

```bash
# 1. 정밀 진단
/inspect

# 2. 자동 수정 (스타일)
/maintain

# 3. 대화형 수정 (오류)
/fix

# 4. 배포 (구조 개선 건너뛰기)
/ship
```

### 구조 개선 포함 (완전한 5단계)

```bash
# 1. 정밀 진단
/inspect

# 2. 자동 수정 (Prettier, ESLint)
/maintain

# 3. 대화형 수정 (승인 필요 항목)
/fix

# 4a. 구조 개선 미리보기 (권장)
/refactor-preview

# 4b. 구조 개선 적용
/refactor

# 5. 배포 준비 + 배포
/ship

# 완료!
# Changes pushed to remote repository
```

### 배포 전 체크리스트

```
□ /inspect 실행 완료 (건강도 85+ 확인)
□ /maintain 실행 완료 (스타일 자동 수정)
□ /fix 실행 완료 (TypeScript/Workaround 수정)
□ /refactor-preview 실행 (구조 개선 미리보기, 선택적)
□ /refactor 실행 완료 (구조 개선 적용, 선택적)
□ 테스트 통과 확인 (npm run test)
□ TypeScript 오류 0개 확인 (npm run typecheck)
□ 재진단 확인 (/inspect 다시 실행)
□ /ship 실행 준비 완료
```

### CI/CD (자동)

```bash
npm run design:validate  # 설계 검증
npm run dev:lint         # ESLint
npm run dev:typecheck    # TypeScript
npm run test:coverage    # 테스트
npm run build            # 빌드
```

---

## 💡 FAQ

### Q1: 4단계를 모두 실행해야 하나요?

**A**:

- **일상 개발**: /inspect → /maintain → /fix (3단계)
- **배포 전**: 위 3단계 + /ship (4단계)

### Q2: 순서를 건너뛰면 안 되나요?

**A**: **절대 안 됩니다!** 순서를 건너뛰면 오류가 발생합니다.

- `/maintain`이나 `/fix`를 `/inspect` 없이 실행하면 강제 종료됩니다.
- 캐시가 5분 이상 오래되면 재실행을 요구합니다.

### Q3: `/maintain` vs `/fix` 차이는?

**A**:

- `/maintain`: 자동 수정 (Prettier, ESLint --fix) - 승인 불필요, 캐시 기반
- `/fix`: 대화형 수정 (TypeScript 오류, 워크어라운드) - 승인 필요, 캐시 기반
- **둘 다 진단하지 않음** - 오직 캐시에서만 읽음

### Q4: `/ship`은 언제 실행하나요?

**A**: 배포 직전에만 실행합니다. 일상 개발에서는 불필요합니다.

### Q5: 워크어라운드는 어떻게 처리?

**A**: `/fix` 실행 시 워크어라운드가 자동 검출됩니다. 대화형 승인에서 선택:

- `y`: 수동 검토 안내 (grep 명령어 제공)
- `n`: 건너뛰기
- `m`: 직접 처리

### Q6: 시스템 통합 검증은 언제?

**A**: `/ship` 실행 시 자동으로 통합 검증, 시스템 분석, 설계 검증이 실행됩니다.

---

## 🔧 추가 명령어

### GAP Scanner (Quality Assurance)

```bash
npm run gap:scan              # Run full GAP scan (shadow mode)
npm run gap:scan:quick        # Quick scan (fast checks only)
npm run gap:scan:metrics      # GAP metrics and trends
npm run gap:config            # Manage GAP configuration
npm run gap:pr-bot            # GAP PR validation bot
npm run gap:backup            # Backup lifecycle manager
npm run gap:dashboard         # Visual dashboard (one-time)
npm run gap:watch             # Live dashboard (auto-refresh)
npm run init:gap-system       # Initialize GAP system (one-time setup)
```

**Purpose**: Prevent quality gaps before they become issues
**Checks**: 9 comprehensive checks including CLI docs, governance sync, PII masking, test coverage, doc lifecycle, and more

### Document Lifecycle Management

```bash
npm run doc:lifecycle -- --analyze              # Analyze all documents status
npm run doc:lifecycle:analyze                   # Same as above (shorthand)
npm run doc:lifecycle -- --find-stale           # Find stale documents (90+ days)
npm run doc:lifecycle:stale                     # Same as above (shorthand)
npm run doc:lifecycle -- --deprecate <path>     # Deprecate a document
npm run doc:lifecycle -- --archive <path>       # Archive a document
npm run doc:lifecycle -- --cleanup              # Clean up expired docs
npm run doc:lifecycle:cleanup                   # Same as above (shorthand)
```

**Purpose**: Manage document lifecycle (active → deprecated → deleted)
**Features**: Auto-detection, reference tracking, grace period (90 days)

### Validation & Verification

```bash
/validate                 # Validate system configuration
npm run /validate         # Same as above
/verify                   # Verify system integrity
npm run /verify           # Same as above
check:all                 # Run all checks
check:quick               # Quick validation checks
check:typescript          # TypeScript-only check
check:P0-only             # P0 critical checks only
check:node                # Node.js environment check
check:signatures          # Verify file signatures
```

### System Management

```bash
/sync                     # Complete system update (docs, cleanup, commit, push)
sync:auto                 # Automated sync workflow
/clean                    # Cleanup old files
/communicate              # Communication management
communicate               # Communication tools
communicate:manual        # Manual communication mode
/update                   # Smart update system
smart:update              # Intelligent system update
system:clear-queue        # Clear processing queue
system:design             # System design tools
system:evolve             # Evolve system architecture
system:designfirstsystemarchitect  # Design-first architecture
```

### Approval & Workflow

```bash
approve                   # Approve pending changes
approve:status            # Check approval status
approve:clear             # Clear approval queue
approve:interactive       # Interactive approval mode
confirm-sync              # Confirm sync operation
confirm-release           # Confirm release
deny-sync                 # Deny sync operation
deny-release              # Deny release
review-sync               # Review sync changes
prepare-release           # Prepare for release
queue:status              # Check queue status
queue:execute             # Execute queued items
queue:demo                # Demo queue functionality
```

### Design & Architecture

```bash
design:analyze            # Analyze design principles
design:audit              # Audit design compliance
design:rollback           # Rollback design changes
design:status             # Check design status
evolution:analyze         # Analyze architectural evolution
evolution:evolve          # Evolve architecture
registry:generate         # Generate component registry
registry:search           # Search component registry
registry:violations       # Find registry violations
registry:suggestions      # Get registry suggestions
registry:summary          # Registry summary
```

### Documentation

```bash
docs:audit:full           # Full documentation audit
docs:gate                 # Documentation quality gate
docs:gate:ci              # CI documentation gate
docs:lint                 # Lint documentation
docs:signals:validate     # Validate documentation signals
docs:update               # Update documentation
```

### Testing & Quality

```bash
test:approval             # Test approval mechanism
ci:quality                # CI quality checks
ci:strict                 # Strict CI validation
fix:unused-vars           # Fix unused variables
fix:legacy                # Fix legacy code issues
lint:fix                  # Auto-fix linting issues
```

### Integration & Advanced

```bash
integration:audit         # Audit integrations
integration:create        # Create new integration
integration:improve       # Improve integrations
advanced:improve          # Advanced improvement engine
reports:consolidate       # Consolidate reports
```

### Metrics & Monitoring

```bash
metrics:report            # Generate metrics report
metrics:export            # Export metrics
metrics:auto              # Automated metrics collection
routing:status            # Check routing status
snapshot:browser          # Browse snapshots
snapshot:dashboard        # Snapshot dashboard
snapshot:recent           # Recent snapshots
snapshot:interactive      # Interactive snapshot mode
status:quick              # Quick status check
optimize:trends           # Analyze optimization trends
```

### Improvement & Analysis

```bash
improve:analyze           # Analyze improvements
improve:dry-run           # Dry-run improvement
improve:force-d           # Force D-grade improvement
improve:status            # Check improvement status
workflow:gaps             # Identify workflow gaps
workflow:optimize         # Optimize workflows
policy:reflect            # Reflect policy changes
policy:watch              # Watch policy compliance
```

### Maintenance & Reports

```bash
maintain:legacy:quick     # Quick legacy maintenance
maintain:legacy:safe      # Safe legacy maintenance
maintain:legacy:snapshot  # Legacy maintenance snapshot
report:maintain           # Maintenance report
report:maintain:smart     # Smart maintenance report
pending:review            # Review pending items
```

### Build & Ship

```bash
build:export              # Export build artifacts
ship:docs                 # Ship documentation
ship:legacy               # Ship legacy code
ship:safe                 # Safe ship with backup
```

### Alerts & Triggers

```bash
alerts:approve            # Approve alerts
alerts:show               # Show alerts
alerts:test               # Test alert system
triggers:add              # Add new trigger
triggers:start            # Start triggers
```

### Recovery & Rollback

```bash
recovery:rollback         # Rollback system changes
recovery:status           # Check recovery status
```

### Generators & Utilities

```bash
general:newcomponent      # Generate new component
generator:baselinereportgenerator  # Generate baseline report
handoff                   # Generate handoff documentation
system component:testcomponent     # Test component system
```

---

## 📖 Related Documentation

**Quality & Prevention:**

- See: [@file docs/GAP_SCANNER_GUIDE.md](GAP_SCANNER_GUIDE.md) - GAP Scanner user guide
- See: [@file docs/DEVELOPMENT_STANDARDS.md](DEVELOPMENT_STANDARDS.md) - Development standards
- See: [@file docs/TYPESCRIPT_GUIDELINES.md](TYPESCRIPT_GUIDELINES.md) - TypeScript guidelines

**Workflow & Planning:**

- See: [@file docs/ROLLOUT_PLAN.md](ROLLOUT_PLAN.md) - Rollout and rollback strategy
- See: [@file docs/TEST_PLAN.md](TEST_PLAN.md) - Testing strategy
- See: [@file docs/PLAN_super.md](PLAN_super.md) - UX 4-step release plan

**System & Architecture:**

- See: [@file CLAUDE.md](../CLAUDE.md) - System philosophy and architecture
- See: [@file docs/SYSTEM_ARCHITECTURE_MAP.md](SYSTEM_ARCHITECTURE_MAP.md) - Architecture map

---

**🎯 핵심**: `/inspect` → `/maintain` → `/fix` → `/ship` 순서 준수!

_최종 업데이트: 2025-10-01_

---

## 📡 `/radar` - 심층 시스템 스캔

```bash
npm run radar
# OR
npm run /radar
```

**목적**: 숨겨진 치명적 이슈 발견 (정기 점검용)

**특징**:

- 커버리지 리포트가 없으면 **자동 생성** 후 분석
- `src/shared/` 전체를 스캔하여 0% 커버리지 파일 발견
- 실제 커버리지 데이터 기반 정밀 분석

**사용 시점**:

- 주 1회 정기 점검
- 큰 기능 추가 전
- 릴리즈 전 최종 검증

**검사 항목**:

1. **테스트되지 않은 Critical 파일** (P0)

   - 핵심 파일 9개 + src/shared/ 전체 스캔
   - 실제 커버리지 리포트 기반 (자동 생성)

2. **대형 파일 탐지** (P1)

   - 1000줄 이상 파일 리스트
   - 모듈 분리 권장

3. **Deprecated 파일 불일치** (P1)

   - 문서에 deprecated로 표시되었지만 여전히 존재하는 파일

4. **불필요한 백업 파일** (P2)

   - .backup, .old, .deprecated 파일
   - .system-backups 디렉토리

5. **중복 의존성** (P2)

   - 동일 패키지의 여러 버전 설치

6. **Dead Code** (P2)

   - 사용되지 않는 export (ts-prune 사용)

7. **보안 취약점** (P0/P1)

   - npm audit 결과

8. **Git 이슈** (P2)
   - 커밋되지 않은 큰 파일 (1MB+)

**출력 예시**:

```
🎯 Health Score: 45/100

📋 Summary:
   Total Issues: 6
   🔴 P0 Critical: 1
   🟡 P1 High: 2
   🟢 P2 Medium: 3

🔍 Critical Issues:
   [P0] Testing: 6개의 핵심 파일에 테스트 없음
   [P1] Code Structure: 14개의 거대 파일 (1000줄+)
   [P1] Documentation: 3개의 deprecated 파일이 여전히 존재

🚀 Recommended Actions:
   1. [HIGH] P0 이슈 즉시 해결
   2. [MEDIUM] 불필요한 백업 파일 삭제
```

**일반 워크플로우와의 차이**:

| 명령어     | 목적      | 빈도   | 캐시 | 커버리지    |
| ---------- | --------- | ------ | ---- | ----------- |
| `/inspect` | 일상 진단 | 매번   | 30분 | ❌          |
| `/radar`   | 심층 스캔 | 주 1회 | 없음 | ✅ 자동생성 |

**다음 단계**:

- P0 이슈: 즉시 해결 필요
- P1 이슈: 1주일 내 해결
- P2 이슈: 점진적 개선
