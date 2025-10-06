# 품질 거버넌스 업데이트 요약

## 🎯 핵심 변경사항

### 1. 품질 필수 파일 보호 시스템 ✨

**문제**: Agent 코어 로직이 자동 리팩토링으로 의도치 않게 변경되어 QA 생성 품질 저하

**해결**:

- ✅ `quality-policy.json`: 보호 대상 파일 명시적 선언
- ✅ `scripts/lib/quality-policy.ts`: 정책 관리 중앙화
- ✅ 자동 리팩토링 비활성화
- ✅ 수정 시 경고 및 승인 요구

**보호 대상 파일**:

```
src/agents/domainConsultant.ts       # 도메인 지식 데이터
src/agents/psychologySpecialist.ts   # 심리 분석 로직
src/agents/linguisticsEngineer.ts    # 언어 최적화
```

**영향**:

- ⚠️ 이 파일들 수정 시 `/fix` 명령어에서 추가 확인 필요
- ⚠️ 자동 리팩토링(`/refactor`) 실행 시 자동 제외
- ✅ 의도적 수정은 가능 (승인 후)

---

### 2. 보안 강화 (SecurityGuard) 🛡️

**추가 기능**:

1. **Race Condition 방지**

   - 파일 작업 시 자동 락(Lock) 관리
   - 동시 수정 충돌 방지
   - 데드락 자동 감지 및 복구

2. **순환 의존성 탐지**
   - 코드베이스 전체 의존성 그래프 분석
   - 순환 참조 자동 탐지
   - CI/CD에서 자동 검사

**사용법**:

```bash
# 순환 의존성 체크
npx tsx scripts/lib/security-guard.ts

# 출력:
# ✅ No circular dependencies found
# Analyzed 322 dependencies
```

**주의사항**:

- 순환 의존성 발견 시 빌드 실패 (CI/CD)
- 파일 작업 시 락 타임아웃: 30초 (초과 시 자동 해제)

---

### 3. CI/CD 자동화 강화 🔄

#### A. Unified Quality Gate (PR 검증)

**파일**: `.github/workflows/unified-quality-gate.yml`

**추가된 검사**:

```yaml
- name: 🛡️ Quality Protection Check
  # 품질 필수 파일 존재 여부 확인
  # 누락 시 빌드 실패
```

**영향**:

- PR 생성 시 품질 필수 파일 검증
- 파일 누락/삭제 시 PR 블록

#### B. Weekly Radar (주간 품질 스캔)

**파일**: `.github/workflows/weekly-radar.yml`

**스케줄**: 매주 월요일 오전 9시 (UTC)

**수행 작업**:

1. 품질 필수 파일 변경 이력 추적
2. 지난 7일간 수정된 보호 파일 감지
3. 품질 트렌드 분석
4. P0/P1 이슈 자동 GitHub Issue 생성

**예시 출력**:

```
📊 Weekly Quality Radar Summary

- 🛡️ Quality Violations: 0 ✅
- 📈 Quality Trend: Stable
- 🔴 P0 Issues: 0
- 🟡 P1 Issues: 2

⚠️ Protected files modified:
  - src/agents/domainConsultant.ts (2025-10-03)
    Reason: Feature enhancement
```

**주의사항**:

- 보호 파일 수정 시 반드시 커밋 메시지에 이유 명시
- P0 이슈 발생 시 자동 이슈 생성 (즉시 대응 필요)

---

### 4. 품질 이력 추적 📊

**파일**: `scripts/lib/quality-history.ts`

**기능**:

- 품질 메트릭 시계열 데이터 저장
- 품질 저하 패턴 자동 감지
- 롤백 추천 시스템

**데이터 저장 위치**: `reports/quality-history/`

**사용 예시**:

```bash
# 품질 트렌드 분석
npx tsx scripts/lib/quality-history.ts --report

# 출력:
# Quality Trend (Last 30 days):
# 2025-10-05: 9.2/10 (+0.3 from avg)
# 2025-10-04: 8.9/10
# 2025-10-03: 9.0/10
#
# Recommendation: Quality is improving ✓
```

---

## ⚠️ 중요 주의사항

### 1. 품질 필수 파일 수정 시

**DO ✅**:

