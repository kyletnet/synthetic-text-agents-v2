# Option A-Prime 실행 요약

**전략**: Minimum-Believable Core (MBC) 완성 → Open-Core 공개
**기간**: 10-14일 (D+0 ~ D+14)
**현재 상태**: Phase 2C 완성, MBC 로드맵 수립 완료

**작성일**: 2025-10-08
**브랜치**: phase2c-launch → mbc-launch → opencore-release

---

## 🎯 핵심 결정 사항

**선택된 전략**: **Option A-Prime**

**이유**:
1. ✅ 기술 완성도 A+ (Phase 2C 완료)
2. ✅ 멀티에이전트 핵심 미완성 (3-Agent Council 필요)
3. ✅ 사용자 피드백 브리지 미완성 (NL Feedback Adapter 필요)
4. ✅ 10-14일 내 완성 가능 (리소스 집중)
5. ✅ IP 보호 + 신뢰 확보 병행 가능

**대안 (거부된 이유)**:
- **Option A** (내부 안정화): 타이밍 손실, PoC 기회 상실
- **Option B** (즉시 공개): 기술 설명력 부족, 핵심 가치 미전달
- **Option C** (SaaS 즉시): 리소스 분산, 신뢰 확보 실패

---

## 📊 MBC (Minimum-Believable Core) 정의

**핵심 가치 전달에 필요한 최소 완성 기준**

### 1. 3-Agent Council

```
Retriever Agent  → Evidence Collection (BM25+Vector)
    ↓
Evaluator Agent  → Quality Assessment (Ragas-inspired)
    ↓
Planner Agent    → Diversity Planning (이미 완성)
    ↓
Council Decision → Aggregate + Log
```

**현재 상태**:
- Retriever: ⚠️ RAG 인프라 있음, Agent 래핑 필요 (1-2일)
- Evaluator: ⚠️ 기본 구현만, Ragas 통합 필요 (2일)
- Planner: ✅ 완전 구현 (통합 테스트만)

**목표**: 멀티에이전트 본질(증거·품질·계획) 전달

---

### 2. NL Feedback Adapter

**Intent 6종**:
1. improvement_request (P2, 60s cooldown)
2. error_report (P1, 30s cooldown)
3. policy_modification (P1, 120s cooldown)
4. evidence_addition (P2, 60s cooldown)
5. performance_degradation (P0, 0s cooldown)
6. cost_warning (P1, 300s cooldown)

**Pipeline**:
```
User NL Input
    ↓ Intent Classification (GPT-4o-mini)
Intent 6-type
    ↓ Cooldown Check
Event Creation
    ↓ parseOnly → validate → sandbox
Policy Interpreter
    ↓ Approval Required
Governance Kernel Commit
```

**현재 상태**: FeedbackAdapter 기본 구조 있음, Intent 분류 및 승인형 파이프라인 연결 필요 (2-3일)

---

### 3. 거버넌스 게이트

**이미 준비됨**:
- ✅ Gate A-D (TypeScript, Lint, Sanity, Smoke)
- ✅ Parser Trust Boundary (parseOnly → validate → sandbox)
- ✅ Loop Scheduler (adaptive 2-10s, queue limit 20)
- ✅ Sandbox Runner (VM isolation, 1s timeout, 50MB limit)
- ✅ Self-Tuning Agent (Advisor mode, no auto-apply)

**추가 필요**:
- [ ] Canary 배포 설정 (10% → 50% → 100%)
- [ ] Go/No-Go 자동 검증 스크립트 (오늘 생성 완료)

---

## 🗓️ 10-14일 일정 (요약)

### Phase 1: D+0 ~ D+2 (3-Agent Council)
- [x] D+0: 전략 확정, 로드맵 작성, 에이전트 분석
- [ ] D+1-2: Retriever Agent 구현 + Evaluator Agent 확장 + Council 통합

**완료 기준**: E2E 테스트 통과, latency <3s

---

### Phase 2: D+3 ~ D+6 (NL Feedback Adapter)
- [ ] D+3-4: Intent Classifier 구현 (GPT-4o-mini)
- [ ] D+5-6: Feedback → Policy Bridge 구현 (승인형 파이프라인)

