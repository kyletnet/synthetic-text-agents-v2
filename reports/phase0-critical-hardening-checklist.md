# Phase 0: 치명적 보강 체크리스트

**목적**: Option A-Prime 실행 전 반드시 완료해야 하는 안전판 고정
**기간**: D-2 ~ D+0 (MBC 착수 전 선행 완료)
**우선순위**: P0 - CRITICAL (이것 없이 공개 불가)

**작성일**: 2025-10-08
**브랜치**: phase2c-launch → phase0-hardening → mbc-launch

---

## 🎯 Phase 0의 의미

**기존 문제**:
- MBC 로드맵이 "당장 공개"에 초점
- 근본적 안전성과 완전성 미흡
- Secret 유출, 라이선스 미정의, 보안 헤더 부재

**Phase 0 목표**:
- **치명적 보강 7축** 완전 잠금
- **15 Gates 확장** (운영 거버넌스 강화)
- **멀티 에이전트 경계** 정의 (Phase 4 대비)
- **레드팀 리허설** (실전 훈련)

**완료 후**:
→ MBC 로드맵 근본적 재설계 가능
→ 안전하고 완전한 방식으로 공개 준비

---

## 📋 #1: Secret/경로 유출 제로화 (P0)

### 1.1 Secret Lint 강화

**목표**: 프론트 번들, 공개 폴더에 키/엔드포인트/프롬프트 포함 금지

**체크리스트**:
- [ ] `.env` 파일 전수 점검 (API 키 전부 확인)
- [ ] `PUBLIC_` 접두사 변수 점검 (의도치 않은 노출)
- [ ] Sourcemap 제거 설정 (`productionBrowserSourceMaps: false`)
- [ ] Build output 검증 스크립트 작성
- [ ] Secret patterns 정의 (ANTHROPIC_API_KEY, sk-, api_key, secret)

**구현**:
```typescript
// scripts/secret-lint.ts

const SECRET_PATTERNS = [
  /ANTHROPIC_API_KEY/,
  /OPENAI_API_KEY/,
  /sk-[a-zA-Z0-9]{32,}/,
  /api_key\s*[:=]\s*['"][^'"]+['"]/,
  /secret\s*[:=]\s*['"][^'"]+['"]/,
  /Bearer\s+[a-zA-Z0-9_\-\.]+/,
  /https?:\/\/[^\/\s]+\/internal/,
];

const PUBLIC_DIRS = [
  'demo-ui/public',
  'demo-ui/.next',
  'open-template',
  'docs',
];
```

**검증**:
```bash
npm run secret:lint
# Exit 0 if clean, Exit 1 if violations found
```

---

### 1.2 .gitattributes Export-Ignore

**목표**: 내부 폴더를 공개 리포에서 제외

**체크리스트**:
- [ ] `.gitattributes` 파일 생성
- [ ] Export-ignore 규칙 정의
- [ ] GitHub Release 테스트 (excluded 파일 확인)

**구현**:
```gitattributes
# .gitattributes

# Internal folders (NOT in public releases)
src/core/orchestrator.ts export-ignore
src/core/governance/kernel.ts export-ignore
src/core/governance/bootloader.ts export-ignore
src/feedback/ export-ignore
src/infrastructure/governance/policy-interpreter.ts export-ignore
governance-rules.yaml export-ignore
feature-flags.json export-ignore
.env export-ignore
.env.* export-ignore
reports/ export-ignore
scripts/internal/ export-ignore

# Build artifacts
dist/ export-ignore
build/ export-ignore
.next/ export-ignore
node_modules/ export-ignore
```

---

### 1.3 SSR 결과만 렌더 (프론트 번들 보호)

**목표**: WebView는 SSR 결과만, 내부 API 호출 금지

**체크리스트**:
- [ ] Demo UI는 `getServerSideProps` 사용 (CSR 금지)
- [ ] Mock 데이터 파일 생성 (`public/mock-results.json`)
- [ ] 런타임 API 호출 제거 (fetch, axios 등)
- [ ] Bundle analyzer로 검증 (no internal imports)

**구현**:
```typescript
// demo-ui/pages/index.tsx

export async function getServerSideProps() {
  // Server-side only (no client-side API calls)
  const mockResults = await fs.readFile(
    path.join(process.cwd(), 'public/mock-results.json'),
    'utf8'
  );

  return {
    props: {
      results: JSON.parse(mockResults),
    },
  };
}
```

