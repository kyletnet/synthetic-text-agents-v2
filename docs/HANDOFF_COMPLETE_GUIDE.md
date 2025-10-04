# 시스템 인수인계 완벽 가이드

## 🎯 목적

다른 LLM/개발자에게 현재 시스템의 **모든 맥락과 상황**을 빠짐없이 전달하기 위한 문서 패키지 가이드

---

## 📦 필수 문서 패키지 (우선순위 순)

### Tier 1: 시스템 이해 (필수, 30분 읽기)

1. **CLAUDE.md** - 시스템 철학 및 핵심 설계
   - 위치: `/CLAUDE.md`
   - 내용: 8-Agent 시스템, 사고 과정 프로그래밍, 품질 우선 원칙
   - 필수 이유: 시스템 전체 맥락

2. **LLM_DEVELOPMENT_CONTRACT.md** - 개발 계약 (변경 금지 룰)
   - 위치: `/LLM_DEVELOPMENT_CONTRACT.md`
   - 내용: No-Mock 정책, Feature Flag First, 하위 호환성
   - 필수 이유: 개발 시 반드시 준수해야 할 규칙

3. **DEVELOPMENT_STANDARDS.md** - 코드 표준
   - 위치: `/docs/DEVELOPMENT_STANDARDS.md`
   - 내용: TypeScript 스타일, 에러 처리, 로깅, 네이밍
   - 필수 이유: 코드 작성 기준

### Tier 2: 워크플로우 (필수, 20분 읽기)

4. **SLASH_COMMAND_WORKFLOW.md** - 일상 개발 워크플로우
   - 위치: `/docs/SLASH_COMMAND_WORKFLOW.md`
   - 내용: `/inspect` → `/maintain` → `/fix` → `/ship` 순서
   - 필수 이유: 개발 프로세스 전체 흐름

5. **QUALITY_GOVERNANCE_SUMMARY.md** - 품질 거버넌스 업데이트
   - 위치: `/docs/QUALITY_GOVERNANCE_SUMMARY.md`
   - 내용: 품질 필수 파일 보호, SecurityGuard, CI/CD 자동화
   - 필수 이유: 최신 시스템 변경사항 (2025-10-04 업데이트)

6. **GUIDELINE_INTEGRATION.md** - 가이드라인 작성 및 통합
   - 위치: `/docs/GUIDELINE_INTEGRATION.md`
   - 내용: 도메인 전문가가 가이드라인 제공하는 3가지 방법
   - 필수 이유: 외부 전문가 협업 프로세스

### Tier 3: 정책 및 구성 (필수, 10분 읽기)

7. **quality-policy.json** - 품질 정책 (Single Source of Truth)
   - 위치: `/quality-policy.json`
   - 내용: 품질 필수 파일 목록, 리팩토링 기준, 인용 품질 임계값
   - 필수 이유: 시스템 품질 기준 중앙 관리

8. **governance-rules.json** - 거버넌스 규칙
   - 위치: `/governance-rules.json`
   - 내용: 타임아웃 정책, Loop Detection, Snapshot, 품질 보호
   - 필수 이유: 시스템 안정성 및 거버넌스 규칙

---

## 📚 선택적 문서 (상황별)

### 아키텍처 이해 필요 시

9. **llm_friendly_summary.md** - 기술 아키텍처 요약
   - 위치: `/docs/llm_friendly_summary.md`
   - 내용: 8-Agent 구조, RAG 시스템, 통신 프로토콜

10. **SYSTEM_ARCHITECTURE_MAP.md** - 시스템 맵
    - 위치: `/docs/SYSTEM_ARCHITECTURE_MAP.md`
    - 내용: 디렉토리 구조, 핵심 모듈, 의존성 그래프

### 배포/운영 필요 시

11. **OPERATIONS_GUIDE.md** - 운영 가이드
    - 위치: `/docs/OPERATIONS_GUIDE.md`
    - 내용: 배포 프로세스, 모니터링, 장애 대응

