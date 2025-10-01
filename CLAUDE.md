# Meta-Adaptive Expert Orchestration System

AI-powered QA generation using 8-Agent collaboration

## Purpose & Scope

Bootstrap a production-ready TypeScript system that orchestrates multiple AI agents to generate high-quality Q&A datasets. This system uses "thought-process programming" to replicate expert reasoning patterns rather than simple data generation.

## Taxonomy Owner & Canonical Map

All code generators, validators, and reports MUST use the canonical taxonomy defined below. No custom severity levels or stage names are permitted.

### Canonical Severities

**P0 - Critical**: System broken, blocking all progress

- Action: Immediate fix required before any proceeding
- Examples: Build completely fails, core API unavailable, data corruption

**P1 - High**: Significant impact, major feature broken

- Action: Fix required within current milestone
- Examples: Key feature non-functional, performance severely degraded, security vulnerability

**P2 - Medium**: Moderate impact, minor feature issues

- Action: Fix recommended but not blocking
- Examples: Edge case failures, minor performance issues, non-critical feature gaps

### Canonical Stages

The preflight pipeline follows these exact stage identifiers:

1. **STEP_1_TYPESCRIPT** - TypeScript validation and type checking
2. **STEP_2_LINT** - Code linting and style validation
3. **STEP_3_SANITY** - Basic sanity checks and configuration validation
4. **STEP_4_SMOKE_PAID** - Paid smoke tests against live APIs
5. **STEP_5_GATING** - P0/P1/P2 policy evaluation and gating decisions
6. **STEP_6_OBSERVABILITY** - Observability export and consistency validation
7. **STEP_7_FULL_RUN** - Full production run with complete dataset

### Enforcement Rules

- **Import canonical definitions**: `import { CANONICAL_SEVERITIES, CANONICAL_STAGES } from './scripts/metrics/taxonomy.js'`
- **Use exact tokens**: No variations, abbreviations, or custom naming
- **Validation**: Run `npm run taxo:check` to verify compliance
- **Auto-fix**: Use `/fix-taxonomy` command to correct mismatches
- **Success criteria**: CASES_TOTAL > 0 and RESULT ∈ {PASS, PARTIAL}

### References

- `docs/PRODUCT_PLAN.md` (roadmap uses P2~P5 only)
- `scripts/metrics/taxonomy.ts` (single source of truth)

All generators must import and use these exact tokens. The taxonomy checker (`scripts/ci/check_taxonomy_consistency.ts`) validates compliance across the entire codebase.

## Core Principles

### Quality > Complexity

- QA quality is the primary metric - system complexity is acceptable to achieve expert-level output (9.5/10 target)
- Agent additions must demonstrate clear quality improvements
- Processing time is secondary to result accuracy and expertise

### Adaptability > Efficiency

- Dynamic agent selection based on task complexity (5-8 agents depending on requirements)
- Simple requests use fewer agents for efficiency; complex requests engage full council
- Meta-Controller determines optimal agent combinations per task

### Transparency > Automation

- All decisions must be auditable and explainable
- Complete trace logs for every agent interaction and decision point
- Agent reasoning processes exposed in structured logs, never in user-facing output

## Architecture Overview

### Meta-Controller

Central orchestrator that:

- Analyzes request complexity (1-10 scale)
- Selects optimal agent combinations
- Manages inter-agent communication
- Resolves conflicts and makes final decisions

### 8-Agent Council Structure

**Core Engine (4):**

- Meta-Controller: Process orchestration and strategy
- Prompt Architect: Expert advice integration and prompt design
- QA Generator: Bulk QA creation from optimized prompts
- Quality Auditor: Multi-level verification and improvement

**Expert Council (4):**

- Psychology Specialist: User psychology and communication strategy
- Linguistics Engineer: LLM optimization and language structure
- Domain Consultant: Domain-specific expertise (CS/marketing/sales/etc)
- Cognitive Scientist: Expert thinking process modeling

### Dynamic Expert Summoning

- 50-expert base pool for common specializations
- Deep Specialization: Auto-generation of hyper-specific experts when needed
- Performance Guardian monitors agent performance and collaboration

## AgentCommunication Schema