---

## 📋 #2: 라이선스/오픈 경계 확정 (P0)

### 2.1 듀얼 라이선스 전략

**목표**: 공개/비공개 영역 명확히 구분

**라이선스 정의**:

| 영역 | 라이선스 | 파일 위치 | 이유 |
|------|---------|----------|------|
| **Open-Core** | Apache-2.0 | open-template/, demo-ui/, docs/ | 신뢰 확보, 커뮤니티 기여 |
| **Proprietary** | Source-available (BSL 1.1) | src/core/, src/feedback/, src/infrastructure/governance/ | IP 보호, 상업적 사용 제한 |

**Business Source License (BSL) 1.1 조건**:
- 소스 공개 (읽기 가능)
- 프로덕션 사용 제한 (SaaS 제외)
- 2년 후 Apache-2.0 전환 (시간 제한)

**체크리스트**:
- [ ] `LICENSE` 파일 작성 (듀얼 라이선스 명시)
- [ ] `LICENSE-APACHE` 파일 추가
- [ ] `LICENSE-BSL` 파일 추가
- [ ] `NOTICE` 파일 작성 (저작권 고지)
- [ ] `THIRD_PARTY` 파일 생성 (의존성 라이선스)
- [ ] 모든 소스 파일에 SPDX 헤더 추가

---

### 2.2 SPDX 헤더 자동 추가

**목표**: 모든 .ts 파일에 라이선스 헤더

**구현**:
```typescript
// scripts/add-spdx-headers.ts

const SPDX_HEADER_APACHE = `/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 [Your Company]
 */
`;

const SPDX_HEADER_BSL = `/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Licensed under the Business Source License 1.1 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://mariadb.com/bsl11/
 *
 * Change Date: 2027-10-08 (2 years from first release)
 * Change License: Apache-2.0
 */
`;
```

**검증**:
```bash
npm run license:check
# Verify all .ts files have SPDX headers
```

---

## 📋 #3: 공급망/빌드 무결성 (P0)

### 3.1 Lockfile 고정 + Audit

**목표**: 의존성 취약점 0건

**체크리스트**:
- [ ] `package-lock.json` 커밋 (버전 고정)
- [ ] `npm audit --production` 실행 (high/critical 0건)
- [ ] `npm ls` 검증 (중복 패키지 확인)
- [ ] Renovate/Dependabot 설정 (자동 업데이트)

**검증**:
```bash
npm audit --production
# Expected: 0 vulnerabilities
```

---

### 3.2 SBOM 생성 (CycloneDX)

**목표**: Software Bill of Materials 자동 생성

**구현**:
```bash
npm install -g @cyclonedx/cyclonedx-npm
cyclonedx-npm --output-file sbom.json
```

**체크리스트**:
- [ ] SBOM 생성 스크립트 추가
- [ ] `sbom.json` 리포지토리 첨부
- [ ] 고위험 의존성 검토 (manual review)

---

### 3.3 GitHub 보안 설정

**목표**: Branch protection + 2FA + 필수 상태 체크

**체크리스트**:
- [ ] Main branch protection 활성화
- [ ] 필수 상태 체크: `/guard --strict` PASS
- [ ] Require 2FA for all contributors
- [ ] Code scanning (CodeQL) 활성화
- [ ] Dependabot alerts 활성화

---

## 📋 #4: 입력/PII/저작권 (P1)

### 4.1 PII 탐지 룰셋

**목표**: 이메일, 주민번호, 신용카드 탐지 및 거부

**구현**:
```typescript
// src/infrastructure/governance/pii-detector.ts

const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  ssn: /\d{3}-\d{2}-\d{4}/,  // US SSN
  krn: /\d{6}-[1-4]\d{6}/,   // KR 주민번호
  credit_card: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/,
  phone: /\d{3}-\d{3,4}-\d{4}/,
};

export function detectPII(text: string): PII[] {
  // Return detected PII with type and position
}
```

**체크리스트**:
- [ ] PII Detector 구현
- [ ] Policy Interpreter 통합 (parseOnly → PII check)
- [ ] 탐지 시 거부 + 로그 (no storage)

---

### 4.2 저작권 키워드 탐지

