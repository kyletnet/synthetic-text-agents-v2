# ADR-20250918: Single LLM Client Architecture

**Status:** Accepted
**Date:** 2025-09-18
**Authors:** Claude Code
**Reviewers:** System Architecture Team

## Summary

Enforce a "single LLM client" rule where all API calls to LLM providers must go through designated wrapper scripts (e.g., `tools/anthropic_client.sh`) rather than direct HTTP/SDK calls scattered throughout the codebase.

## Context

### Current State

The synthetic-text-agents system makes LLM API calls from multiple locations:

- Direct `fetch()` calls in Node.js scripts
- Direct `curl` calls in shell scripts
- Mixed SDK usage (anthropic-ai npm package)
- Inconsistent error handling and cost tracking
- No unified budget enforcement
- API keys exposed in various formats

### Problems Identified

1. **Cost tracking fragmentation** - Unable to aggregate total API spend across different call sites
2. **Inconsistent retry logic** - Each location implements different timeout/retry strategies
3. **Secret leakage risk** - API keys handled differently across locations
4. **Policy enforcement gaps** - No central point to enforce rate limiting, budgets, etc.
5. **Debugging complexity** - API failures manifest differently across call sites
6. **Testing challenges** - Difficult to mock API responses consistently

### Business Context

- **Budget governance** - Need precise cost tracking for ROI analysis
- **Security compliance** - API key management and audit requirements
- **Operational reliability** - Standardized error handling and monitoring
- **Development velocity** - Simplified testing and debugging workflows

## Decision

### Core Rule

**All LLM API calls must go through designated client wrapper scripts:**

- `tools/anthropic_client.sh` - For Anthropic Claude API
- Future: `tools/openai_client.sh`, `tools/azure_client.sh`, etc.

### Implementation Strategy

#### 1. Wrapper Script Architecture

```bash
# tools/anthropic_client.sh provides:
# - Unified JSON input/output format
# - Built-in retry logic with exponential backoff
# - Budget enforcement and cost tracking
# - API key masking in logs
# - Rate limiting and concurrency controls
# - Comprehensive error classification
```

#### 2. Adapter Layer for TypeScript/Node.js

```typescript
// scripts/clients/anthropic_adapter.ts
export async function callAnthropic(payload, options): Promise<AdapterResult> {
  // Spawns tools/anthropic_client.sh internally
  // Maps exit codes to error classifications
  // Provides structured logging and telemetry
}
```

#### 3. Enforcement via Guard Script

```bash
# scripts/forbidden-direct-http.sh
# - Scans codebase for direct API calls
# - Maintains allowlist for legitimate use cases
# - Integrated into CI/CD pipeline via guard:no-direct-http
```

#### 4. Allowed Exception Patterns

- **Client scripts:** `tools/*_client.sh`
- **Adapters:** `scripts/clients/*Adapter.ts`
- **Network diagnostics:** `scripts/net_diag.sh`
- **Documentation:** Examples in `docs/` directory

### Migration Plan

#### Phase 1: Infrastructure (Completed)

- ✅ Enhanced `tools/anthropic_client.sh` with full feature set
- ✅ Created `scripts/clients/anthropic_adapter.ts` TypeScript adapter
- ✅ Updated `scripts/forbidden-direct-http.sh` guard script
- ✅ Integrated guard into pipeline via `guard:no-direct-http`

#### Phase 2: Codebase Migration (Completed)

- ✅ Identified all direct API call sites via repository scan
- ✅ Replaced direct calls in core scripts (`step4_2.sh`, etc.)
- ✅ Updated existing LLM utility modules (`src/shared/llm.ts`, `tools/llm.cjs`)
- ✅ Verified guard script passes on clean codebase

#### Phase 3: Testing & Documentation (Completed)

- ✅ Added comprehensive test suite for enforcement
- ✅ Updated `docs/OPERATIONS.md` with usage examples
- ✅ Added troubleshooting guides and integration patterns

## Benefits Realized

### 1. Unified Cost Tracking

- **Before:** API costs scattered across multiple tracking mechanisms
- **After:** All costs flow through single client with standardized logging
- **Result:** Precise budget enforcement and ROI analysis capability

### 2. Consistent Error Handling

- **Before:** Each call site implements custom retry/timeout logic
- **After:** Standardized exponential backoff, timeout, and error classification
- **Result:** Improved reliability and simplified debugging

### 3. Enhanced Security

- **Before:** API keys handled inconsistently across call sites
- **After:** Keys automatically masked in logs, centralized rotation support
- **Result:** Reduced secret leakage risk and improved audit compliance

### 4. Policy Enforcement

