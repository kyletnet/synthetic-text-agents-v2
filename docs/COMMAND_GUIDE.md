# 명령어 가이드

## 🎯 명확한 책임 분리

### 1. `/status` - 진단 전용
```bash
npm run status        # 전체 건강도 측정
npm run status:quick  # 빠른 체크 (TypeScript만)
```

**목적**: 시스템 상태 파악 (읽기 전용)
**출력**:
- 건강도 점수 (0-100)
- TypeScript, Code Style, Tests, Security
- 컴포넌트 준수율
- 워크어라운드 개수

**사용 시점**:
- 작업 시작 전
- /fix 실행 전
- /ship 실행 전

---

### 2. `/fix` - 대화형 품질 수정
```bash
npm run fix
```

**목적**: 사용자가 직접 제어하며 하나씩 수정
**특징**:
- ✅ 대화형 승인 (y/n/m/a)
- ✅ 심각도 우선순위
- ✅ 롤백 가능
- ✅ 진행 상황 추적

**수정 항목**:
1. Code Quality (Prettier, ESLint, TypeScript)
2. Component Documentation (자동 템플릿 생성)
3. Workarounds (TODO/FIXME/HACK)
4. Refactoring (리팩토링 대기)

**사용 시점**:
- 개발자가 직접 품질 개선할 때
- 배포 전 최종 정리

**워크플로우**:
```bash
1. npm run status    # 문제 파악
2. npm run fix       # 대화형 수정
3. npm run test      # 테스트
4. git commit        # 커밋
```

---

### 3. `/maintain` - CI/CD 자동 유지보수
```bash
npm run maintain       # 스마트 모드 (안전한 것만 자동)
npm run maintain:safe  # 안전 모드 (진단만)
npm run maintain:quick # 빠른 모드 (핵심만)
```

**목적**: CI/CD 파이프라인에서 자동 실행
**특징**:
- ⚡ 사람 개입 없이 자동 실행
- 🛡️ 안전한 항목만 자동 수정
- 📊 위험한 항목은 리포트만 생성

**자동 수정 항목**:
- ✅ Prettier 포맷팅
- ✅ ESLint 자동 수정 가능 항목
- ✅ 문서 인덱스 재생성
- ✅ 컴포넌트 레지스트리 갱신

**승인 필요 항목** (리포트만):
- ⚠️ 아키텍처 진화
- ⚠️ 리팩토링
- ⚠️ 보안 관련 변경

**사용 시점**:
- GitHub Actions (daily)
- Pre-commit hook
- 자동화 스크립트

---

### 4. `/ship` - 배포 준비
```bash
npm run ship
```

**목적**: 배포 직전 최종 준비
**순서**:
1. `npm run docs:refresh` - 문서 동기화
2. `npm run status:quick` - 최종 건강도 확인
3. `npm run optimize:analyze` - 배포 최적화

**특징**:
- 📚 문서와 코드 동기화 (원자성)
- 🔍 최종 건강도 체크
- 🚀 배포 준비 완료

**사용 시점**:
- 배포 직전
- PR 머지 후

---

## 🔄 워크플로우별 가이드

### 개발 중 (사람)
```bash
# 1. 문제 파악
npm run status

# 2. 대화형 수정
npm run fix
# → y: 승인
# → n: 건너뛰기
# → m: 수동 처리

# 3. 테스트
npm run test

# 4. 커밋
git add -A
git commit -m "fix: 품질 개선"
```

### CI/CD (자동)
```bash
# 1. 자동 유지보수
npm run maintain

# 2. 테스트
npm run test

# 3. 배포 (main 브랜치)
npm run ship
```

### 배포 전 (사람)
```bash
# 1. 최종 품질 체크
npm run status

# 2. 남은 이슈 수정
npm run fix

# 3. 테스트
npm run test

# 4. 배포 준비
npm run ship

# 5. 배포 실행
git push origin main
```

---

## 🎯 핵심 차이점 요약

| 명령어 | 목적 | 승인 | 자동화 | 문서 |
|--------|------|------|--------|------|
| `/status` | 진단 | - | ✅ | - |
| `/fix` | 대화형 수정 | ✅ 필수 | ❌ | - |
| `/maintain` | 자동 유지보수 | ⚠️ 위험한 것만 | ✅ | - |
| `/ship` | 배포 준비 | - | ✅ | ✅ |

---

## 📚 문서 업데이트 전략

### ✅ 선택: `/ship`에서만 문서 동기화

**이유**:
1. **정확성**: 최종 코드 상태 반영
2. **효율성**: 한 번만 실행 (중복 방지)
3. **원자성**: 문서와 코드 동시 배포
4. **일관성**: 배포 시점 = 문서 갱신 시점

**구현**:
```json
{
  "ship": "npm run docs:refresh && npm run status:quick && npm run optimize:analyze"
}
```

---

## 🚀 권장 개발 흐름

```
작업 시작
    ↓
npm run status      (현재 상태 파악)
    ↓
[코드 작성]
    ↓
npm run fix         (대화형 품질 개선)
    ↓
npm run test        (테스트)
    ↓
git commit
    ↓
npm run ship        (배포 준비: 문서 동기화)
    ↓
배포
```

---

## 💡 FAQ

### Q1: /maintain vs /fix 차이는?

**A**:
- `/maintain`: CI/CD 자동화용, 안전한 것만 자동
- `/fix`: 사람이 직접 제어, 하나씩 승인

### Q2: 문서는 언제 업데이트?

**A**: `/ship` 실행 시 자동 (배포 직전)

### Q3: /maintain이 필요한가?

**A**:
- 필요 (CI/CD 자동화)
- 사람 없이 daily 자동 실행
- 안전한 항목만 자동 수정

### Q4: 워크어라운드는 어떻게?

**A**:
```bash
# 1. /fix로 검출
npm run fix
# → "워크어라운드 132개" 항목

# 2. 선택
# - y: 목록 확인 (수동 검토)
# - n: 건너뛰기
# - m: 직접 처리
```

---

*최종 업데이트: 2025-09-30*