12. **GITHUB_SETUP.md** - GitHub Actions CI/CD
    - 위치: `/docs/GITHUB_SETUP.md`
    - 내용: Workflow 설명, Secrets 설정

### 개발 중 참고 사항

13. **TYPESCRIPT_GUIDELINES.md** - TypeScript 상세 가이드
    - 위치: `/docs/TYPESCRIPT_GUIDELINES.md`
    - 내용: strict 모드, any 사용 규칙, 에러 처리

14. **COMMIT_CONVENTIONS.md** - 커밋 컨벤션
    - 위치: `/docs/COMMIT_CONVENTIONS.md`
    - 내용: 커밋 메시지 형식, 브랜치 전략

---

## 🚀 빠른 시작 (10분 부트캠프)

### Step 1: 시스템 철학 이해 (5분)
```bash
# 1. 핵심 설계 철학 읽기
cat CLAUDE.md | head -100

# 핵심 메시지:
# - 품질 > 복잡도
# - 8-Agent 협업 시스템
# - 사고 과정 프로그래밍 (Thought-Process Programming)
```

### Step 2: 개발 규칙 숙지 (3분)
```bash
# 2. 개발 계약 읽기
cat LLM_DEVELOPMENT_CONTRACT.md

# 금지 사항:
# - ❌ Mock 데이터 사용 (실제 구현 우선)
# - ❌ 하위 호환성 깨기
# - ❌ Feature Flag 없이 신규 기능 추가
```

### Step 3: 워크플로우 실습 (2분)
```bash
# 3. 일상 개발 워크플로우
npm run status          # 1단계: 진단
npm run maintain        # 2단계: 자동 수정
# npm run fix           # 3단계: 승인 필요 (선택적)
# git commit && git push
```

---

## 📋 인수인계 체크리스트

### 시스템 이해도 확인

- [ ] CLAUDE.md 읽고 8-Agent 시스템 이해
- [ ] quality-policy.json에서 품질 필수 파일 3개 확인
- [ ] `/inspect` → `/maintain` → `/fix` → `/ship` 순서 암기
- [ ] No-Mock 정책 이해 (Mock 금지, 실제 구현 우선)

### 개발 환경 설정

- [ ] `npm install` 성공
- [ ] `npm run typecheck` PASS
- [ ] `npm run test` PASS
- [ ] `.env` 파일 설정 (ANTHROPIC_API_KEY)

### 실습 완료

- [ ] `npm run status` 실행 성공
- [ ] `npm run maintain` 실행 성공
- [ ] `npx tsx scripts/lib/security-guard.ts` 실행 (순환 의존성 체크)
- [ ] `npx tsx scripts/test-quality-integration.ts` 통과 (22/22 테스트)

### 최신 변경사항 이해

- [ ] 품질 필수 파일 보호 시스템 (2025-10-04)
- [ ] SecurityGuard (Race condition + 순환 의존성)
- [ ] Weekly Radar (매주 월요일 자동 스캔)
- [ ] CI/CD Quality Protection Check

---

## 💡 인수인계 시나리오별 가이드

### 시나리오 1: LLM에게 인수인계

**전달 프롬프트 예시**:
```
나는 이 프로젝트의 맥락을 완전히 이해해야 해.
아래 순서대로 읽어줘:

1. CLAUDE.md - 시스템 철학
2. LLM_DEVELOPMENT_CONTRACT.md - 개발 규칙
3. docs/SLASH_COMMAND_WORKFLOW.md - 워크플로우
4. docs/QUALITY_GOVERNANCE_SUMMARY.md - 최신 업데이트
5. quality-policy.json - 품질 정책

읽은 후 다음 질문에 답해줘:
- 품질 필수 파일 3개는 무엇?
- 일상 개발 워크플로우 4단계는?
- No-Mock 정책이란?
```