```typescript
interface AgentMessage {
  id: string;
  sender: string;
  receiver: string;
  type: "request" | "response" | "broadcast" | "collaboration";
  content: unknown;
  timestamp: Date;
  priority: 1 | 2 | 3 | 4 | 5;
  context?: AgentContext;
}

interface AgentContext {
  taskId: string;
  phase: string;
  sharedMemory: Record<string, unknown>;
  qualityTarget: number;
  domainContext: string;
}

interface AgentResult {
  agentId: string;
  result: unknown;
  confidence: number;
  reasoning: string; // For audit trail only
  performance: {
    duration: number;
    tokensUsed: number;
    qualityScore: number;
  };
}
```

### Routing & Logging

- All messages flow through central bus with persistent JSONL trace logging
- Each agent interaction creates structured log entry with reasoning
- Performance metrics tracked per agent and per collaboration session
- No internal reasoning exposed in final user output

## Thought-Process Programming

### Psychology Integration

- User emotional state analysis drives response tone and structure
- Cognitive biases considered in question formulation and answer framing
- Motivation analysis ensures questions address real user needs

### Linguistics Optimization

- LLM-specific prompt optimization for maximum comprehension
- Domain terminology validation and consistency
- Multi-layered language quality assurance

### Cognitive Science Application

- Expert mental models explicitly captured in QA structure
- Implicit knowledge made explicit through structured reasoning
- Decision trees mirror actual expert thought processes

**Critical**: Internal agent "thoughts" and reasoning stay in trace logs. User output contains only final QA pairs and quality metadata.

## Development Standards

### Agent Implementation

- All agents inherit from BaseAgent abstract class
- Async/await required for all agent methods
- Input/output validation using Zod schemas
- Performance logging mandatory for all operations
- Fallback mechanisms for agent communication failures

### Communication Protocol

- Standard AgentCommunication interface for all inter-agent messaging
- Message queuing with priority handling
- Collision detection and resolution for conflicting recommendations
- Timeout handling with graceful degradation

### Code Quality

- TypeScript strict mode with comprehensive type hints
- Unit tests required for all agent implementations
- Integration tests for full workflow scenarios
- Performance benchmarks for agent combinations

### File Organization

```
src/
  shared/        # Types, logger, bus, registry, metrics
  core/          # BaseAgent, orchestrator, meta-controller, performance guardian
  agents/        # 8-Agent council implementations (QA, Quality, Psychology, etc.)
  cli/           # Demo runner and development tools
  utils/         # Cost estimation, logging utilities
  rag/           # RAG chunking and retrieval
  clients/       # API adapters (Anthropic, etc.)
  services/      # External service integrations
  augmentation/  # Data augmentation and paraphrasing
  scripts/       # Build tools, metrics, CI/CD utilities
tests/           # Comprehensive test suite
scripts/         # Top-level operational scripts
legacy/          # Deprecated code (excluded from builds)
```

## Prompting Conventions for Claude Code Sessions

### Context Loading

**MANDATORY**: Always start sessions by loading key documents:

```
@CLAUDE.md                           # System philosophy (THIS FILE)
@LLM_DEVELOPMENT_CONTRACT.md         # Development contract (REQUIRED)
@DEVELOPMENT_STANDARDS.md            # Standards enforcement
@docs/llm_friendly_summary.md        # Technical architecture
@HANDOFF_NAVIGATION.md               # Navigation guide
```

**CRITICAL**: Before ANY code modification, these files MUST be referenced. Failure to follow standards results in system degradation.

### Implementation Requests

- Reference specific sections: "Based on agent_implementation_spec.md section 2.1, implement MetaController class"
- Include acceptance criteria: "Must include complexity analysis scoring 1-10 and agent selection logic"
- Specify integration points: "Should integrate with AgentRegistry and PerformanceGuardian"

### Quality Gates

Before marking implementation complete:

- All TypeScript compilation must pass (`tsc --noEmit`)
- Unit tests written and passing for core functionality
- Integration with existing agent communication bus verified
- Performance logging hooks implemented

## Test & Audit Philosophy

### Quality Auditor Rubric

**Level 1 - Structural (Form, completeness):**

- Q&A format adherence
- Response completeness and detail level
- Professional language and tone

**Level 2 - Expertise (Domain accuracy):**

- Correct domain terminology usage
- Industry standard compliance
- Expert-level insight demonstration

**Level 3 - Practicality (Real-world applicability):**

- Realistic scenario coverage
- Actionable guidance provided
- User comprehension and applicability

**Level 4 - Innovation (Unique value):**

