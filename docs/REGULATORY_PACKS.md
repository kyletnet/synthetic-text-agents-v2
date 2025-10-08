# Regulatory Compliance Packs

**Version**: 1.0
**Status**: Design Specification
**Target**: Phase 2.9 (Domain Packs)
**Purpose**: 의료/금융/법률 규정을 GCG 제약문법으로 구현

---

## Overview

이 문서는 산업별 규제 요구사항을 **GCG (Guideline → Constraint Grammar)**로 구현한 Compliance Packs를 정의합니다.

**지원 규제**:
1. **HIPAA** (Healthcare)
2. **SOX** (Finance)
3. **ISO 27001** (Security)

---

## 1. Healthcare Pack (HIPAA)

### 1.1 Overview

- **Domain**: `healthcare`
- **Compliance**: HIPAA (Health Insurance Portability and Accountability Act)
- **Purpose**: PHI (Protected Health Information) 보호 및 감사 추적

### 1.2 GCG Rules

```yaml
# src/offline/genius-lab/gcg/rules/hipaa.yml

version: "1.0.0"
domain: "healthcare"
compliance: "HIPAA"

rules:
  # PHI Masking (Protected Health Information)
  phi_masking:
    patterns:
      - "\\b\\d{3}-\\d{2}-\\d{4}\\b"          # SSN (123-45-6789)
      - "\\b[A-Z]{2}\\d{6}\\b"                # Medical Record Number
      - "\\b\\d{10}\\b"                       # Phone numbers
      - "\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b"  # Email
    action: "mask"
    mask_format: "[REDACTED]"

  # Data Retention
  data_retention:
    minimum_years: 7                          # HIPAA 요구: 최소 7년
    location_restrictions: ["US", "EU"]       # 지역 제한
    deletion_prohibited: true                 # 보존 기간 내 삭제 금지

  # Access Control
  access_control:
    type: "role-based"                        # RBAC
    required_roles: ["physician", "nurse", "admin"]
    audit_trail: true                         # 접근 로그 필수

  # Evidence Requirements
  evidence_requirements:
    min_sources: 2                            # 최소 2개 출처
    source_types:
      - "peer-reviewed"                       # 동료 심사 논문
      - "clinical-guideline"                  # 임상 가이드라인
      - "fda-approved"                        # FDA 승인 문서
    citation_format: "[Source: {title}, {date}, {doi}]"

  # Audit Trail
  audit_trail:
    mandatory: true
    immutable: true                           # 변경 불가
    storage: "append-only"                    # Append-only log
    fields:
      - "user_id"
      - "action"
      - "timestamp"
      - "resource_id"
      - "ip_address"

  # Consent Management
  consent:
    explicit_required: true                   # 명시적 동의 필수
    opt_out_allowed: false                    # Opt-out 불가
    documentation: "signature_required"       # 서명 필수

metadata:
  created_at: "2025-10-09"
  author: "compliance-team"
  reviewed_by: "legal-team"
  next_review: "2026-10-09"
```

---

### 1.3 Validation Examples

#### Pass Example
```
환자의 혈압은 120/80 mmHg입니다. [Source: Clinical Guidelines, 2024, doi:10.1234]
환자 ID: [REDACTED]
```

#### Fail Example
```
환자의 SSN은 123-45-6789입니다.  ❌ (PHI 노출)
출처: 인터넷 검색                    ❌ (부적절한 출처)
```

---

## 2. Finance Pack (SOX)

### 2.1 Overview

- **Domain**: `finance`
- **Compliance**: SOX (Sarbanes-Oxley Act)
- **Purpose**: 재무 데이터 정확성 및 변경 통제

### 2.2 GCG Rules