```bash
# 1. 변경 전 백업
git checkout -b feature/improve-domain-knowledge

# 2. 조심스럽게 수정
vim src/agents/domainConsultant.ts

# 3. 테스트 실행 (필수!)
npm run test

# 4. 품질 검증
npm run status

# 5. 커밋 메시지에 이유 명시
git commit -m "refactor(agents): improve CS domain knowledge

Reason: Add new algorithms (Graph Theory)
Impact: QA quality for CS domain improved
Tested: All unit tests passed"

# 6. PR 생성 후 리뷰 요청
```

**DON'T ❌**:

```bash
# 자동 리팩토링 도구 사용 금지
npm run /refactor  # 품질 필수 파일은 자동 제외됨

# 대량 변경 금지
sed -i 's/old/new/g' src/agents/*.ts  # 위험!

# 테스트 없이 커밋 금지
git add src/agents/domainConsultant.ts
git commit -m "fix typo"  # 테스트 안 돌림 - 위험!
```

---

### 2. /inspect 캐시 관리

**캐시 TTL**: 30분

**주의**:

```bash
# ❌ BAD: 캐시 만료 후 /fix 실행
npm run status  # 09:00 실행
# ... 1시간 작업 ...
npm run fix     # 10:00 실행 - 캐시 만료로 오류!

# ✅ GOOD: 캐시 재생성
npm run status  # 09:00
# ... 작업 ...
npm run status  # 09:50 (재검사)
npm run fix     # 09:51 (캐시 유효)
```

**팁**: 긴 작업 시 주기적으로 `npm run status` 재실행

---

### 3. CI/CD 실패 처리

**Scenario 1: Quality Protection Check 실패**

```
❌ Found potentially missing protected files
   - src/agents/domainConsultant.ts

Action Required:
1. 파일이 의도적으로 삭제되었는가?
   → Yes: quality-policy.json에서 제거
   → No: 파일 복구 필요
```

**Scenario 2: Circular Dependency 발견**

```
❌ Found 1 circular dependency:
   Cycle:
    → src/agents/qualityAuditor.ts
    → src/agents/qaGenerator.ts
    → src/agents/qualityAuditor.ts

Action Required:
1. 순환 참조 끊기 (리팩토링)
2. 또는 의존성 추출 (새 파일 생성)
```

**Scenario 3: Weekly Radar P0 이슈**

```
🚨 Quality Protection Violations (2 critical)

- src/agents/domainConsultant.ts: Modified in last 7 days
  Reason: Modified in last 7 days - review required
  Severity: critical

Action Required:
1. GitHub Issue 확인
2. 변경 사항 리뷰
3. 품질 영향 평가
4. 필요시 롤백
```

---

### 4. Hot Reload 주의사항

**지원 파일**:

- ✅ `quality-policy.json` - 즉시 반영
- ✅ `guidelines/**/*.md` - 즉시 반영
- ⚠️ `plugins/**/*.ts` - 재시작 필요 (dev 모드는 자동)

**예시**:

```bash
# 1. quality-policy.json 수정
vim quality-policy.json

# 2. 즉시 반영 (재시작 불필요)
npm run status
# → 새 정책 즉시 적용됨

# 3. 플러그인 수정 (재시작 필요)
vim plugins/custom-validator/index.ts

# 4. 재시작
npm run dev  # Dev 모드는 자동 재시작
# 또는
npm run build && npm start  # Production
```

---

### 5. 성능 고려사항

**SecurityGuard 순환 의존성 검사**:

- 분석 대상: 전체 코드베이스 (src/, scripts/)
- 예상 시간: ~10초 (중형 프로젝트)
- **주의**: 대형 프로젝트(1000+ 파일)는 30초 이상 소요 가능

**최적화 팁**:

```bash
# 특정 디렉토리만 검사 (빠름)
npx tsx scripts/lib/security-guard.ts --path src/agents

# 캐시 활용 (두 번째 실행은 빠름)
npx tsx scripts/lib/security-guard.ts  # 10초
npx tsx scripts/lib/security-guard.ts  # 1초 (캐시)
```

---

## 📚 새로운 파일 및 명령어

### 생성된 파일

```
quality-policy.json                          # 품질 정책 (중앙 관리)
scripts/lib/quality-policy.ts                # 정책 관리자
scripts/lib/quality-history.ts               # 품질 이력 추적
scripts/lib/security-guard.ts                # 보안 가드
.github/workflows/weekly-radar.yml           # 주간 품질 스캔
scripts/test-quality-integration.ts          # 통합 테스트
```

