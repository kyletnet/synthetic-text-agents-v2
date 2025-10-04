# 운영 빠른 시작 가이드

**대상**: 비개발자 운영자, DevOps, PM
**목적**: 개발 지식 없이 시스템 품질 관리
**시간**: 5분 읽기

---

## 🎯 당신이 할 일

### 일상 작업 (매일 5분)

```bash
# 1. 시스템 상태 확인
npm run guard

# 결과:
# ✅ 모두 정상 → 아무것도 안 해도 됨
# ❌ 문제 발견 → 개발자에게 알림
```

### 주간 작업 (월요일 10분)

```bash
# 1. 심층 스캔 (자동 실행됨, 확인만)
# GitHub → Actions → Weekly Radar 결과 확인

# 2. Issue 생성 확인
# Issues 탭에 자동 생성된 P0/P1 이슈 확인
```

---

## 📊 명령어 가이드

### npm run guard - 종합 품질 체크

**실행**:
```bash
npm run guard
```

**결과 해석**:
```
✅ Passed: 3     ← 정상
❌ Failed: 0     ← 문제 있음 (개발자 호출)
⏭️  Skipped: 0   ← 건너뜀
```

**옵션**:
```bash
npm run guard:quick    # 빠른 체크 (1분)
npm run guard:report   # 상세 보고서 생성
```

---

### npm run status - 일상 진단

**실행**:
```bash
npm run status
```

**결과 확인**:
```
📊 Health Score: 85/100

🟢 85-100: 정상 (조치 불필요)
🟡 60-84:  주의 (개발자에게 알림)
🔴 0-59:   위험 (즉시 개발자 호출)
```

---

### npm run radar - 심층 스캔

**실행** (필요 시만):
```bash
npm run radar
```

**언제 실행?**
- 릴리즈 전
- 대규모 변경 후
- 성능 저하 의심 시

**소요 시간**: 5-10분

---

## 🚨 문제 발생 시 대응

### Scenario 1: Health Score 60 미만

```
📊 Health Score: 55/100
❌ TypeScript: FAIL
```

**조치**:
1. 개발자에게 알림: "Health Score 55, TypeScript 오류 발생"
2. `reports/inspection-results.json` 파일 전달

---

### Scenario 2: Circular Dependency 발견

```
❌ Found 1 circular dependency
```

**조치**:
1. 개발자에게 알림: "순환 의존성 발견"
2. **배포 중지** (빌드 실패 위험)

---

### Scenario 3: Protected File 변경

```
⚠️ Protected files modified:
  - src/agents/domainConsultant.ts
```

**조치**:
1. 변경 이유 확인 (커밋 메시지 확인)
2. 개발자에게 확인 요청: "품질 필수 파일 변경됨, 테스트 필요"

---

## 📋 체크리스트 (일일 루틴)

### 오전 업무 시작

- [ ] `npm run guard` 실행
- [ ] Health Score 확인 (85+ 정상)
- [ ] 문제 있으면 개발자 알림

### 배포 전

- [ ] `npm run guard --report` 실행
- [ ] 모든 체크 PASS 확인
- [ ] 보고서 저장 (`reports/guard-report.json`)

### 주간 (월요일)

- [ ] GitHub Actions → Weekly Radar 확인
- [ ] P0/P1 Issue 있으면 개발자 할당

---

## 🎓 용어 설명

| 용어 | 의미 | 조치 |
|------|------|------|
| **P0 (Critical)** | 시스템 중단 | 즉시 수정 |
| **P1 (High)** | 주요 기능 문제 | 1주일 내 수정 |
| **P2 (Medium)** | 부차적 문제 | 계획적 수정 |
| **Health Score** | 시스템 건강도 | 85+ 유지 목표 |
| **Circular Dependency** | 순환 참조 | 빌드 실패 원인 |
| **Protected File** | 품질 필수 파일 | 신중한 수정 필요 |

---

## 💡 FAQ

**Q: npm run guard와 npm run status 차이는?**
A:
- `status`: 빠른 체크 (1-2분)
- `guard`: 종합 체크 (3-5분, status + 보안 + 이력)

**Q: 매일 guard를 실행해야 하나요?**
A: 권장합니다. 하지만 최소 배포 전에는 필수입니다.

**Q: Health Score가 계속 내려가면?**
A: 개발자에게 알리고, 품질 저하 원인 파악을 요청하세요.

**Q: Protected File은 절대 수정하면 안 되나요?**
A: 수정 가능하지만, 개발자 승인 + 테스트 필수입니다.

**Q: GitHub Actions에서 실패하면?**
A:
1. 개발자에게 알림
2. PR 머지 중지
3. 문제 수정 후 재시도

---

## 📞 긴급 상황 대응

### 빌드 실패 (Production)

```bash
# 1. 즉시 롤백 (개발자 호출)
# 2. 마지막 정상 버전으로 복귀
# 3. guard 재실행으로 확인
```

### 품질 급락 (Health Score < 50)

```bash
# 1. 개발자 긴급 호출
# 2. 배포 중지
# 3. 원인 파악 및 수정
```

### 순환 의존성 발견 (CI/CD)

```bash
# 1. PR 머지 차단
# 2. 개발자에게 수정 요청
# 3. 수정 후 재검증
```

---

## 🎯 성공 지표

### 일일 목표
- ✅ Health Score: 85+
- ✅ Guard: PASS
- ✅ 신규 P0 Issue: 0개

### 주간 목표
- ✅ Weekly Radar: 문제 없음
- ✅ Protected Files: 변경 없음 (또는 승인됨)
- ✅ 배포 성공률: 100%

### 월간 목표
- ✅ 평균 Health Score: 90+
- ✅ P0 Issue 해결 시간: 24시간 이내
- ✅ 품질 트렌드: 상승 또는 유지

---

## 📚 추가 리소스

### 개발자에게 전달할 파일

- `reports/guard-report.json` - 종합 보고서
- `reports/inspection-results.json` - 상세 진단 결과
- `reports/quality-history/` - 품질 이력 데이터

### 참고 문서

- `docs/SLASH_COMMAND_WORKFLOW.md` - 전체 워크플로우
- `docs/QUALITY_GOVERNANCE_SUMMARY.md` - 품질 거버넌스 요약
- `docs/CRITICAL_GAPS_ANALYSIS.md` - 시스템 갭 분석

---

**마지막 업데이트**: 2025-10-04
**버전**: v1.0.0-quality-governance
**작성자**: System Architect