**검증 질문**:
- Q: "domainConsultant.ts를 자동 리팩토링해도 돼?"
  - A: "❌ 안 됨. quality-policy.json에서 품질 필수 파일로 지정됨. 수동 승인 필요."

### 시나리오 2: 신규 개발자 온보딩

**Day 1 (환경 설정)**:
1. 저장소 클론
2. `npm install`
3. `.env.example` → `.env` (API 키 설정)
4. `npm run status` 실행 확인

**Day 2 (시스템 이해)**:
1. CLAUDE.md 정독
2. docs/llm_friendly_summary.md 읽기
3. `npm run dev` 실행하여 QA 생성 체험

**Day 3 (개발 실습)**:
1. 간단한 기능 추가 (테스트 코드 포함)
2. `/inspect` → `/maintain` → `/fix` 워크플로우 실습
3. PR 생성 및 CI/CD 확인

### 시나리오 3: 긴급 이슈 대응

**최소한의 이해로 빠른 대응**:
```bash
# 1. 현재 상태 파악 (2분)
npm run status

# 2. 이슈 관련 문서 찾기
grep -r "ERROR_MESSAGE" docs/

# 3. 품질 필수 파일 확인
cat quality-policy.json | jq '.agentProtection.static'

# 4. 수정 전 백업
git checkout -b hotfix/emergency-fix

# 5. 수정 후 검증
npm run status
npm run test

# 6. 긴급 배포
npm run ship
```

---

## 🔍 심화 학습 경로

### Level 1: 기본 이해 (1-2일)
- [x] Tier 1 문서 (CLAUDE.md, LLM_DEVELOPMENT_CONTRACT.md, DEVELOPMENT_STANDARDS.md)
- [x] 워크플로우 실습 (/inspect → /maintain)
- [x] 통합 테스트 실행

### Level 2: 시스템 숙련 (1주)
- [ ] 전체 8-Agent 구조 이해 (src/agents/)
- [ ] RAG 시스템 원리 (src/rag/)
- [ ] 품질 검증 메트릭 (scripts/metrics/)
- [ ] 신규 기능 구현 (Feature Flag 사용)

### Level 3: 시스템 확장 (2주+)
- [ ] 신규 Agent 추가 (scripts/generate-agent.sh)
- [ ] 커스텀 가이드라인 작성 (guidelines/)
- [ ] 플러그인 시스템 개발 (plugins/)
- [ ] CI/CD 파이프라인 커스터마이징

---

## 📊 문서 맵 (한눈에 보기)

```
프로젝트 루트/
├── CLAUDE.md ⭐⭐⭐ (시스템 철학)
├── LLM_DEVELOPMENT_CONTRACT.md ⭐⭐⭐ (개발 계약)
├── quality-policy.json ⭐⭐⭐ (품질 정책)
├── governance-rules.json ⭐⭐ (거버넌스 규칙)
│
├── docs/
│   ├── SLASH_COMMAND_WORKFLOW.md ⭐⭐⭐ (워크플로우)
│   ├── QUALITY_GOVERNANCE_SUMMARY.md ⭐⭐⭐ (최신 업데이트)
│   ├── GUIDELINE_INTEGRATION.md ⭐⭐ (가이드라인 작성법)
│   ├── DEVELOPMENT_STANDARDS.md ⭐⭐ (코드 표준)
│   ├── TYPESCRIPT_GUIDELINES.md ⭐ (TypeScript 가이드)
│   ├── llm_friendly_summary.md ⭐ (기술 아키텍처)
│   ├── OPERATIONS_GUIDE.md ⭐ (운영 가이드)
│   └── COMMIT_CONVENTIONS.md ⭐ (커밋 규칙)
│
└── scripts/
    ├── test-quality-integration.ts (통합 테스트)
    └── lib/
        ├── quality-policy.ts (정책 관리자)
        ├── quality-history.ts (품질 이력)
        └── security-guard.ts (보안 가드)
```