```yaml
# src/offline/genius-lab/gcg/rules/sox.yml

version: "1.0.0"
domain: "finance"
compliance: "SOX"

rules:
  # Financial Accuracy
  financial_accuracy:
    number_verification: "mandatory"          # 숫자 검증 필수
    unit_consistency: "enforced"              # 단위 일관성 강제
    rounding_rule: "two_decimal_places"       # 소수점 2자리
    currency_format: "USD, EUR, KRW"          # 허용 통화

  # Change Control
  change_control:
    approval_workflow: "required"             # 승인 워크플로 필수
    reviewer_count: 2                         # 최소 2명 검토
    separation_of_duties: true                # 직무 분리
    version_control: "mandatory"              # 버전 관리 필수

  # Audit Trail
  audit_trail:
    transaction_logging: "mandatory"          # 거래 로깅 필수
    retention_years: 7                        # 7년 보존
    tamper_proof: true                        # 변조 방지
    fields:
      - "transaction_id"
      - "user_id"
      - "amount"
      - "currency"
      - "timestamp"
      - "approver_id"

  # Evidence Requirements
  evidence_requirements:
    min_sources: 2                            # 최소 2개 출처
    document_versioning: "locked"             # 문서 버전 고정
    source_types:
      - "financial-statement"                 # 재무제표
      - "audit-report"                        # 감사 보고서
      - "regulatory-filing"                   # 규제 제출 문서

  # Internal Controls
  internal_controls:
    segregation_of_duties: true               # 직무 분리
    dual_authorization: true                  # 이중 승인
    reconciliation: "daily"                   # 일일 조정

metadata:
  created_at: "2025-10-09"
  reviewed_by: "audit-committee"
```

---

### 2.3 Validation Examples

#### Pass Example
```
Q1 매출: $1,234,567.89 USD [Source: Financial Statement Q1 2024, v1.2]
승인자: [Approver ID: 12345]
```

#### Fail Example
```
Q1 매출: 약 120만 달러  ❌ (부정확한 숫자)
출처: 구두 보고        ❌ (부적절한 출처)
```

---

## 3. Security Pack (ISO 27001)

### 3.1 Overview

- **Domain**: `security`
- **Compliance**: ISO 27001 (Information Security Management)
- **Purpose**: 정보 보안 관리

### 3.2 GCG Rules

```yaml
# src/offline/genius-lab/gcg/rules/iso27001.yml

version: "1.0.0"
domain: "security"
compliance: "ISO-27001"

rules:
  # Data Classification
  data_classification:
    levels: ["public", "internal", "confidential", "restricted"]
    labeling_required: true
    default_level: "internal"

  # Access Control
  access_control:
    authentication: "multi-factor"            # MFA 필수
    password_policy:
      min_length: 12
      complexity: "high"
      rotation_days: 90
    session_timeout: 15                       # 15분 타임아웃

  # Encryption
  encryption:
    at_rest: "AES-256"                        # 저장 시 암호화
    in_transit: "TLS-1.3"                     # 전송 시 암호화
    key_rotation: 30                          # 30일 키 교체

  # Audit Trail
  audit_trail:
    logging: "comprehensive"                  # 포괄적 로깅
    retention_years: 3                        # 3년 보존
    fields:
      - "event_type"
      - "user_id"
      - "resource"
      - "timestamp"
      - "result"

  # Incident Response
  incident_response:
    detection_time: "real-time"               # 실시간 탐지
    notification_time: "24h"                  # 24시간 내 통지
    documentation: "mandatory"                # 문서화 필수

metadata:
  created_at: "2025-10-09"
  certification_body: "ISO"
```

---

## 4. Policy Watchdog (Automated Monitoring)

### 4.1 Overview

**Purpose**: 규제 문서 변경 자동 감지 및 재검증