- **Before:** No central point for rate limiting or governance
- **After:** Single choke point for all policy enforcement
- **Result:** Can implement organization-wide controls (budget caps, rate limits)

### 5. Testing Simplification

- **Before:** Each call site requires separate mocking strategy
- **After:** Mock at single client layer affects entire system
- **Result:** Simplified test setup and consistent offline mode

## Risks and Mitigation

### Risk: Single Point of Failure

**Mitigation:**

- Comprehensive test coverage of wrapper scripts
- Fallback mechanisms for critical path scenarios
- Clear rollback procedures documented

### Risk: Performance Overhead

**Mitigation:**

- Wrapper scripts optimized for low latency
- Async/concurrent call patterns preserved
- Performance benchmarks established

### Risk: Developer Experience Impact

**Mitigation:**

- TypeScript adapters provide familiar async/await interface
- Clear documentation and examples provided
- IDE integration for autocomplete and type checking

### Risk: Migration Complexity

**Mitigation:**

- Automated scanning tools to identify call sites
- Gradual migration with backward compatibility
- Comprehensive testing at each migration step

## Alternatives Considered

### Alternative 1: Allow Direct Calls with Guidelines

**Rejected because:** Guidelines without enforcement lead to drift over time. Cost tracking and security requirements need hard guarantees.

### Alternative 2: SDK-Based Standardization

**Rejected because:** SDKs still allow multiple call sites with different configurations. Doesn't solve cost tracking or policy enforcement.

### Alternative 3: Middleware/Proxy Approach

**Rejected because:** Adds network complexity and single point of failure without the benefits of process-level controls.

## Implementation Details

### File Changes

- **Enhanced:** `tools/anthropic_client.sh` - Full wrapper functionality
- **Created:** `scripts/clients/anthropic_adapter.ts` - TypeScript adapter
- **Enhanced:** `scripts/forbidden-direct-http.sh` - Enforcement guard
- **Updated:** `src/shared/llm.ts`, `tools/llm.cjs` - Migration to adapter
- **Updated:** `step4_2.sh` and other scripts with direct calls
- **Enhanced:** Test suite and documentation

### Integration Points

- **CI/CD:** `guard:no-direct-http` runs on every commit
- **Runtime:** All API calls route through single client
- **Monitoring:** Structured logs for cost tracking and debugging
- **Configuration:** Environment-based client selection and configuration

### Backward Compatibility

- Existing interfaces preserved where possible
- Gradual migration path with deprecation warnings
- Clear upgrade documentation for team members

## Success Criteria

### Functional Requirements ✅

- [x] All LLM API calls route through designated clients
- [x] Guard script detects and prevents direct calls
- [x] Cost tracking works across all call sites
- [x] Error handling consistent across system
- [x] API key masking functions correctly

### Performance Requirements ✅

- [x] No significant latency increase (< 50ms overhead)
- [x] Concurrent call patterns preserved
- [x] Memory usage within acceptable bounds

### Security Requirements ✅

- [x] API keys never appear in logs or git commits
- [x] All secret access goes through controlled interfaces
- [x] Audit trail available for all API calls

### Developer Experience ✅

- [x] TypeScript adapters provide type safety
- [x] Documentation covers common use cases
- [x] Test utilities support mocking at client layer

## Monitoring and Maintenance

### Ongoing Monitoring

- **Guard execution:** `guard:no-direct-http` runs in CI/CD pipeline
- **Cost tracking:** Session reports include unified cost data
- **Error patterns:** Centralized error logging and alerting
- **Performance metrics:** Client latency and throughput monitoring

### Maintenance Tasks

- **Quarterly:** Review guard allowlist for new patterns
- **Monthly:** Audit cost tracking accuracy and completeness
- **As needed:** Update client scripts for API changes
- **When adding providers:** Extend pattern to new LLM APIs

### Evolution Path

- **Phase 4:** Extend pattern to additional LLM providers (OpenAI, Azure)
- **Phase 5:** Add advanced features (caching, load balancing)
- **Phase 6:** Consider containerized client deployment

## Conclusion

The single LLM client architecture successfully addresses cost tracking, security, and operational challenges while maintaining developer productivity. The enforced architectural pattern provides a foundation for future enhancements and scaling.

Key success factors:

1. **Comprehensive tooling** - Guard scripts, adapters, and documentation
2. **Gradual migration** - Systematic replacement without breaking changes
3. **Developer-friendly** - TypeScript adapters maintain familiar interfaces
4. **Policy enforcement** - Hard guarantees through automated checking

This architectural decision positions the system for reliable, secure, and cost-effective LLM API usage at scale.
