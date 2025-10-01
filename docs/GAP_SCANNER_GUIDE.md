# GAP Scanner 사용 가이드

**Last Updated**: 2025-10-01
**Version**: 1.0.0
**Status**: Active

---

## 🎯 Overview

GAP Scanner는 시스템 일관성을 자동으로 검증하는 프로액티브 품질 보증 도구입니다.

**핵심 가치:**
- 🛡️ **예방 우선**: 문제 발생 전 자동 차단
- 📚 **진실성 보장**: 코드-문서-거버넌스 일관성
- 🔄 **지속 가능**: 자동화된 생명주기 관리

---

## 📋 Quick Start (5분)

### 1. 기본 스캔 실행

```bash
# Shadow mode (관찰 전용)
npm run gap:scan

# 빠른 스캔
npm run gap:scan -- --quick

# 도움말
npm run gap:scan -- --help
```

### 2. 결과 확인

```bash
# 스캔 결과
cat reports/gap-scan-results.json

# 요약 보기
npm run gap:scan 2>&1 | grep "📊 Results"
```

### 3. Auto-fix 실행

```bash
# P2 gap만 자동 수정
npm run gap:scan -- --auto-fix

# Dry-run (미리보기)
npm run gap:scan -- --dry-run --auto-fix
```

---

## 🔍 Checks

GAP Scanner는 8개 카테고리를 검사합니다:

### 1. CLI Documentation Coverage (P1)

**검사 내용:**
- `package.json`의 모든 스크립트가 문서화되어 있는지

**예시 gap:**
```
Undocumented CLI command: gap:scan
'gap:scan' exists in package.json but not documented in docs/COMMAND_GUIDE.md
```

**수정 방법:**
```bash
# docs/COMMAND_GUIDE.md에 추가
- `npm run gap:scan`: Run GAP scanner
```

---

### 2. Governance-Code Consistency (P0)

**검사 내용:**
- `governance-rules.json`과 실제 코드의 일치 여부
- 특히 CACHE_TTL 같은 정책 값 동기화

**예시 gap:**
```
Governance rule mismatch: CACHE_TTL
Code: 1800s, Governance: 300s
```

**수정 방법:**
```bash
# Auto-fix 가능
npm run gap:scan -- --auto-fix
```

---

### 3. PII Masking Implementation (P0)

**검사 내용:**
- Logger에 PII 마스킹 함수 구현 여부
- `maskPII`, `redactPII`, `sanitizePII` 함수 존재

**예시 gap:**
```
PII masking not implemented in logger.ts
Missing functions: maskPII, sanitizePII
```

**수정 방법:**
```typescript
// src/shared/logger.ts
private maskPII(data: unknown): unknown {
  // 구현...
}
```

---

### 4. Test Coverage (P1)

**검사 내용:**
- 새로 추가된 파일에 대한 테스트 존재 여부

**예시 gap:**
```
Missing test: gap-scanner.ts
New file scripts/gap-scanner.ts has no corresponding test
```

**수정 방법:**
```bash
# tests/gap-scanner.test.ts 생성
```

---

### 5. Document Cross-References (P2)

**검사 내용:**
- 문서 간 상호참조 링크 충분성

**예시 gap:**
```
Insufficient document cross-references
Only 5 cross-references found (minimum: 10)
```

**수정 방법:**
```markdown
<!-- 문서에 추가 -->
See: @file docs/OTHER_DOC.md
```

---

### 6. Agent Chain E2E Tests (P1)

**검사 내용:**
- Agent chain (Evidence → Answer → Audit) E2E 테스트 존재

**예시 gap:**
```
Agent chain E2E test missing
No test covers: Evidence → Answer → Audit
```

**수정 방법:**
```typescript
// tests/integration/agent-chain.test.ts
it("should process full agent chain", async () => {
  // 구현...
});
```

---

### 7. Document Lifecycle (P2)

**검사 내용:**
- Deprecated 문서 관리
- 참조 추적

**예시 gap:**
```
Deprecated doc still referenced: OLD_DOC.md
3 files still reference this deprecated document
```

**수정 방법:**
```bash
# 참조 업데이트 후
npm run doc:lifecycle -- --deprecate docs/OLD_DOC.md
```

---

### 8. Deprecated Reference Enforcement (P1)

**검사 내용:**
- Grace period 경과 후 deprecated 문서 참조

**예시 gap:**
```
Deprecated doc referenced (grace period expired)
Must update before commit
```

---

## ⚙️ Configuration

### .gaprc.json

```json
{
  "globalSettings": {
    "mode": "shadow",           // disabled | shadow | enforce
    "failOn": [],               // ["P0"] or ["P0", "P1"]
    "autoFix": {
      "enabled": false,
      "maxSeverity": "P2"       // P2만 자동 수정
    }
  },

  "checks": [
    {
      "id": "cli-documentation",
      "enabled": true,
      "severity": "P1",
      "autoFixable": false
    }
  ],

  "teams": {
    "early-adopters": {
      "members": ["developer1"],
      "mode": "enforce",
      "failOn": ["P0"]
    }
  }
}
```

