# GitHub Branch Protection Rules

**목적**: Pre-commit hook 우회를 서버 레벨에서 차단

---

## 설정 방법

### 1. GitHub Repository Settings

```
Settings → Branches → Branch protection rules → Add rule
```

### 2. Branch name pattern

```
main
```

### 3. Protection rules (필수 체크)

#### ✅ Require status checks to pass before merging

- **Strict** (Require branches to be up to date before merging)
- Required status checks:
  - `validate-architecture / Validate Architecture Invariants`
  - `validate-architecture / Check Design Principles`
  - `validate-architecture / TypeScript Compilation`

#### ✅ Require a pull request before merging

- Required approvals: 1
- Dismiss stale PR approvals when new commits are pushed

#### ✅ Require linear history

- No merge commits allowed

#### ✅ Do not allow bypassing the above settings

- Includes administrators

---

## 차단 효과

### Before (Pre-commit만)

```bash
# 로컬에서 우회 가능
git commit --no-verify  # → 커밋됨 ✅
git push                # → 푸시됨 ✅
# PR 생성                # → 생성됨 ✅
# CI 실패                # → 머지 불가 ❌ (하지만 이미 시간 낭비)
```

### After (Branch Protection)

```bash
# 로컬에서 우회
git commit --no-verify  # → 커밋됨 ✅
git push                # → 푸시됨 ✅
# PR 생성                # → 생성됨 ✅
# CI 실패                # → 머지 **불가능** 🔒
# PR 수정 필요           # → 강제 수정
```

**핵심**: 로컬 우회는 가능하지만, **절대 main에 머지 안 됨**

---

## CLI로 설정 (선택)

```bash
# GitHub CLI 필요
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["validate-architecture / Validate Architecture Invariants","validate-architecture / Check Design Principles","validate-architecture / TypeScript Compilation"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field required_linear_history=true
```

---

## 검증

### 테스트 시나리오

```bash
# 1. P0 위반 코드 작성
echo "const x = process.stdin.isTTY;" > test.ts

# 2. Pre-commit 우회
git add test.ts
git commit --no-verify -m "test: bypass"

# 3. Push
git push origin feature/test

# 4. PR 생성
gh pr create --title "Test" --body "Testing bypass"

# 5. CI 실행
# → ❌ Architecture Validation 실패

# 6. 머지 시도
gh pr merge --squash
# → ❌ BLOCKED: Required status check failed
```

**성공**: 머지 불가능 🎉

---

## 긴급 우회 (위험)

**절대 사용 금지** - 시스템 붕괴 가능

관리자만 branch protection을 임시로 비활성화 가능:

```bash
# Settings → Branches → Edit rule → Uncheck "Do not allow bypassing"
```

**대신 사용**:

- Hot-fix branch + Fast-track review
- Feature flag로 새 코드 비활성화

---

## 모니터링

### 우회 시도 탐지

```bash
# GitHub Actions에서 자동 감지
name: Bypass Attempt Detection

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  detect-bypass:
    runs-on: ubuntu-latest
    steps:
      - name: Check for --no-verify in commits
        run: |
          git log --oneline --all | grep -i "no-verify" && {
            echo "⚠️ ALERT: Detected --no-verify in commit history"
            # Slack notification
          }
```

---

## 참고

- **문서**: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- **Best Practices**: https://github.blog/2015-06-08-how-to-undo-almost-anything-with-git/

---

**요약**:

- ✅ Pre-commit hook: 로컬 빠른 피드백
- ✅ Branch Protection: 서버 레벨 강제 차단
- 🔒 **둘 다 필요** - 다층 방어
