# Multi-Tenant Governance Architecture

**Version**: 1.0
**Status**: Design Specification
**Target**: Phase 2.0
**Approach**: Evolutionary Addition (NOT Rewrite)

---

## Overview

This document specifies the multi-tenant governance architecture to support multiple clients/domains/use-cases simultaneously while maintaining:
- **Separation**: Complete data/policy/cost/performance isolation
- **Supervision**: Centralized governance/monitoring/control
- **Scalability**: Linear scaling per tenant without cross-contamination

---

## 1. Control Plane / Data Plane Architecture

### Control Plane (Central Governance)

**Purpose**: Manage all policies, governance, configuration, model routing, monitoring, and cost.

**Components**:

```
┌─────────────────────────────────────────────────────────┐
│                   CONTROL PLANE                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │   Tenant     │  │ Policy Service│  │Feature Flag  │ │
│  │   Registry   │  │(Namespaced DSL│  │   Service    │ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
│                                                           │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │Model Router  │  │ KMS per Tenant│  │Cost/Quota    │ │
│  │              │  │               │  │  Service     │ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
│                                                           │
│  ┌──────────────┐  ┌───────────────┐                    │
│  │Observability │  │Policy Watchdog│                    │
│  │     Hub      │  │               │                    │
│  └──────────────┘  └───────────────┘                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
                         ↓ manages
┌─────────────────────────────────────────────────────────┐
│                    DATA PLANE (Per-Tenant)               │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Tenant A          Tenant B          Tenant C            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ RAG Pipeline│  │ RAG Pipeline│  │ RAG Pipeline│     │
│  │ QA Engine   │  │ QA Engine   │  │ QA Engine   │     │
│  │ Eval Loop   │  │ Eval Loop   │  │ Eval Loop   │     │
│  │ Feedback    │  │ Feedback    │  │ Feedback    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Corpus/VDB  │  │ Corpus/VDB  │  │ Corpus/VDB  │     │
│  │ Logs/Cache  │  │ Logs/Cache  │  │ Logs/Cache  │     │
│  │ Budget/CB   │  │ Budget/CB   │  │ Budget/CB   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Data Plane (Tenant-Specific Execution)

**Purpose**: Execute RAG/QA/evaluation/feedback pipelines with complete isolation.

**Isolation Guarantees**:
- Separate storage buckets/namespaces
- Dedicated queues/workers
- Isolated caches
- Independent budgets/circuit breakers

---

## 2. Core Components (Bottom-Up)

### 2.1 Tenant-Aware Policy DSL

**Schema**:
```typescript
interface TenantPolicy {
  tenant_id: string;
  domain_id: string;
  usecase_id: string;
  policy_semver: string; // e.g., "1.2.3"
  origin_signature: string; // Cryptographic signature
  rules: PolicyRule[];
  metadata: {
    created_at: Date;
    updated_at: Date;
    author: string;
    approval_status: "pending" | "approved" | "rejected";
  };
}
```

**File Structure** (GitOps):
```
tenants/
├── default/
│   ├── policies/
│   │   ├── retrieval.yaml
│   │   ├── evaluation.yaml
│   │   └── governance.yaml
│   ├── router.yaml
│   └── features.yaml
├── acme-corp/
│   ├── policies/
│   │   ├── retrieval.yaml (HIPAA-compliant)
│   │   ├── evaluation.yaml
│   │   └── governance.yaml
│   ├── router.yaml
│   └── features.yaml
└── beta-inc/
    ├── policies/
    │   ├── retrieval.yaml (SOX-compliant)
    │   ├── evaluation.yaml
    │   └── governance.yaml
    ├── router.yaml
    └── features.yaml
```

**Anti-Corruption Layer (ACL)** Enhancement:
```typescript
// 4-stage pipeline (existing + tenant-aware)
async function commitPolicy(policy: TenantPolicy): Promise<void> {
  // Stage 1: Parse only (no execution)
  const parsed = await parseOnly(policy);

  // Stage 2: Validate (schema + signature + tenant allowlist)
  const validated = await validate(parsed, {
    tenant_id: policy.tenant_id,
    allowlist: getTenantAllowlist(policy.tenant_id),
    signature: policy.origin_signature,
  });

  // Stage 3: Sandbox (isolated execution)
  const sandboxed = await runInSandbox(validated);

  // Stage 4: Commit (only if all pass)
  if (sandboxed.passed) {
    await commitToTenantRepo(policy.tenant_id, sandboxed.result);
  }
}
```

---

### 2.2 Tenant Registry

**Schema**:
```typescript
interface Tenant {
  id: string; // UUID
  name: string;
  status: "active" | "suspended" | "archived";
  plan: "free" | "pro" | "enterprise";
  created_at: Date;
  updated_at: Date;