**목표**: 저작권 침해 소지 있는 텍스트 탐지

**구현**:
```typescript
const COPYRIGHT_KEYWORDS = [
  'all rights reserved',
  '© copyright',
  'proprietary and confidential',
  'do not distribute',
];
```

---

### 4.3 원문 즉시 폐기

**목표**: 처리 후 원문 삭제, 요약/정책만 보존

**체크리스트**:
- [ ] 처리 완료 후 원문 필드 null 처리
- [ ] 로그에는 hash만 저장 (no raw text)
- [ ] 보존기간 명시 (GDPR 준수)

---

## 📋 #5: 웹 보안 헤더 & Rate-Limit (P1)

### 5.1 CSP (Content Security Policy)

**목표**: XSS, injection 방지

**구현**:
```typescript
// demo-ui/next.config.js

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];
```

**체크리스트**:
- [ ] CSP 헤더 설정
- [ ] 외부 스크립트 0개 (no CDN, no analytics in demo)
- [ ] Security headers 테스트 (securityheaders.com)

---

### 5.2 Rate Limiting

**목표**: API/업로드 요청 제한

**구현**:
```typescript
// src/infrastructure/rate-limiter.ts

const RATE_LIMITS = {
  feedback: {
    points: 10,         // 10 requests
    duration: 60,       // per 60 seconds
    blockDuration: 300, // block for 5 minutes
  },
  upload: {
    points: 5,
    duration: 300,      // 5 uploads per 5 minutes
    maxSize: 10 * 1024 * 1024, // 10MB
  },
};
```

**체크리스트**:
- [ ] Rate limiter 구현 (redis-based or in-memory)
- [ ] IP allowlist 옵션
- [ ] CORS 제한 (specific origins only)
- [ ] reCAPTCHA v3 옵션 (선택적)

---

## 📋 #6: 성능/비용 가드 (P1)

### 6.1 Budget Guardian 상한 설정

**목표**: 데모/프리뷰 비용 초과 시 auto-disable

**구현**:
```typescript
// src/application/budget-guardian.ts

const BUDGET_LIMITS = {
  demo: {
    costPerMin: 0.10,      // $0.10/min max
    dailyLimit: 10.00,     // $10/day max
    autoDisable: true,     // Auto-disable on exceed
  },
  preview: {
    costPerMin: 0.50,      // $0.50/min max
    dailyLimit: 50.00,     // $50/day max
    alertOnly: true,       // Alert but don't disable
  },
};
```

**체크리스트**:
- [ ] Budget tracking per environment
- [ ] Auto-disable trigger (feature flag OFF)
- [ ] Alert to Slack/email on 80% budget

---

### 6.2 Loop Scheduler 장시간 상승 경보

**목표**: Queue 과부하 조기 탐지

**구현**:
```typescript
// src/core/governance/loop-scheduler.ts

// Alert if queue >80% for >5 minutes
if (queueUtilization > 0.8 && duration > 5 * 60 * 1000) {
  await alertSlack({
    type: 'queue_overload',
    utilization: queueUtilization,
    duration: duration,
  });
}
```

---

## 📋 #7: 운영 거버넌스 - 15 Gates 확장

### 7.1 추가 Gates (L/M/N/O)

**기존 11 Gates**:
- A-K (Technical 7 + Operational 4)

**추가 4 Gates**:

| Gate | 이름 | 기준 | 측정 방법 |
|------|------|------|----------|
| **L** | License | SPDX/듀얼 라이선스 검사 통과 | `npm run license:check` |
| **M** | Secret | Secret Lint + 번들 검사 0건 | `npm run secret:lint` |
| **N** | SBOM | SBOM 생성 + 고위험 dep 0 | `npm run sbom:check` |
| **O** | CSP | 보안 헤더 셋 통과 | `npm run security:headers` |

---

### 7.2 mbc:gonogo 스크립트 확장

**구현**:
```typescript
// scripts/mbc-gonogo-check.ts (확장)

async function gateL(): Promise<GateResult> {
  // License check
  const result = runCommand('npm run license:check');
  return {
    gate: 'L',
    name: 'License',
    passed: result.success,
    message: result.success ? 'All files have SPDX headers' : 'Missing SPDX headers',
    metric: result.success ? 'PASS' : 'FAIL',
    threshold: 'PASS',
  };
}

async function gateM(): Promise<GateResult> {
  // Secret check
  const result = runCommand('npm run secret:lint');
  return {
    gate: 'M',
    name: 'Secret',
    passed: result.success,
    message: result.success ? 'No secrets found' : 'Secrets detected',
    metric: result.success ? '0' : '>0',
    threshold: '0',
  };
}

// ... gateN, gateO
```