### 수정된 파일

```
scripts/inspection-engine.ts                 # 품질 보호 통합
scripts/safety-analyzer.ts                   # 품질 필수 파일 체크
governance-rules.json                        # qualityProtection 섹션 추가
.github/workflows/unified-quality-gate.yml   # Quality Protection Check 추가
```

### 새 명령어

```bash
# 품질 정책 확인
cat quality-policy.json

# 보안 검사
npx tsx scripts/lib/security-guard.ts

# 품질 이력 분석
npx tsx scripts/lib/quality-history.ts --report

# 통합 테스트
npx tsx scripts/test-quality-integration.ts

# 품질 영향 분석 (가이드라인 변경 시)
npm run guideline:impact-analysis
```

---

## 🎓 학습 리소스

### 읽어야 할 문서 (우선순위 순)

1. **필수**: `docs/SLASH_COMMAND_WORKFLOW.md` - 일상 워크플로우
2. **필수**: `quality-policy.json` - 현재 품질 정책
3. **추천**: `docs/GUIDELINE_INTEGRATION.md` - 가이드라인 작성법
4. **선택**: `governance-rules.json` - 거버넌스 상세 규칙

### 실습 추천

```bash
# 1. 통합 테스트 실행 (모든 기능 확인)
npx tsx scripts/test-quality-integration.ts

# 2. 워크플로우 따라하기
npm run status          # 진단
npm run maintain        # 자동 수정
npm run fix             # 대화형 수정

# 3. 품질 필수 파일 확인
cat quality-policy.json | jq '.agentProtection.static'

# 4. 순환 의존성 체크
npx tsx scripts/lib/security-guard.ts
```

---

## 🚀 다음 단계

### 즉시 시도해보기

1. ✅ 통합 테스트 실행 완료
2. ⬜ `/inspect` 실행해서 품질 보호 메시지 확인
3. ⬜ 품질 필수 파일 중 하나 수정해서 경고 확인
4. ⬜ Weekly Radar 수동 실행 (GitHub Actions)

### 선택적 확장

1. ⬜ `guidelines/domain-expertise/` 디렉토리 생성
2. ⬜ 신규 도메인 가이드라인 추가
3. ⬜ 플러그인 시스템 탐색 (`plugins/`)
4. ⬜ 품질 이력 데이터 분석

---

## 💡 FAQ

**Q: 품질 필수 파일을 수정하면 안 되나요?**
A: 수정 가능합니다! 단, 다음을 준수하세요:

- 테스트 필수 실행
- 커밋 메시지에 이유 명시
- PR 리뷰 요청
- 품질 영향 평가

**Q: /refactor가 자동으로 건너뛰는 파일이 있나요?**
A: 네, `quality-policy.json`의 `agentProtection.static`에 명시된 파일들은 자동 제외됩니다.

**Q: Weekly Radar가 매주 자동 실행되나요?**
A: 네, 매주 월요일 오전 9시(UTC)에 자동 실행됩니다. 수동 실행도 가능합니다.

**Q: 캐시가 만료되면 어떻게 되나요?**
A: `/maintain`이나 `/fix` 실행 시 자동으로 `/inspect`를 재실행합니다.

**Q: 순환 의존성이 발견되면 CI/CD가 실패하나요?**
A: 네, 순환 의존성 발견 시 빌드가 실패합니다. 즉시 수정이 필요합니다.

**Q: 가이드라인 변경 시 재시작이 필요한가요?**
A: 대부분 불필요합니다. `quality-policy.json`과 `guidelines/*.md`는 Hot Reload를 지원합니다.

---

## 🎯 핵심 요약

1. **품질 필수 파일은 보호됨** - 자동 리팩토링 비활성화, 수정 시 승인 필요
2. **보안 강화** - Race condition 방지, 순환 의존성 탐지
3. **CI/CD 자동화** - 품질 보호 검증, 주간 스캔
4. **품질 이력 추적** - 트렌드 분석, 롤백 추천
5. **Hot Reload** - 대부분의 설정 변경 시 재시작 불필요

**Golden Rule**: 품질 필수 파일 수정 시 **신중하게**, **테스트 필수**, **이유 명시**!