```typescript
// src/control/policy/watchdog.ts

import * as crypto from "crypto";
import * as fs from "fs";

interface PolicyDocument {
  path: string;
  hash: string;
  last_checked: Date;
  compliance: string;
}

class PolicyWatchdog {
  private documents: Map<string, PolicyDocument> = new Map();

  /**
   * 정책 문서 등록
   */
  register(path: string, compliance: string): void {
    const content = fs.readFileSync(path, "utf-8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");

    this.documents.set(path, {
      path,
      hash,
      last_checked: new Date(),
      compliance
    });
  }

  /**
   * 변경 감지
   */
  async checkForChanges(): Promise<PolicyDocument[]> {
    const changed: PolicyDocument[] = [];

    for (const [path, doc] of this.documents) {
      const content = fs.readFileSync(path, "utf-8");
      const currentHash = crypto.createHash("sha256").update(content).digest("hex");

      if (currentHash !== doc.hash) {
        changed.push(doc);
        // 해시 업데이트
        doc.hash = currentHash;
        doc.last_checked = new Date();
      }
    }

    return changed;
  }

  /**
   * 자동 재검증
   */
  async revalidate(doc: PolicyDocument): Promise<void> {
    console.log(`[Watchdog] Policy changed: ${doc.path}`);
    console.log(`[Watchdog] Compliance: ${doc.compliance}`);

    // GCG 재컴파일
    const compiler = new GCGCompiler();
    const grammar = compiler.compile(doc.path);
    compiler.save(grammar, `src/offline/genius-lab/gcg/rules/${doc.compliance}.yml`);

    // 알림 발송
    await this.notify(doc);
  }

  /**
   * 알림 발송 (Slack/Email)
   */
  private async notify(doc: PolicyDocument): Promise<void> {
    // Slack webhook 호출
    console.log(`[Watchdog] Notification sent for ${doc.path}`);
  }
}

export { PolicyWatchdog };
```

---

### 4.2 Usage

```typescript
// scripts/watch-policies.ts

import { PolicyWatchdog } from "../src/control/policy/watchdog";

const watchdog = new PolicyWatchdog();

// 정책 문서 등록
watchdog.register("docs/HIPAA_GUIDELINES.md", "HIPAA");
watchdog.register("docs/SOX_GUIDELINES.md", "SOX");
watchdog.register("docs/ISO27001_GUIDELINES.md", "ISO-27001");

// 주기적 체크 (매일 00:00)
setInterval(async () => {
  const changed = await watchdog.checkForChanges();

  for (const doc of changed) {
    await watchdog.revalidate(doc);
  }
}, 24 * 60 * 60 * 1000); // 24시간
```

---

## 5. Compliance Checker

### 5.1 Implementation

```typescript
// src/control/policy/compliance-checker.ts

import { GCGValidator } from "../../offline/genius-lab/gcg/validator";
import { Grammar } from "../../offline/genius-lab/gcg/compiler";

interface ComplianceResult {
  passed: boolean;
  compliance: string;
  violations: Violation[];
  score: number; // 0-100%
}

class ComplianceChecker {
  /**
   * 텍스트가 특정 규제를 준수하는지 검증
   */
  async check(text: string, compliance: string): Promise<ComplianceResult> {
    const grammarPath = `src/offline/genius-lab/gcg/rules/${compliance.toLowerCase()}.yml`;

    const compiler = new GCGCompiler();
    const grammar = compiler.load(grammarPath);

    const validator = new GCGValidator();
    const result = validator.validate(text, grammar);

    // 준수율 계산
    const totalRules = this.countRules(grammar);
    const violationCount = result.violations.length;
    const score = Math.max(0, (1 - violationCount / totalRules) * 100);

    return {
      passed: result.passed,
      compliance,
      violations: result.violations,
      score: Math.round(score)
    };
  }

  /**
   * 여러 규제 동시 검증
   */
  async checkMultiple(text: string, compliances: string[]): Promise<ComplianceResult[]> {
    const results: ComplianceResult[] = [];

    for (const compliance of compliances) {
      const result = await this.check(text, compliance);
      results.push(result);
    }

    return results;
  }

  private countRules(grammar: Grammar): number {
    return Object.keys(grammar.rules).length;
  }
}

export { ComplianceChecker, ComplianceResult };
```

---

### 5.2 Usage Example

```typescript
import { ComplianceChecker } from "./compliance-checker";

const checker = new ComplianceChecker();

const text = `
환자의 혈압은 120/80 mmHg입니다.
[Source: Clinical Guidelines 2024, doi:10.1234]
`;

// 단일 규제 검증
const hipaaResult = await checker.check(text, "HIPAA");
console.log(`HIPAA Compliance: ${hipaaResult.score}%`);

// 다중 규제 검증
const results = await checker.checkMultiple(text, ["HIPAA", "ISO-27001"]);
results.forEach(r => {
  console.log(`${r.compliance}: ${r.passed ? "PASS" : "FAIL"} (${r.score}%)`);
});
```