  // Configuration
  config: {
    region: string; // "us-east-1", "eu-west-1", etc.
    retention_days: number; // Data retention period
    encryption: "standard" | "enhanced";
  };

  // Quotas
  quotas: {
    max_requests_per_hour: number;
    max_concurrent_requests: number;
    max_cost_per_month: number; // USD
    max_storage_gb: number;
  };

  // Metadata
  metadata: {
    industry: string; // "healthcare", "finance", etc.
    compliance: string[]; // ["HIPAA", "SOX", "GDPR"]
    contact_email: string;
  };
}
```

**API**:
```typescript
class TenantRegistry {
  async createTenant(tenant: Tenant): Promise<Tenant>;
  async getTenant(id: string): Promise<Tenant | null>;
  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant>;
  async listTenants(filters?: TenantFilters): Promise<Tenant[]>;
  async suspendTenant(id: string, reason: string): Promise<void>;
  async deleteTenant(id: string): Promise<void>; // Soft delete
}
```

---

### 2.3 Multi-Tenant Retrieval Fabric

**Isolation Strategy**:

```typescript
// Corpus storage per tenant
interface RetrievalStorage {
  tenant_id: string;
  corpus_bucket: string; // e.g., "s3://tenant-acme/corpus/"
  index_namespace: string; // e.g., "qdrant::tenant-acme"
  cache_prefix: string; // e.g., "redis:tenant-acme:"
}

// Trust/Poisoning Guard per tenant
interface TenantSecurityPolicy {
  tenant_id: string;
  allowlist: Set<string>; // Allowed domains
  forbidden_patterns: RegExp[]; // Forbidden content
  signature_required: boolean;
  min_trust_score: number; // Threshold
}
```

**Implementation**:
```typescript
class TenantRetrievalFabric {
  private tenantStorages = new Map<string, RetrievalStorage>();
  private tenantPolicies = new Map<string, TenantSecurityPolicy>();

  async retrieve(
    tenantId: string,
    query: string,
    options: RetrievalOptions
  ): Promise<RetrievalResult> {
    // 1. Get tenant-specific storage
    const storage = this.tenantStorages.get(tenantId);
    if (!storage) throw new Error(`Tenant ${tenantId} not found`);

    // 2. Get tenant-specific security policy
    const policy = this.tenantPolicies.get(tenantId);

    // 3. Retrieve from tenant-scoped corpus
    const results = await this.retrieveFromCorpus(storage, query, options);

    // 4. Apply tenant-specific trust/poison filters
    const filtered = await this.applySecurityPolicy(results, policy);

    // 5. Tag with tenant metadata
    return {
      ...filtered,
      tenant_id: tenantId,
      storage_bucket: storage.corpus_bucket,
    };
  }
}
```

---

### 2.4 Tenant-Scoped Model Router

**Configuration** (`tenants/<tenant>/router.yaml`):
```yaml
tenant_id: acme-corp
routing:
  primary:
    provider: anthropic
    model: claude-3-5-sonnet-20241022
    temperature: 0.7
    max_tokens: 4096
  fallback:
    provider: openai
    model: gpt-4-turbo
    temperature: 0.7
    max_tokens: 4096

sla:
  p95_latency_ms: 3100
  error_rate_max: 0.01
  cost_per_1k_qa_usd: 0.10

budget:
  monthly_limit_usd: 10000
  daily_limit_usd: 500
  circuit_breaker:
    threshold: 0.8  # 80% of budget
    action: downgrade_to_fallback
```

**Implementation**:
```typescript
class TenantModelRouter {
  async route(
    tenantId: string,
    request: ModelRequest
  ): Promise<ModelResponse> {
    // 1. Load tenant routing config
    const config = await this.loadTenantConfig(tenantId);

    // 2. Check budget
    const budget = await this.checkBudget(tenantId);
    if (budget.exceeded) {
      throw new BudgetExceededError(tenantId);
    }

    // 3. Select model based on SLA/cost
    const model = this.selectModel(config, budget, request);

    // 4. Execute with circuit breaker
    try {
      const response = await this.executeWithCircuitBreaker(
        tenantId,
        model,
        request
      );

      // 5. Track cost/performance
      await this.trackUsage(tenantId, response);

      return response;
    } catch (error) {
      // 6. Fallback on error
      return this.executeFallback(tenantId, config.fallback, request);
    }
  }
}
```

---

### 2.5 RBAC/ABAC + Data Sovereignty

**Roles**:
```typescript
enum TenantRole {
  OWNER = "owner",           // Full control
  ADMIN = "admin",           // Manage users/policies
  OPERATOR = "operator",     // Run pipelines
  AUDITOR = "auditor",       // Read-only access
  VIEWER = "viewer",         // Dashboard only
}

