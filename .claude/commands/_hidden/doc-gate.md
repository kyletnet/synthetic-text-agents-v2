# /doc-gate - 문서 품질 게이트 시스템

릴리스/머지 차단을 위한 문서 품질 기준 검증 시스템입니다.

## 사용법

```bash
/doc-gate           # 품질 게이트 실행
/doc-gate ci        # CI/CD용 (실패 시 exit 1)
/doc-gate status    # GitHub 상태 생성
```

## 🔐 Quality Gate 규칙

### Blocking Rules (릴리스 차단)
- **📊 Coverage Threshold**: 문서 커버리지 > 80%
- **📅 Freshness Gate**: 7일 이상 오래된 문서 없음
- **🔗 Broken Links**: 깨진 내부 링크 없음

### Warning Rules (경고만)
- **🏗️ Structure Violations**: 구조 위반 < 5개
- **🧩 LLM Signals**: 50% 이상 문서에 최적화 태그

## 출력 예시

```
🔐 Document Quality Gate Report
================================
📊 Overall: PASS
📈 Rules passed: 4/5

📋 Rule Results:
   ✅ coverage-threshold: Coverage: 87.3% (threshold: 80%)
   ✅ freshness-gate: Critical stale docs: 0
   ⚠️  structure-violations: Structure violations: 7 (threshold: <5)
   ✅ broken-links: Broken links: 0
   ✅ llm-signals: LLM signals: 65.2% of docs (15/23)

✅ Quality Gate: PASSED
```

## CI/CD 통합

### GitHub Actions 예시
```yaml
- name: 🔐 Execute Quality Gate
  run: npm run docs:gate:ci
```

### Pre-commit Hook
```bash
#!/bin/sh
npm run docs:gate:ci || {
  echo "❌ Documentation quality gate failed"
  echo "Run 'npm run docs:audit' to see issues"
  exit 1
}
```

## 🔧 문제 해결 가이드

**Coverage < 80%**:
```bash
npm run docs:audit:full  # 누락된 문서 확인
# 누락된 Agent/명령어/API 문서 작성
```

**Stale Documents**:
```bash
npm run docs:freshness   # 오래된 문서 목록
# 해당 문서들 업데이트
```

**Structure Violations**:
```bash
npm run docs:lint       # 구조 문제 확인
# 필수 섹션 추가 (# Overview, ## Usage 등)
```

**Missing LLM Signals**:
```bash
npm run docs:signals:inject    # 자동 시그널 삽입
npm run docs:signals:validate  # 검증
```

이 시스템은 **품질이 낮은 문서가 production에 도달하는 것을 사전에 차단**합니다.