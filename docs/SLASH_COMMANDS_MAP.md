# 슬래시 명령어 구조 및 실행 순서

**작성일**: 2025-10-07
**버전**: 2.0 (Regression Guard 추가)

---

## 📊 명령어 분류 체계

### 🎯 Track 1: 일상 개발 워크플로우 (4단계)

```
/inspect → /maintain → /fix → /ship
(진단)    (자동수정)   (대화형)  (배포)
```

### 🛡️ Track 2: 품질 게이트 (선택적)

```
/radar → /refactor → /guard → /rg:run
(부채탐지) (리팩토링)  (검증)   (회귀방지)
```

### 🔧 Track 3: 유틸리티 명령어

```
/validate, /verify, /update, approve:*, metrics:*
```

---

## 🔄 Track 1: 일상 개발 워크플로우

### 1️⃣ `/inspect` (진단)

**목적**: 시스템 전체 상태 진단 (Single Source of Truth)

**실행**:

```bash
npm run status
# = tsx scripts/inspection-engine.ts
```

**출력**:

- `reports/inspection-results.json` (5분 TTL)

**검사 항목**:

- ✅ TypeScript 타입 오류
- ✅ ESLint/Prettier 위반
- ✅ 테스트 실패
- ✅ 보안 취약점 (npm audit)
- ✅ TODO/FIXME/Workarounds
- ✅ 문서화 누락

**사용 시점**:

- 작업 시작 전
- 커밋 전
- PR 생성 전

---

### 2️⃣ `/maintain` (자동 수정)

**목적**: 승인 없이 자동으로 수정 가능한 항목 처리

**실행**:

```bash
npm run maintain
# = tsx scripts/maintain-engine.ts
```

**수정 항목**:

- ✅ Prettier 포맷팅
- ✅ ESLint --fix로 자동 수정 가능한 위반
- ✅ 설계 검증 (간단한 구조 문제)

**특징**:

- 캐시 기반 (inspection-results.json 읽음)
- **승인 불필요** (안전한 변경만)
- 빠른 실행 (~10초)

---

### 3️⃣ `/fix` (대화형 수정)

**목적**: 승인이 필요한 복잡한 문제 해결

**실행**:

```bash
npm run fix
# = tsx scripts/fix-engine.ts
```

**수정 항목**:

- ⚠️ TypeScript 타입 오류
- ⚠️ Workarounds 제거
- ⚠️ 문서화 누락 보완
- ⚠️ 복잡한 리팩토링

**특징**:

- 캐시 기반 (inspection-results.json 읽음)
- **승인 필요** (변경 범위 큼)
- 대화형 프롬프트

---

### 4️⃣ `/ship` (배포 준비)

**목적**: 통합 검증 + 문서 동기화 + 최적화 + 배포

**실행**:

```bash
npm run ship
# = bash scripts/ship-with-progress.sh
```

**수행 작업**:

1. 전체 검증 (design:validate, validate, verify)
2. 통합 가드 (\_hidden:integration-guard)
3. 시스템 통합 분석 (\_hidden:system-integration)
4. 고급 감사 (advanced:audit)
5. 문서 갱신 (docs:refresh)
6. 최적화 분석 (optimize:analyze)
7. 커밋 + 푸시 준비

**사용 시점**:

- 배포 직전
- PR 머지 전

---

## 🛡️ Track 2: 품질 게이트

### 🔍 `/radar` (기술 부채 탐지)

**목적**: 심층 스캔으로 숨겨진 기술 부채 발견

**실행**:

```bash
npm run radar
# = tsx scripts/radar-engine.ts
```

**탐지 항목**:

- 📊 테스트 커버리지 갭 (0% 파일)
- 📦 거대 파일 + 품질 영향 분석
- 🔄 중복 의존성
- 🚫 Unused exports
- 🔒 보안 취약점
- 📁 Git 이슈

**특징**:

- 실행 시간: 5-10분 (전체 스캔)
- 주 1회 실행 권장
- `/inspect`보다 심층 분석

---

### 🔧 `/refactor` (리팩토링)

**목적**: radar가 발견한 부채 해결

**실행**:

```bash
npm run refactor
# = tsx scripts/refactor-engine.ts
```

**수행 작업**:

- P2 자동 필터링 (radar 결과 기반)
- 구조적 리팩토링
- Cross-module 개선