interface TenantUser {
  user_id: string;
  tenant_id: string;
  role: TenantRole;
  permissions: string[]; // Fine-grained permissions
  attributes: Record<string, any>; // ABAC attributes
}
```

**Data Sovereignty** (`tenants/<tenant>/data-sovereignty.yaml`):
```yaml
tenant_id: acme-corp
data_sovereignty:
  region: us-east-1
  allowed_regions:
    - us-east-1
    - us-west-2
  forbidden_regions:
    - cn-*
    - ru-*

  retention:
    logs_days: 90
    data_days: 365
    backups_days: 2555  # 7 years

  encryption:
    at_rest: AES-256
    in_transit: TLS-1.3
    kms_key_id: arn:aws:kms:us-east-1:123456789012:key/abc-def
    key_rotation_days: 90

  compliance:
    - HIPAA
    - SOC2
    - ISO27001
```

**Enforcement**:
```typescript
class DataSovereigntyEnforcer {
  async validateOperation(
    tenantId: string,
    operation: DataOperation
  ): Promise<void> {
    const policy = await this.loadSovereigntyPolicy(tenantId);

    // 1. Check region compliance
    if (!policy.allowed_regions.includes(operation.region)) {
      throw new SovereigntyViolation(
        `Operation in ${operation.region} violates tenant policy`
      );
    }

    // 2. Check retention compliance
    if (operation.type === "delete") {
      const age = Date.now() - operation.data_created_at.getTime();
      const minAge = policy.retention[operation.data_type + "_days"] * 86400000;
      if (age < minAge) {
        throw new RetentionViolation("Data too recent to delete");
      }
    }

    // 3. Check encryption compliance
    if (operation.encryption !== policy.encryption.at_rest) {
      throw new EncryptionViolation("Encryption mismatch");
    }
  }
}
```

---

### 2.6 Lineage by Namespace

**Enhanced Schema** (`reports/lineage.jsonl`):
```jsonl
{"tenant_id":"acme-corp","domain":"healthcare","usecase":"patient-qa","source_id":"doc-123","query_id":"q-456","chunk_id":"chunk-789","trust_score":0.82,"agent_id":"planner-v1","policy_version":"1.2.3","timestamp":"2025-10-08T12:00:00Z"}
{"tenant_id":"beta-inc","domain":"finance","usecase":"compliance-check","source_id":"doc-abc","query_id":"q-def","chunk_id":"chunk-ghi","trust_score":0.91,"agent_id":"evaluator-v2","policy_version":"2.0.1","timestamp":"2025-10-08T12:05:00Z"}
```

**Cross-Tenant Drift Map** (`reports/tenant-drift-map.json`):
```json
{
  "generated_at": "2025-10-08T12:30:00Z",
  "tenants": {
    "acme-corp": {
      "drift_score": 0.05,
      "avg_trust": 0.78,
      "policy_changes_7d": 2,
      "quality_trend": "stable"
    },
    "beta-inc": {
      "drift_score": 0.12,
      "avg_trust": 0.85,
      "policy_changes_7d": 5,
      "quality_trend": "improving"
    }
  },
  "conflicts": []
}
```

---

### 2.7 Per-Tenant SLO/SLA + Error Budget

**SLO Definition**:
```typescript
interface TenantSLO {
  tenant_id: string;
  slo: {
    availability: 0.999;          // 99.9% uptime
    p95_latency_ms: 3100;         // 95th percentile
    error_rate_max: 0.01;         // 1% error rate
    cost_per_1k_qa_usd: 0.10;     // $0.10 per 1000 QA pairs
  };
  error_budget: {
    monthly_downtime_minutes: 43; // 99.9% = 43.2min/month
    consumed_minutes: 12;         // Used so far
    remaining_minutes: 31;        // Left
    status: "healthy" | "warning" | "exhausted";
  };
}
```

**Enforcement**:
```typescript
class SLOEnforcer {
  async checkSLO(tenantId: string): Promise<SLOStatus> {
    const slo = await this.getTenantSLO(tenantId);
    const metrics = await this.getTenantMetrics(tenantId);

    // Check error budget
    if (slo.error_budget.status === "exhausted") {
      // Release freeze for this tenant
      await this.freezeTenantReleases(tenantId);
      return { passed: false, reason: "Error budget exhausted" };
    }

    // Check latency
    if (metrics.p95_latency_ms > slo.slo.p95_latency_ms) {
      // Auto-disable experimental features
      await this.disableExperimentalFeatures(tenantId);
      return { passed: false, reason: "Latency SLO violated" };
    }

    return { passed: true };
  }
}
```

---

### 2.8 Workflow Bridge (Optional)

**Purpose**: Connect org approvals (Slack/Jira/Email) to tenant-specific pipelines.

**Flow**:
```
User Feedback → Workflow Bridge → Approval Request (Slack/Jira)
                                          ↓
                                     Approved?
                                          ↓
                               Yes: Re-evaluate tenant pipeline
                                          ↓
                               Update tenant reports + PDF