**완료 기준**: E2E 테스트 통과, no sandbox bypass, approval required

---

### Phase 3: D+7 ~ D+10 (WebView + Go/No-Go)
- [ ] D+7-8: WebView v1 (SSR Feedback Console)
- [ ] D+9-10: Go/No-Go 검증 (11 gates)

**완료 기준**: 모든 gates PASS, no secrets exposed

---

### Phase 4: D+11 ~ D+14 (Canary + Soft Launch)
- [ ] D+11-12: Canary 10% 배포, 모니터링
- [ ] D+13-14: Open-Core 구조 생성, GitHub 공개

**완료 기준**: GitHub public, demo live, no critical issues in 48h

---

## ✅ Go/No-Go 체크리스트

### Technical Gates (7개)

| Gate | 기준 | PASS 조건 |
|------|------|----------|
| A. 3-Agent Council | 통합 테스트 | ≥90% pass |
| B. NL Feedback | E2E 파이프라인 | 100% pass |
| C. Governance | /guard --strict | PASS |
| D. Performance | Latency p95 | ≤3.1s |
| E. Reliability | Error rate | <1% |
| F. Security | Secret exposure | 0 violations |
| G. Baseline | Generation | SUCCESS |

### Operational Gates (4개)

| Gate | 기준 | PASS 조건 |
|------|------|----------|
| H. Documentation | README + ARCH + ROLLBACK + FAQ | All exist |
| I. Demo | SSR WebView | COMPLETE |
| J. Monitoring | Dashboard | Grafana/Sentry live |
| K. Rollback | Plan | docs/ROLLBACK.md exists |

**자동 검증**: `npm run mbc:gonogo`

---

## 🔒 보안/유출 방지

### 공개 영역 (Open-Core)

```
public/
├── open-template/
│   ├── agent-skeleton.ts          # Abstract only
│   ├── prompt-examples/           # 2-3 samples
│   └── quality-rubric.md          # Criteria only
├── demo-ui/                       # SSR static results
├── docs/
│   ├── README.md                  # Free vs SaaS
│   └── ARCHITECTURE.md            # High-level
└── .vercel.json
```

### 비공개 영역 (Proprietary)

```
private/ (NOT in public repo)
├── src/core/orchestrator.ts       # Multi-agent bus
├── src/core/governance/           # Governance kernel
├── src/feedback/                  # Feedback loop
├── src/infrastructure/governance/ # Policy DSL
├── governance-rules.yaml
├── .env
└── feature-flags.json
```

**보호 전략**: "투명한 껍데기" (신뢰) + "불투명한 핵심" (IP)

---

## 📊 성능 KPI (Demo vs SaaS)

| Metric | Demo (Open-Core) | SaaS (Production) |
|--------|------------------|-------------------|
| Alignment | ≥60% | ≥85% |
| Latency p95 | ≤3.1s | ≤2.5s |
| Coverage | ≥70% | ≥90% |
| Cost/1k QA | ≤$0.10 | ≤$0.07 |
| Error Rate | <2% | <0.5% |
| Quality | 7.5/10 | 9.2/10 |

**전략**: Demo 70% + Mystery 30% → SaaS 전환 유도

---

## 🚨 위험 시나리오 + 대응

| 시나리오 | 리스크 | 대응 |
|---------|--------|------|
| 외부 문서 대량 투입 | CPU spike | Loop Scheduler (queue 20) |
| 정책 충돌 | Alert flood | Policy conflict map |
| 피드백 과적응 | Quality oscillation | Cooldown 60s + batch 3 |
| WebView 내부 노출 | IP leak | SSR only + Secret lint |
| 로그 폭증 | Disk full | Rotation 7d/1GB |
| Canary 실패 | Regression | Auto-rollback <5min |

---

## 💼 영업 대응 준비

### PoC 요청 시

**제공**:
1. GitHub Open-Core 링크
2. Demo WebView URL
3. README (Free vs SaaS)
4. ARCHITECTURE.md