**Preview 모드**:

```bash
npm run refactor:preview
# 변경사항 미리보기 (dry-run)
```

---

### ✅ `/guard` (빠른 검증)

**목적**: 빠른 품질 체크

**실행**:

```bash
npm run guard
# = tsx scripts/guard.ts
```

**검증 항목**:

- TypeScript 컴파일
- ESLint
- 기본 테스트

**옵션**:

```bash
npm run guard:quick   # 더 빠른 버전
npm run guard:report  # 상세 리포트
```

---

### 🛡️ **`/rg:run`** (Regression Guard) ⭐ NEW

**목적**: 자율 거버넌스 루프 회귀 방지 (하드 게이트)

**실행**:

```bash
npm run rg:run
# = tsx scripts/rg/run-regression-guard.ts
```

**게이트**:

- ✅ **Gate A (Static/DNA)**: DDD 경계 + Meta-Kernel 검증
- ✅ **Gate B (Autonomy)**: 자율 루프 3/3 테스트 (drift, objective, feedback)
- ✅ **Gate C (Stability)**: 최근 10회 실행 중 9회 PASS
- ✅ **Gate D (Budget)**: 프로필별 비용 제한 (dev: $0.20, stage: $0.50, prod: $1.00)

**Exit Code**:

- `0`: PASS 또는 WARN (배포 허용)
- `1`: FAIL (배포 차단)

**프로필**:

```bash
npm run rg:run -- --profile=dev    # 개발 (기본)
npm run rg:strict                  # 엄격 모드
npm run rg:run -- --fast           # 빠른 모드 (Gate C 생략)
```

**출력**:

- `reports/rg/summary.json`
- `reports/rg/decision.json`
- `reports/rg/evidence/*.json`
- `reports/rg/policy-hash.txt`

**사용 시점**:

- 커밋 전 (pre-push hook)
- CI/CD 파이프라인
- 배포 직전

**관련 명령어**:

```bash
npm run arch:check        # Gate A만 실행
npm run governance:verify # rg:run 별칭
```

---

## 🔧 Track 3: 유틸리티 명령어

### 검증 명령어

```bash
/validate        # 일반 검증
/validate:llm-io # LLM I/O 검증
/validate:unified # 통합 검증
/verify          # 추가 검증
```

### 업데이트 명령어

```bash
/update          # 스마트 업데이트 (승인 시스템)
smart:update     # 동일
```

### 승인 큐 관리

```bash
approve          # 승인 처리
approve:status   # 큐 상태
approve:clear    # 큐 비우기
queue:status     # Dry-run 큐 상태
queue:execute    # Dry-run 큐 실행
```

### 메트릭 & 스냅샷

```bash
metrics:report   # 성능 메트릭 리포트
metrics:export   # 메트릭 내보내기
metrics:auto     # 자동 메트릭

snapshot:browser      # 스냅샷 브라우저
snapshot:dashboard    # 상세 대시보드
snapshot:recent       # 최근 스냅샷
snapshot:interactive  # 인터랙티브 모드
```

### 성능 개선

```bash
improve:analyze   # 성능 분석
improve:dry-run   # Dry-run 분석
improve:status    # 개선 상태
improve:force-d   # D등급 강제 분석
```

---

## 📋 실행 순서별 시나리오

### 🚀 시나리오 1: 일상 개발

```bash
# 1. 진단
npm run status

# 2. 자동 수정
npm run maintain

# 3. 대화형 수정 (필요시)
npm run fix

# 4. 커밋
git add -A
git commit -m "feat: 새 기능 추가"
```

---

### 🚢 시나리오 2: 배포 전 (권장)

```bash
# 1. 진단
npm run status

# 2. 자동 수정
npm run maintain

# 3. 대화형 수정
npm run fix

# 4. Regression Guard 검증 ⭐
npm run rg:run

# 5. 배포 준비
npm run ship

# 6. 푸시
git push origin main
```

---

### 🔍 시나리오 3: 주간 정비 (Weekly)

```bash
# 1. 기술 부채 탐지
npm run radar

# 2. 부채 해결
npm run refactor

# 3. 검증
npm run rg:run

# 4. 커밋
git add -A
git commit -m "refactor: 기술 부채 해결"
```

---

### 🆘 시나리오 4: 긴급 핫픽스