```

**Implementation Stub**:
```typescript
interface ApprovalRequest {
  tenant_id: string;
  type: "policy_change" | "feature_enable" | "budget_increase";
  requester: string;
  details: Record<string, any>;
  approval_channel: "slack" | "jira" | "email";
}

class WorkflowBridge {
  async requestApproval(request: ApprovalRequest): Promise<string> {
    // 1. Create approval ticket
    const ticket = await this.createTicket(request);

    // 2. Send notification
    await this.notify(request.approval_channel, ticket);

    // 3. Return ticket ID
    return ticket.id;
  }

  async onApprovalReceived(ticketId: string, approved: boolean): Promise<void> {
    const request = await this.getRequest(ticketId);

    if (approved) {
      // Execute approved action
      await this.executeApprovedAction(request);

      // Generate PDF report
      await this.generatePDFReport(request.tenant_id, request);
    } else {
      // Reject and notify
      await this.rejectRequest(request);
    }
  }
}
```

---

## 3. Migration Path (Zero-Downtime)

### Phase 1: Namespace Introduction (Week 1)
- Add `tenant_id`, `domain_id`, `usecase_id` fields to all schemas (default: "default")
- Backward compatibility: Existing data gets "default" tenant

### Phase 2: GitOps Transition (Week 2)
- Create `tenants/default/` directory structure
- Migrate current policies to `tenants/default/policies/`
- New tenants start with GitOps

### Phase 3: Storage Isolation (Week 3)
- Move existing corpus to `default/` namespace
- Setup tenant-specific buckets for new tenants
- Implement namespace-aware retrieval

### Phase 4: Router/FF Tenant-ization (Week 4-5)
- Split Feature Matrix into per-tenant files
- Implement tenant-scoped model routing
- Deploy gradually (tenant by tenant)

### Phase 5: WebView Multi-Tenant (Week 6-7)
- Add login/authentication
- Implement role-based views
- Central operator dashboard for multi-tenant monitoring

---

## 4. Operational Considerations

### Data Leakage Prevention
- **Storage**: Enforce namespace keys in all queries
- **Logs**: Tenant ID mandatory in all log entries
- **Metrics**: Separate metric namespaces per tenant
- **Caches**: Prefix all cache keys with tenant ID

### Noisy Neighbor Prevention
- **Quotas**: Per-tenant request limits
- **Circuit Breakers**: Per-tenant budget limits
- **Scheduling**: Fair scheduler with tenant-aware priority
- **Resource Isolation**: Separate queues/workers per tenant tier

### Policy Conflict Resolution
- **Conflict Map**: Central dashboard showing conflicting policies
- **Canary Deployment**: 10% → 50% → 100% rollout per tenant
- **Approval Required**: No prod policy changes without PR + signature

### Compliance Monitoring
- **Real-time Checks**: Policy Kernel validates every operation
- **Audit Trail**: Complete lineage per tenant
- **Automated Reports**: Weekly compliance score per tenant

---

## 5. Success Metrics

### Isolation
- Data leakage incidents: 0
- Cross-tenant access attempts: Blocked 100%

### Performance
- Per-tenant p95 latency: ≤ SLO
- Per-tenant error rate: ≤ SLO
- Noisy neighbor incidents: 0

### Governance
- Policy conflicts detected: 100%
- Unauthorized policy changes: Blocked 100%
- Compliance violations: 0

---

## 6. References

- Integrated Roadmap: `docs/RFC/2025-10-integrated-roadmap-phase1.6-to-2.1.md`
- Session State: `docs/SESSION_STATE.md`
- Product Plan: `docs/PRODUCT_PLAN.md`

---

**Document Status**: Design Specification
**Implementation Target**: Phase 2.0 (Week 5-9)
**Owner**: System Architecture Team