⭐⭐⭐ = 필수 (30분)
⭐⭐ = 중요 (20분)
⭐ = 선택적 (필요 시)

---

## 🎯 인수인계 완료 기준

### 최소 기준 (1일 이내)
- ✅ Tier 1 문서 3개 읽기 완료
- ✅ `npm run status` 실행 가능
- ✅ 품질 필수 파일 3개 암기
- ✅ 기본 워크플로우 이해

### 권장 기준 (3일 이내)
- ✅ Tier 1-3 모든 문서 읽기
- ✅ 통합 테스트 22개 모두 통과 확인
- ✅ 간단한 기능 추가 PR 생성 성공
- ✅ CI/CD 파이프라인 이해

### 완벽 기준 (1주 이내)
- ✅ 전체 시스템 아키텍처 이해
- ✅ 8-Agent 역할 및 협업 방식 숙지
- ✅ 품질 거버넌스 시스템 완전 이해
- ✅ 독립적 개발 및 배포 가능

---

## 📞 추가 리소스

### 자주 묻는 질문

**Q: 문서가 너무 많은데 어디서 시작하나요?**
A: CLAUDE.md → LLM_DEVELOPMENT_CONTRACT.md → SLASH_COMMAND_WORKFLOW.md 순서로 읽으세요 (30분 소요).

**Q: 품질 필수 파일을 수정하려면?**
A: quality-policy.json 확인 → 테스트 실행 → 커밋 메시지에 이유 명시 → PR 생성.

**Q: /radar는 언제 실행하나요?**
A: 주 1회 (월요일) 또는 릴리즈 전. 일상 개발에서는 /inspect만 사용.

**Q: CI/CD가 실패하면?**
A: docs/QUALITY_GOVERNANCE_SUMMARY.md의 "CI/CD 실패 처리" 섹션 참고.

### 커뮤니티 및 지원

- GitHub Issues: 버그 리포트 및 기능 제안
- 내부 Slack: #qa-generation-dev 채널
- 문서 업데이트: `npm run docs:refresh` 실행

---

## 🎁 인수인계 패키지 다운로드

**전체 문서 패키지 생성**:
```bash
# Tier 1-3 필수 문서만 추출
tar -czf handoff-package.tar.gz \
  CLAUDE.md \
  LLM_DEVELOPMENT_CONTRACT.md \
  quality-policy.json \
  governance-rules.json \
  docs/SLASH_COMMAND_WORKFLOW.md \
  docs/QUALITY_GOVERNANCE_SUMMARY.md \
  docs/GUIDELINE_INTEGRATION.md \
  docs/DEVELOPMENT_STANDARDS.md

# 패키지 크기 확인 (약 500KB)
ls -lh handoff-package.tar.gz
```

**읽기 순서 체크리스트**:
```bash
# .handoff-checklist.md 자동 생성
cat > .handoff-checklist.md << 'EOF'
# 인수인계 체크리스트

## Day 1: 시스템 이해
- [ ] CLAUDE.md 읽기 (20분)
- [ ] LLM_DEVELOPMENT_CONTRACT.md 읽기 (10분)
- [ ] npm run status 실행 성공

## Day 2: 워크플로우 실습
- [ ] SLASH_COMMAND_WORKFLOW.md 읽기 (15분)
- [ ] npm run maintain 실행 성공
- [ ] npm run fix 실행 경험

## Day 3: 품질 시스템 이해
- [ ] QUALITY_GOVERNANCE_SUMMARY.md 읽기 (20분)
- [ ] quality-policy.json 이해
- [ ] 통합 테스트 실행 (npx tsx scripts/test-quality-integration.ts)

## 완료 기준
- [ ] 품질 필수 파일 3개 암기
- [ ] 4단계 워크플로우 암기
- [ ] No-Mock 정책 이해
EOF
```

---

**마지막 업데이트**: 2025-10-04
**작성자**: Kyle (System Architect)
**검토자**: Claude Code AI Assistant
