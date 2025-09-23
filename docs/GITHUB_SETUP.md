# 🔒 GitHub Repository Security Setup Guide

이 가이드는 프로덕션 준비를 위한 필수 GitHub 설정을 안내합니다.

## 1. Branch Protection Rules 설정

### 📍 **설정 위치:**
1. GitHub 저장소 페이지로 이동
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Branches** 클릭
4. **Add rule** 버튼 클릭

### ⚙️ **설정 내용:**

#### **Branch name pattern:**
```
main
```

#### **보호 규칙 (모두 체크):**
- ✅ **Require a pull request before merging**
  - ✅ Require approvals: **1**
  - ✅ Dismiss stale PR approvals when new commits are pushed
  - ✅ Require review from code owners

- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - **필수 status checks:**
    - `Security Scan`
    - `Lint and Format Check`
    - `Tests`
    - `Build`
    - `Vulnerability Scan`

- ✅ **Require conversation resolution before merging**
- ✅ **Require signed commits** (권장)
- ✅ **Require linear history** (권장)
- ✅ **Restrict pushes that create files larger than 100 MB**

#### **관리자 설정:**
- ✅ **Include administrators** (관리자도 규칙 적용)

## 2. Repository Secrets 설정

### 📍 **설정 위치:**
1. **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭

### 🔑 **필수 Secrets:**

#### **Production 환경:**
```
ANTHROPIC_API_KEY_PROD=sk-ant-your-production-key
DB_PASSWORD_PROD=your-production-db-password
JWT_SECRET_PROD=your-production-jwt-secret-min-32-chars
ENCRYPTION_KEY_PROD=your-production-encryption-key
SENTRY_DSN_PROD=https://your-sentry-dsn@sentry.io/project
DATADOG_API_KEY_PROD=your-datadog-api-key
PRODUCTION_URL=https://your-production-domain.com
```

#### **Staging 환경:**
```
ANTHROPIC_API_KEY_STAGING=sk-ant-your-staging-key
DB_PASSWORD_STAGING=your-staging-db-password
JWT_SECRET_STAGING=your-staging-jwt-secret
STAGING_URL=https://your-staging-domain.com
```

#### **기타 필수 Secrets:**
```
CODECOV_TOKEN=your-codecov-token
```

## 3. GitHub Apps 설정 (권장)

### 🤖 **Dependabot 설정 확인**
- **Settings** → **Code security and analysis**
- ✅ **Dependabot alerts** 활성화
- ✅ **Dependabot security updates** 활성화
- ✅ **Dependabot version updates** 활성화

### 🔍 **Code Scanning 설정**
- ✅ **Code scanning alerts** 활성화
- ✅ **Secret scanning** 활성화
- ✅ **Push protection** 활성화

## 4. 설정 검증

### ✅ **검증 체크리스트:**
```bash
# 1. 환경변수 검증
npm run guard:env

# 2. 전체 품질 체크
npm run ci:quality

# 3. 보안 검증
npm run guard:git

# 4. 전체 가드 실행
npm run guard:all
```

### 🧪 **Branch Protection 테스트:**
1. 새 브랜치 생성: `git checkout -b test-protection`
2. 작은 변경사항 커밋
3. PR 생성하여 보호 규칙 동작 확인
4. 모든 status check 통과 후 머지

## 5. 자동화 상태 확인

### 📊 **CI/CD 파이프라인 상태:**
- **Security Scan**: ✅ 자동 실행
- **Lint & Format**: ✅ 자동 실행
- **Tests**: ✅ 자동 실행
- **Build**: ✅ 자동 실행
- **Vulnerability Scan**: ✅ 자동 실행
- **Deployment**: ⚠️ Secrets 설정 후 활성화

### 🔄 **Dependabot 상태:**
- **주간 의존성 업데이트**: ✅ 자동 실행
- **보안 업데이트**: ✅ 즉시 실행
- **PR 자동 생성**: ✅ 설정 완료

## 6. 문제 해결

### 🚨 **Status Check 실패 시:**
```bash
# ESLint 오류 수정
npm run lint:fix

# TypeScript 오류 확인
npm run typecheck

# 테스트 실행
npm test

# 전체 검증
npm run ci:quality
```

### 🔧 **Secrets 오류 시:**
1. Secret 이름 정확성 확인
2. 값에 공백이나 특수문자 확인
3. 환경별 Secret 구분 확인

---

## ⚡ **빠른 시작**

```bash
# 1. 이 문서의 설정을 모두 완료
# 2. 검증 실행
npm run guard:all

# 3. 테스트 PR 생성
git checkout -b test-setup
echo "# Test" >> TEST.md
git add TEST.md
git commit -m "test: verify branch protection"
git push origin test-setup

# 4. GitHub에서 PR 생성하여 모든 체크 통과 확인
```

이 설정을 완료하면 **프로덕션 준비 완료** 상태가 됩니다! 🚀