---

## 📋 #8: 레드팀 3시나리오 (P1)

### 8.1 시나리오 1: 정책 폭주

**목표**: 50개 정책 동시 투입 → Queue/Throttle 동작 확인

**실행**:
```bash
npm run redteam:policy-flood
# Generate 50 policy events in 10 seconds
# Verify: Queue max 20, dropPolicy "oldest", no drift flood
```

**검증 기준**:
- [ ] Queue 최대 20개 유지
- [ ] Oldest drop 정상 동작
- [ ] Drift 알림 flood 없음 (rolling avg 적용)
- [ ] Latency p95 < 5s (under load)

---

### 8.2 시나리오 2: 업로드 악성 케이스

**목표**: 큰 파일/외부 링크/스크립트 포함 → 거부 확인

**실행**:
```bash
npm run redteam:malicious-upload
# Test cases:
# - 100MB file (> 10MB limit)
# - External link (http://evil.com)
# - <script>alert('xss')</script>
```

**검증 기준**:
- [ ] 큰 파일 거부 (413 Payload Too Large)
- [ ] 외부 링크 제거 (sanitize)
- [ ] Script injection 차단 (CSP)
- [ ] 모든 거부 로그 기록

---

### 8.3 시나리오 3: Canary 롤백

**목표**: Gate C FAIL 유도 → 자동 롤백 동작 확인

**실행**:
```bash
npm run redteam:canary-rollback
# Artificially fail Gate C
# Verify: Feature flag OFF + rollback to baseline
```

**검증 기준**:
- [ ] Gate C FAIL 감지
- [ ] Feature flag 자동 OFF
- [ ] Baseline 버전으로 rollback
- [ ] Rollback 소요 시간 < 5분

---

### 8.4 Drill 리포트 생성

**출력**:
```json
// reports/phase0-prelaunch-drill.json

{
  "timestamp": "2025-10-08T12:00:00Z",
  "scenarios": [
    {
      "name": "policy-flood",
      "passed": true,
      "metrics": {
        "queueMax": 20,
        "dropCount": 30,
        "latencyP95": 4.2
      }
    },
    {
      "name": "malicious-upload",
      "passed": true,
      "blocked": 3,
      "sanitized": 1
    },
    {
      "name": "canary-rollback",
      "passed": true,
      "rollbackTime": 3.5
    }
  ],
  "overallResult": "PASS"
}
```

---

## 📋 #9: 텔레메트리 & 알림 (P1)

### 9.1 SLO & 경보 임계치 (데모 기준)

| SLO | 목표 | 경보 임계치 |
|-----|------|-----------|
| **Latency p95** | ≤3.1s | >3.5s |
| **Error Rate** | <1% | >2% |
| **Cost/1k QA** | ≤$0.10 | >$0.15 |
| **Drift Δ** | ≤5% | >8% |
| **Queue Utilization** | <80% | >90% |

---

### 9.2 알림 채널 설정

**Slack Webhook**:
```typescript
// src/infrastructure/alerting/slack-notifier.ts

export async function alertSlack(event: AlertEvent) {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: `🚨 ${event.type}: ${event.message}`,
      attachments: [
        {
          color: event.severity === 'critical' ? 'danger' : 'warning',
          fields: [
            { title: 'Metric', value: event.metric, short: true },
            { title: 'Threshold', value: event.threshold, short: true },
          ],
        },
      ],
    }),
  });
}
```

**경보 이벤트**:
- Gate FAIL
- Drift 급증 (>8%)
- Queue >90%
- Cost spike (>$0.15/1k)
- Error rate >2%

---

### 9.3 Post-Launch 24h 점검 플랜

**점검 시점**: 2h, 6h, 12h, 24h

**체크 항목**:
- [ ] Error rate (Sentry)
- [ ] Latency p95 (Baseline report)
- [ ] Cost tracking (Budget Guardian)
- [ ] User feedback (GitHub issues)
- [ ] Queue status (Loop Scheduler)