---

## 6. Integration with Runtime

### 6.1 L3 Planner Integration

```typescript
// src/runtime/l3-planner/apply-gcg.ts (확장)

class ApplyGCG {
  /**
   * Compliance-aware 생성
   */
  async applyWithCompliance(
    text: string,
    compliance: string[]
  ): Promise<string> {
    const checker = new ComplianceChecker();

    for (const comp of compliance) {
      const result = await checker.check(text, comp);

      if (!result.passed) {
        // 자동 수정 시도
        text = await this.autoCorrectForCompliance(text, result);
      }
    }

    return text;
  }

  private async autoCorrectForCompliance(
    text: string,
    result: ComplianceResult
  ): Promise<string> {
    let corrected = text;

    for (const violation of result.violations) {
      if (violation.rule === "phi_masking") {
        // PHI 자동 마스킹
        corrected = corrected.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED]");
      }

      if (violation.rule === "financial_accuracy.number_verification") {
        // 재무 숫자 검증 요청
        console.warn("Financial number needs verification");
      }
    }

    return corrected;
  }
}
```

---

## 7. Testing

### 7.1 Unit Tests

```typescript
// tests/control/policy/compliance-checker.test.ts

import { describe, it, expect } from "vitest";
import { ComplianceChecker } from "../../../src/control/policy/compliance-checker";

describe("ComplianceChecker", () => {
  const checker = new ComplianceChecker();

  it("should pass HIPAA compliance", async () => {
    const text = `
환자의 혈압은 120/80 mmHg입니다.
[Source: Clinical Guidelines 2024, doi:10.1234]
    `;

    const result = await checker.check(text, "HIPAA");
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(95);
  });

  it("should fail HIPAA compliance (PHI exposure)", async () => {
    const text = `
환자의 SSN은 123-45-6789입니다.
    `;

    const result = await checker.check(text, "HIPAA");
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].rule).toBe("phi_masking");
  });

  it("should check multiple compliances", async () => {
    const text = `
Q1 매출: $1,234,567.89 USD
[Source: Financial Statement Q1 2024, v1.2]
    `;

    const results = await checker.checkMultiple(text, ["SOX", "ISO-27001"]);
    expect(results).toHaveLength(2);
    expect(results[0].compliance).toBe("SOX");
    expect(results[1].compliance).toBe("ISO-27001");
  });
});
```

---

## 8. Deployment

### 8.1 Phase 2.9 Deliverables

```bash
src/offline/genius-lab/gcg/rules/
├── hipaa.yml         ✅
├── sox.yml           ✅
└── iso27001.yml      ✅

src/control/policy/
├── watchdog.ts       ✅
└── compliance-checker.ts ✅

tests/control/policy/
├── compliance-checker.test.ts ✅
└── watchdog.test.ts  ✅
```

### 8.2 Success Criteria

- [ ] HIPAA/SOX/ISO27001 GCG rules 구현
- [ ] Compliance score ≥95% on test dataset
- [ ] Policy Watchdog: 변경 감지 100%
- [ ] Tenant drift ≤2%
- [ ] Integration tests passing

---

## 9. Roadmap

| Phase | Deliverable | Timeline |
|-------|-------------|----------|
| 2.9 | HIPAA/SOX/ISO27001 packs | 3 weeks |
| 3.0 | GDPR/CCPA packs | 2 weeks |
| 3.1 | Industry-specific packs (pharma, banking) | 4 weeks |

---

## 10. References

- RFC 2025-16: v4 Hardening + Operator Registry
- `docs/GUIDELINES_TO_GCG.md`: GCG Compilation Guide
- `docs/ARCHITECTURE_MULTI_TENANT.md`: Multi-tenant Policy DSL

---

**Status**: ✅ Design Complete
**Next Step**: Phase 2.9 구현
**Last Updated**: 2025-10-09 00:35 KST