- Novel insights beyond standard references
- Tacit knowledge made explicit
- Unexpected situation coverage

### Regression Testing

- Seed QA dataset in /cli/seeds.json for consistent quality baselines
- Automated quality scoring on every major change
- Performance regression detection across agent combinations

## Change Management

### Safe Agent Evolution

- Agent changes tested in isolation before integration
- A/B testing framework for prompt modifications
- Rollback procedures for performance degradation
- Version control for agent prompt templates

### Prompt Engineering Standards

- All prompts stored as external files, never hard-coded
- Versioning and change tracking for all prompt modifications
- Expert review required for core agent prompt changes
- Performance impact assessment for all prompt updates

### System Scaling

- Agent addition procedures with integration testing
- Performance impact assessment for new capabilities
- Backward compatibility requirements for API changes
- Documentation updates mandatory for all architectural changes

## Development Safety Rules (Always-On)

- **No-Mock Policy**: 꼭 필요한 경우가 아니면 Mock 데이터나 시뮬레이션을 사용하지 않는다. 실제 기능 구현을 우선한다. Mock은 초기 프로토타입이나 외부 API 의존성이 불가피한 경우에만 사용하며, 가능한 빨리 실제 구현으로 대체한다. **절대 금지**: API 스펙 불일치를 "건너뛰기"나 "회피"로 해결하는 것. 반드시 API 계약을 완전히 구현해야 한다.
- **Feature Flag First**: 모든 신규 기능은 환경변수 기반 Feature Flag로 가드한다. 기본값은 프로젝트 상황에 따라 정하되, 릴리즈 안정이 우선일 땐 `false`(off)를 기본으로 둔다. 예) `FEATURE_<FEATURE_NAME>=false`.
- **Compatibility Fallback**: 새 경로/엔진을 추가해도 기존 오케스트레이션 경로(runCouncil 등)는 **삭제 금지**. FLAG가 꺼져 있으면 기존 동작이 100% 재현되어야 한다.
- **Mandatory Docs**: 각 기능은 반드시 아래 문서를 동반한다.
  - `docs/RFC/<YYYY-MM>-<feature>.md` (동기/설계/리스크/롤백/테스트플랜)
  - `docs/CHANGELOG.md` (변경 요약)
  - `docs/MIGRATION.md` (환경변수/마이그레이션 조치)
- **Smoke Payloads**: 새로운 API 엔트리포인트/모드가 생기면 `apps/fe-web/dev/runs/*.json`에 스모크 페이로드를 추가한다(최소 1개). 이를 통해 수동/자동 회귀를 즉시 돌릴 수 있어야 한다.
- **Never Break Existing Contracts**: 공개된 타입/라우팅/로그 경로는 하위 호환을 유지한다. 필요 시 버전드 엔드포인트 또는 Feature Flag 분리.
- **Release Gate**: FLAG가 `false`일 때 성능·로그·품질이 기존과 동일해야 한다. 이 기준을 만족하기 전에는 기본값을 `true`로 바꾸지 않는다.
- **Trace & Telemetry**: 새 경로에서도 RUN_LOGS/DECISIONS 작성, 태그(run_tags) 일관 유지.

> **실행 체크리스트**
>
> - [ ] Feature Flag 추가 및 기본값 결정
> - [ ] FLAG off → 기존 동작 100% 재현 확인
> - [ ] RFC/CHANGELOG/MIGRATION 생성·갱신
> - [ ] dev/runs 스모크 페이로드 추가
> - [ ] 하위 호환성 점검(타입/라우팅/로그 경로)
> - [ ] 로그/결정 기록 일관성 확인

## Development Workflow

**MANDATORY: Follow DEVELOPMENT_STANDARDS.md for all code changes**

1. **Agent Design**: Reference implementation specs, define clear responsibilities
2. **Standards Compliance**: Import Logger, use TypeScript strict, add \_ prefix for unused vars
3. **Core Implementation**: Extend BaseAgent, implement required interface methods with proper types
4. **Integration**: Connect to communication bus, add performance monitoring, structured logging
5. **Testing**: Unit tests, integration tests, performance benchmarks (all must pass)
6. **Quality Gates**: `npm run typecheck && npm run lint && npm run test` must pass
7. **Documentation**: `npm run docs:refresh` after changes, update agent specs

**Auto-Enforcement**: Pre-commit hooks prevent standard violations. Zero new ESLint warnings allowed.