**출력**:
```json
// reports/post-launch-24h.json

{
  "checkpoints": [
    { "hour": 2, "errorRate": 0.3, "latency": 2.8, "cost": 0.08 },
    { "hour": 6, "errorRate": 0.5, "latency": 3.0, "cost": 0.09 },
    { "hour": 12, "errorRate": 0.4, "latency": 2.9, "cost": 0.09 },
    { "hour": 24, "errorRate": 0.6, "latency": 3.1, "cost": 0.10 }
  ],
  "status": "STABLE"
}
```

---

### 9.4 7-Day 트렌드 분석

**목표**: 다음 튜닝 항목 도출

**분석 항목**:
- 성능 트렌드 (latency, throughput)
- 비용 트렌드 (cost per 1k QA)
- 인입 피드백 분류 (intent distribution)
- Error 패턴 (top 5 errors)

**출력**: `reports/7day-trend-analysis.md`

---

## 📋 #10: 멀티 에이전트 경계 정의 (Phase 4 대비)

### 10.1 Domain Agent Boundary

**목표**: 외부 Agent가 접근 가능한 도메인 모델 명세

**구현**:
```typescript
// src/domain/interfaces/agent-contracts.ts

/**
 * Agent Contract - External agents must conform to this interface
 */
export interface AgentContract {
  name: string;
  version: string;
  capabilities: string[];

  execute(
    input: AgentInput
  ): Promise<AgentOutput>;

  validate(
    input: AgentInput
  ): ValidationResult;
}

export interface AgentInput {
  query: string;
  context: Record<string, unknown>;
  constraints: Constraint[];
}

export interface AgentOutput {
  result: unknown;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface Constraint {
  type: 'timeout' | 'memory' | 'cost';
  value: number;
}
```

**체크리스트**:
- [ ] `agent-contracts.ts` 생성
- [ ] Zod schema 정의 (validation)
- [ ] TypeScript strict mode 적용

---

### 10.2 Security Boundary

**목표**: 외부 Agent 코드 실행 권한 제한

**구현**:
```typescript
// src/infrastructure/governance/safe-imports.ts

/**
 * Whitelist for external agent imports
 */
export const SAFE_IMPORTS = [
  'lodash',
  'ramda',
  'date-fns',
  // NO: fs, child_process, net, http, https
];

export function validateImports(code: string): ValidationResult {
  const imports = extractImports(code);
  const unsafe = imports.filter(i => !SAFE_IMPORTS.includes(i));

  return {
    valid: unsafe.length === 0,
    violations: unsafe,
  };
}
```

**체크리스트**:
- [ ] `safe-imports.ts` 생성
- [ ] Sandbox Runner 통합
- [ ] Import validation 테스트

---

### 10.3 Communication Boundary

**목표**: 내부 Bus vs External Bus 분리

**구현**:
```
src/multi-agent-bus/
├── internal/              # 비공개 (내부 Agent 전용)
│   ├── orchestrator.ts
│   ├── coordinator.ts
│   └── scheduler.ts
└── external/              # 공개 (외부 Agent 접근)
    ├── api-wrapper.ts     # Public API
    ├── message-router.ts  # External → Internal 변환
    └── auth-middleware.ts # 인증/인가
```

**체크리스트**:
- [ ] `external/api-wrapper.ts` 생성
- [ ] `message-router.ts` (변환 레이어)
- [ ] Auth middleware (JWT or API key)

---

## 📋 #11: WebView 공개 전 최종 스냅샷 (P1)

### 11.1 데모 데이터 스냅샷만 사용

**목표**: 실시간 API 호출 금지

**체크리스트**:
- [ ] `public/mock-results.json` 생성 (10개 샘플)
- [ ] SSR getServerSideProps에서만 로드
- [ ] 런타임 API 호출 제거 확인

**Mock 데이터 구조**:
```json
{
  "results": [
    {
      "id": "qa-001",
      "question": "Sample question?",
      "answer": "Sample answer.",
      "quality": 8.5,
      "alignment": 0.92,
      "timestamp": "2025-10-08T12:00:00Z"
    }
  ]
}
```

---

### 11.2 Run-of-Show (3분 스크립트)

**시나리오**:
1. 업로드 문서 (mock file)
2. parseOnly 경고 표시 (PII detected)
3. 검증 결과 SSR 노출
4. "SaaS에서 full loop" CTA