**스크립트**:
> "Our open-core repo demonstrates the core architecture. For production deployment with full multi-agent orchestration, governance kernel, and adaptive feedback loop, please contact us for enterprise tier."

### FAQ

**Q: How does multi-agent work?**
> A: We use a 3-agent council (Retriever, Evaluator, Planner) with governance-based coordination. Full details in enterprise tier.

**Q: Can I self-host?**
> A: Open-core supports self-hosting with agent templates. Full orchestration requires SaaS license.

**Q: Performance difference?**
> A: Open-core: 70% quality, 3.1s. SaaS: 85%+ quality, 2.5s with adaptive loop.

---

## 📋 최종 체크리스트 (D+14)

### Code Quality
- [ ] TypeCheck: 0 errors
- [ ] Lint: 0 errors
- [ ] Tests: ≥90% pass
- [ ] Secret lint: 0 violations

### Performance
- [ ] Latency p95: ≤3.1s
- [ ] Error rate: <1%
- [ ] Quality: ≥7.5/10

### Security
- [ ] Sandbox: ENFORCED
- [ ] Parser boundary: INTACT
- [ ] No secrets in public: VERIFIED
- [ ] SSR only: CONFIRMED

### Documentation
- [ ] README.md: COMPLETE
- [ ] ARCHITECTURE.md: COMPLETE
- [ ] ROLLBACK.md: COMPLETE
- [ ] FAQ.md: COMPLETE

### Deployment
- [ ] Vercel: LIVE
- [ ] GitHub: PUBLIC
- [ ] Monitoring: LIVE
- [ ] Baseline: SUCCESS

### Business
- [ ] Demo: SHAREABLE
- [ ] PoC: READY
- [ ] Pricing: CLEAR
- [ ] Support: DEFINED

---

## 🎯 성공 지표 (First 30 Days)

| Metric | Target |
|--------|--------|
| GitHub Stars | >100 |
| Demo Visits | >500/week |
| SaaS Inquiries | >10 |
| Conversion Rate | >5% |
| Uptime | >99.5% |
| Error Rate | <1% |

---

## 🚀 즉시 액션

### Day 0 (오늘) - 완료된 것
- [x] 전략 방향 확정 (Option A-Prime)
- [x] MBC 로드맵 작성 완료
- [x] 현재 에이전트 상태 분석 완료
- [x] Go/No-Go 체크리스트 스크립트 생성
- [x] 실행 요약 문서 작성

### Day 1 (내일) - 즉시 착수
- [ ] Retriever Agent 구현 시작
- [ ] Evaluator Agent 확장 시작
- [ ] 3-Agent Council 아키텍처 상세 설계

### 커밋 및 태깅
```bash
# 오늘 작업 커밋
git add reports/mbc-roadmap-phase2c-to-opencore.md
git add reports/option-a-prime-execution-summary.md
git add scripts/mbc-gonogo-check.ts
git commit -m "docs: MBC roadmap and Go/No-Go validation setup

- Add detailed 10-14 day MBC execution plan
- Create automated Go/No-Go validation script
- Document 3-Agent Council architecture
- Define NL Feedback Adapter requirements
- Establish security boundaries and KPIs"

# 태그 생성
git tag phase2c-mbc-planning-complete
```

---

## 💡 최종 권고

**현재 시점**: Phase 2C 완성 → MBC 로드맵 수립 완료

**다음 단계**: 10-14일 집중 개발

**핵심 원칙**:
1. **최소 완성 기준** - 3-Agent + NL Feedback
2. **Go/No-Go 검증** - 11 gates 통과 필수
3. **투명 + 불투명** - 신뢰 + IP 보호
4. **자연스러운 전환** - Demo → SaaS 유도

**성공 기준**:
- D+10: Go/No-Go PASS
- D+14: GitHub public + Demo live
- D+30: >100 stars, >10 inquiries, >5% conversion

---

**작성자**: Claude Code (MBC Strategy)
**승인 대기**: Kay (Technical Lead)
**상태**: READY TO EXECUTE