```bash
# 1. 빠른 진단
npm run guard:quick

# 2. 수정

# 3. 빠른 검증
npm run rg:run -- --fast

# 4. 배포
npm run ship
```

---

## 🎯 명령어 우선순위 매트릭스

| 명령어           | 빈도       | 소요시간 | 중요도     | 자동화        |
| ---------------- | ---------- | -------- | ---------- | ------------- |
| `/inspect`       | 매일       | 1-2분    | ⭐⭐⭐     | ✅ pre-commit |
| `/maintain`      | 매일       | ~10초    | ⭐⭐⭐     | ✅ 자동실행   |
| `/fix`           | 주 2-3회   | 5-10분   | ⭐⭐       | ❌ 대화형     |
| `/ship`          | 배포시     | 3-5분    | ⭐⭐⭐     | ✅ CI/CD      |
| `/radar`         | 주 1회     | 5-10분   | ⭐⭐       | ⏰ 정기실행   |
| `/refactor`      | 주 1회     | 10-30분  | ⭐⭐       | ❌ 수동       |
| `/guard`         | 필요시     | ~30초    | ⭐         | ✅ 옵션       |
| **`/rg:run`** ⭐ | **배포시** | **~3초** | **⭐⭐⭐** | **✅ CI/CD**  |

---

## 🔗 명령어 의존성 그래프

```
/inspect (진단)
    ↓
    ├─→ /maintain (자동수정) ──┐
    ├─→ /fix (대화형수정) ─────┤
    └─→ /radar (부채탐지) ──┐  │
                           ↓  │
         /refactor (리팩토링) ─┤
                              ↓
                    /rg:run (회귀방지) ⭐
                              ↓
                         /ship (배포)
```

---

## 📝 명령어 캐시 시스템

### 캐시 파일

- `reports/inspection-results.json` (5분 TTL)

  - `/inspect`가 생성
  - `/maintain`, `/fix`가 소비

- `reports/rg/*` (영구)

  - `/rg:run`이 생성
  - CI/CD가 소비

- `reports/radar-results.json` (영구)
  - `/radar`가 생성
  - `/refactor`가 소비

### 캐시 전략

1. **Hot Cache**: inspection-results.json (5분)

   - 빠른 실행을 위해 TTL 짧음

2. **Warm Cache**: radar-results.json

   - 부채 정보는 천천히 변함

3. **Cold Cache**: rg/\* (감사 기록)
   - 영구 보관 (거버넌스 증거)

---

## 🚨 주의사항

### 1. 명령어 실행 순서 중요

❌ **잘못된 순서**:

```bash
npm run fix      # inspect 없이 실행 → 캐시 없음!
npm run maintain
```

✅ **올바른 순서**:

```bash
npm run status   # 1. 진단 (캐시 생성)
npm run maintain # 2. 캐시 사용
npm run fix      # 3. 캐시 사용
```

### 2. RG는 배포 전 필수

❌ **위험한 패턴**:

```bash
npm run fix
git push  # RG 없이 푸시!
```

✅ **안전한 패턴**:

```bash
npm run fix
npm run rg:run   # ⭐ 회귀 검증
git push
```

### 3. Radar는 주기적으로

- 매일 실행 불필요 (느림)
- 주 1회 정기 실행
- 대규모 리팩토링 후 실행

---

## 🔮 향후 계획

### Phase 1: CI/CD 통합 (우선순위 1)

```yaml
# .github/workflows/regression-guard.yml
- name: Regression Guard
  run: npm run rg:run
  # FAIL 시 PR 자동 차단
```

### Phase 2: Pre-push Hook

```bash
# .husky/pre-push
npm run arch:check
npm run rg:run -- --profile=dev --fast
```

### Phase 3: 대시보드 통합

- `/inspect` + `/rg:run` 결과를 웹 대시보드로
- P3 웹뷰 개발 시 포함

---

## 📚 참고 문서

- `@CLAUDE.md` - 전체 시스템 철학
- `@docs/PRODUCT_PLAN.md` - 제품 로드맵
- `@docs/COMMAND_GUIDE.md` - 명령어 상세 가이드
- `scripts/rg/README.md` - Regression Guard 상세

---

**마지막 업데이트**: 2025-10-07
**주요 변경**: Regression Guard (RG) 시스템 추가