## Quality Assurance Process

- Continuous quality monitoring via Performance Guardian
- Daily automated quality checks on generated QA sets
- Weekly performance analysis and optimization recommendations
- Monthly agent effectiveness reviews and improvements

## Commands

- Install: `npm install`
- Build: `npm run build`
- Dev demo: `npm run dev`
- Test: `npm run test`

### Command Workflow

**4단계 워크플로우 (정밀 진단과 완전 수정)**:

모든 개발은 이 4단계를 순서대로:

```bash
1. /inspect            # 정밀 진단 (Single Source of Truth 생성)
   (= npm run status)  # TypeScript, ESLint, Tests, Security, Workarounds 등 전체 점검
                       # 출력: reports/inspection-results.json (5분 TTL)

2. /maintain           # 자동 수정 (캐시 기반, 승인 불필요)
   (= npm run maintain)# Prettier, ESLint --fix 자동 실행

3. /fix                # 대화형 수정 (캐시 기반, 승인 필요)
   (= npm run fix)     # TypeScript 오류, Workarounds, 문서화 누락 등 처리

4. /ship               # 배포 준비 + 실제 배포
   (bash script)       # Validation + Docs + Optimization + Commit + Push
```

**일상 개발 (3단계)**:

```bash
npm run status       # 1. 진단
npm run maintain     # 2. 자동 수정 (Prettier, ESLint)
npm run fix          # 3. 대화형 수정 (승인 필요)
git add -A && git commit -m "fix: 품질 개선"
```

**배포 전 (4단계)**:

```bash
npm run status       # 1. 진단
npm run maintain     # 2. 자동 수정
npm run fix          # 3. 대화형 수정
npm run ship         # 4. 통합 검증 + 문서 + 최적화
git push origin main
```

**각 명령어 역할**:

- `/status`: 시스템 진단 (건강도, 준수율, 워크어라운드)
- `/maintain`: 자동 수정 (Prettier, ESLint --fix, 설계 검증)
- `/fix`: 대화형 수정 (워크어라운드, 리팩토링, 문서화)
- `/ship`: 배포 준비 (통합 검증, 시스템 분석, 문서 동기화, 최적화)

상세 가이드: `@docs/COMMAND_GUIDE.md`

### TypeScript Development Guidelines

**CRITICAL**: All TypeScript code MUST follow these standards to prevent type safety regressions.

#### Quality Gates (Enforced by pre-commit hooks)

- `npm run typecheck` MUST pass (zero TypeScript errors)
- `npm run ci:quality` MUST pass before commits
- New files in `src/` MUST use `strict: true` settings

#### File-by-File Standards

- **src/** (Core Logic): `strict: true`, no `any` types, explicit return types required
- **scripts/** (Tools): Gradual improvement, `any` warnings allowed during transition
- **tests/** (Testing): Moderate strictness, mocking flexibility allowed

#### Developer Commands

```bash
npm run typecheck          # Check all TypeScript errors
npm run lint               # ESLint validation
npm run lint:fix           # Auto-fix linting issues
npm run ci:quality         # Full quality check
npm run ci:strict          # Pre-deployment validation
```

#### Reference Documents

- **Detailed Guidelines**: `@docs/TYPESCRIPT_GUIDELINES.md`
- **ESLint Config**: `.eslintrc.typescript.js`
- **Pre-commit Hook**: `.git/hooks/pre-commit` (auto-runs TypeScript checks)

### When to use Super Claude

- Use **Super Claude** when changes span multiple files/folders, add a new UI (Streamlit), or refactor orchestrator tests system-wide.
- Before switching, ensure `npm run build && npm run test` are green.
- Follow the official runbook: @file docs/super_claude_runbook.md

---

_This system prioritizes expert-level QA generation through sophisticated agent orchestration while maintaining full transparency and auditability of all decision processes._

### Documentation Refresh Policy

- After each feature, run `npm run docs:refresh` or POST `/api/docs/refresh` with header `x-docs-refresh-token: <token>`.
- RUN_LOGS/DECISIONS/EXPERIMENTS indexes are rebuilt automatically by the refresh step.
- CLAUDE.md/RFC/MIGRATION/CHANGELOG updates require explicit human approval; do not auto-edit without a request.
- Docs Staleness: `/api/docs/status` flags watched-path changes since last refresh; Docs page shows a banner + one-click refresh (token guarded).