### .gapignore

```
# Legacy code
tests/legacy/**
scripts/experimental/**

# Deprecated documents
docs/deprecated/**

# Third-party
node_modules/**
```

---

## 🚀 Modes

### Shadow Mode (관찰 전용)

```bash
GAP_SCAN_MODE=shadow npm run gap:scan
```

**특징:**
- Gap 발견해도 실패하지 않음
- 보고서만 생성
- 안전하게 테스트 가능

**사용 시기:**
- Week 1 관찰 기간
- 새 체크 추가 후
- 팀 적응 기간

---

### Enforce Mode (강제 적용)

```bash
GAP_SCAN_MODE=enforce npm run gap:scan
```

**특징:**
- P0/P1 gap 발견 시 실패
- Pre-commit hook에서 사용
- CI/CD에서 사용

**사용 시기:**
- Week 4 이후
- 전체 팀 적용 후

---

## 📊 Reports

### JSON Report

```bash
cat reports/gap-scan-results.json
```

**구조:**
```json
{
  "timestamp": "2025-10-01T10:44:28.739Z",
  "mode": "shadow",
  "totalChecks": 8,
  "gaps": [
    {
      "id": "cli-doc-gap:scan",
      "severity": "P1",
      "category": "docs",
      "title": "Undocumented CLI command",
      "autoFixable": false
    }
  ],
  "summary": {
    "P0": 0,
    "P1": 105,
    "P2": 1,
    "total": 106
  }
}
```

---

## 🔧 Advanced Usage

### Team-based Configuration

```json
{
  "teams": {
    "backend": {
      "members": ["dev1", "dev2"],
      "mode": "enforce",
      "failOn": ["P0", "P1"]
    },
    "frontend": {
      "members": ["dev3"],
      "mode": "shadow",
      "failOn": []
    }
  }
}
```

### ENV Override

```bash
# Highest priority
GAP_SCAN_MODE=enforce npm run gap:scan

# CI always uses shadow (unless explicitly enforce)
CI=true npm run gap:scan  # → shadow mode
```

---

## 🐛 Troubleshooting

### Q: "gap:scan: command not found"

```bash
# 확인
cat package.json | grep gap:scan

# 없으면 재설치
npm install
```

### Q: ".gaprc.json not found"

```bash
# 초기화
npm run init:gap-system

# 또는 수동 생성
touch .gaprc.json
```

### Q: Too many false positives

```bash
# 1. .gapignore에 추가
echo "my/noisy/path/**" >> .gapignore

# 2. 체크 비활성화
# .gaprc.json
{
  "checks": [
    { "id": "problematic-check", "enabled": false }
  ]
}
```

### Q: 실행이 너무 느림

```bash
# Quick mode 사용
npm run gap:scan -- --quick

# 특정 체크만 활성화
# .gaprc.json에서 enabled: false 설정
```

---

## 📚 Best Practices

### 1. 일상 개발

```bash
# 코드 변경 후
npm run gap:scan

# 커밋 전
git add -A
git commit  # Pre-commit hook이 자동 실행
```

### 2. PR 생성 전

```bash
# 전체 스캔
npm run gap:scan

# P0/P1만 확인
GAP_SCAN_MODE=enforce npm run gap:scan -- --fail-on=P0,P1
```

### 3. 배포 전

```bash
# Ship 워크플로우에 포함됨
npm run ship  # gap:scan 자동 실행
```

---

## 🔄 Integration

### Pre-commit Hook

```bash
# .git/hooks/pre-commit (자동 설치됨)
npm run gap:scan
```

### CI/CD

```yaml
# .github/workflows/gap-prevention.yml
- name: GAP Scanner
  run: npm run gap:scan
  env:
    GAP_SCAN_MODE: shadow
```

---

## 📖 Related Commands

```bash
# Document lifecycle
npm run doc:lifecycle -- --analyze
npm run doc:lifecycle -- --find-stale
npm run doc:lifecycle -- --cleanup

# GAP Scanner
npm run gap:scan
npm run gap:scan:quick
npm run gap:scan:metrics

# Quality workflow
npm run status    # 진단
npm run maintain  # 자동 수정
npm run fix       # 대화형 수정
npm run ship      # 배포
```

---

## 📞 Support

**Documentation:**
- `docs/COMMAND_WORKFLOW_GUIDE.md` - 전체 워크플로우
- `docs/COMMAND_GUIDE.md` - 명령어 레퍼런스
- `.gaprc.json` - 설정 파일

**Issues:**
- GitHub Issues: [Report a bug](https://github.com/your-repo/issues)
- Slack: #gap-scanner

---

## 📝 Changelog

**v1.0.0 (2025-10-01)**
- Initial release
- 8 core checks implemented
- Shadow/Enforce mode support
- Team-based configuration
- Auto-fix for P2 gaps

---

**Generated with Claude Code**