**체크리스트**:
- [ ] 3분 시연 스크립트 작성
- [ ] 녹화 영상 준비 (optional)
- [ ] CTA 링크 설정 (contact form)

---

### 11.3 공개 전 최종 검증

**실행**:
```bash
# 1. Guard strict
npm run guard -- --strict

# 2. Baseline generation
npm run baseline:generate -- --tag "mbc-launch"

# 3. 15 Gates
npm run mbc:gonogo

# 4. Red-team drill
npm run redteam:all
```

**체크리스트**:
- [ ] All commands PASS
- [ ] 증거 보관 (`reports/phase0-completion.json`)

---

## 📋 #12: 예상 이슈 → 즉응책 (Ready-to-Use)

### 즉응 매뉴얼

| 이슈 | 징후 | 즉시 대응 | 책임자 |
|------|------|----------|--------|
| **키/내부경로 번들 유출** | Secret Gate FAIL | 즉시 배포 차단, sourcemap 제거 후 재빌드 | DevOps |
| **Queue 폭주** | p95↑ + Queue>80% | dropPolicy 유지, Canary 10% 하향 | Backend |
| **Drift 알림 홍수** | 알림/분>3 | rollingAvg(3) 상향, threshold +2-3% | SRE |
| **비용 급증** | cost/min 초과 | Budget Guardian auto-disable, 샘플률 축소 | FinOps |
| **피드백 과적응** | 품질 요동 | Cooldown 60s 유지, Approval-only 모드 | Product |
| **로그 폭증** | Log>1GB | Rotation 30min → 15min | SRE |

---

## 📋 #13: 오늘의 실행 순서 (인터럽트 없이)

### D-2 ~ D+0 실행 플랜

**Day D-2 (오늘)**:
1. [ ] Phase 0 체크리스트 검토 및 승인
2. [ ] Secret Lint 스크립트 작성
3. [ ] License 파일 생성 (LICENSE, NOTICE, THIRD_PARTY)
4. [ ] .gitattributes 설정
5. [ ] SPDX 헤더 추가 스크립트 실행

**Day D-1**:
1. [ ] 15 Gates 확장 (L/M/N/O)
2. [ ] mbc:gonogo 스크립트 확장
3. [ ] 멀티 에이전트 경계 정의 (3개 파일)
4. [ ] CSP/Security headers 설정
5. [ ] Rate limiter 구현

**Day D+0**:
1. [ ] 레드팀 3시나리오 수행
2. [ ] Drill 리포트 생성
3. [ ] 15 Gates 실행 (`npm run mbc:gonogo`)
4. [ ] /guard --strict 검증
5. [ ] baseline:generate --tag "phase0-complete"
6. [ ] 증거 보관 및 커밋

---

## ✅ 완료 기준 (Phase 0 → MBC 전환)

**모든 항목 PASS 시 MBC 착수 가능**:

- [ ] Secret Lint: 0 violations
- [ ] License: All files have SPDX headers
- [ ] SBOM: Generated, high-risk deps 0
- [ ] CSP: Security headers all set
- [ ] PII: Detector implemented and tested
- [ ] Rate Limit: Configured and tested
- [ ] 15 Gates: ALL PASS
- [ ] Red-team: 3 scenarios PASS
- [ ] Multi-agent boundaries: 3 files defined
- [ ] Drill report: Generated

**증거 파일**:
- `reports/phase0-completion.json`
- `reports/phase0-prelaunch-drill.json`
- `sbom.json`
- `LICENSE`, `NOTICE`, `THIRD_PARTY`

---

## 💡 최종 권고

**Phase 0의 의미**:
- MBC 착수 전 **반드시** 완료해야 하는 안전판
- 치명적 보강 없이 공개 시 **심각한 리스크**
- 2-3일 투자로 **완전한 안전성** 확보

**다음 단계**:
1. Phase 0 완료 (D-2 ~ D+0)
2. MBC 로드맵 근본적 재설계 (D+1)
3. MBC 실행 (D+2 ~ D+14)
4. Open-Core 공개 (D+15~)

---

**작성자**: Claude Code (Phase 0 Critical Hardening)
**승인 대기**: Kay (Technical Lead)
**상태**: READY TO EXECUTE (오늘부터 착수)
