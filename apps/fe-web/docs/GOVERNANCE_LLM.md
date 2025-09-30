# LLM Governance & Mock Contamination Prevention

## Overview

This document establishes the governance framework for LLM integration and prevents "Silent Mock Contamination" - a critical reliability issue where systems appear to function properly but are actually using hardcoded templates instead of real LLM calls.

## Critical Problem Statement

**Silent Mock Contamination**: Systems that appear to work but perform no actual function (작동하는 것처럼 보이나 전혀 실제 기능을 수행하지 않는 상태). This represents a broken contract between UI expectations and actual functionality.

## Core Components

### 1. ExecutionVerifier System

- **Purpose**: Real-time detection and prevention of mock data usage
- **Implementation**: `lib/execution-verifier.ts`
- **Key Method**: `ExecutionVerifier.assertRealLLMCall(response, context)`

### 2. LLMCallManager

- **Purpose**: Centralized LLM call management with proper error handling
- **Implementation**: `lib/llm-call-manager.ts`
- **Features**:
  - Exponential backoff retry logic
  - Error categorization and handling
  - Call statistics and monitoring
  - SSR-safe global state management

### 3. Source Tracking System

All responses must include proper source identification:

```typescript
interface Response {
  source: "llm" | "fallback" | "mock" | "error";
  metadata: {
    llmUsed: boolean;
    apiTrace?: string;
    sessionId: string;
  };
}
```

## Mandatory Development Practices

### 1. LLM Call Requirements

- **MUST** use `LLMCallManager.callWithRetry()` for all LLM API calls
- **MUST** include session ID for tracking
- **MUST** handle all error types with appropriate fallbacks
- **NEVER** hardcode responses without proper source labeling

### 2. Verification Requirements

- **MUST** call `ExecutionVerifier.assertRealLLMCall()` on critical paths
- **MUST** implement mock pattern detection
- **MUST** validate LLM response signatures

### 3. Error Handling Standards

```typescript
// Error types with specific handling:
- 'auth': Critical - immediate alert, no retry
- 'rate_limit': High - exponential backoff with alerts
- 'network': Medium - retry with increasing delays
- 'timeout': Medium - retry with timeout adjustments
- 'format': Low - no retry, detailed logging
- 'unknown': Investigation required - detailed analysis
```

## Environment Policies

### Production Requirements

- **Strict Mode REQUIRED**: `process.env.NODE_ENV === 'production'`
- **Valid API Key REQUIRED**: `process.env.ANTHROPIC_API_KEY` configured
- **Mock Contamination Risk**: MUST be "none"
- **Fallback Rate**: MUST be < 30%

### Development Guidelines

- Mock data allowed only in development with clear labeling
- Fallback templates must include mock detection patterns
- All responses must maintain source field integrity

## Monitoring & Alerting

### Health Endpoints

- **`GET /api/maintain`**: Comprehensive system diagnostics
- **`GET /api/health`**: Basic health with mock contamination checks
- **`GET /api/status`**: System status with LLM configuration

### Alert Triggers

- **CRITICAL**: Mock contamination in production
- **HIGH**: Fallback rate > 30%
- **MEDIUM**: Authentication failures
- **LOW**: Network timeouts

### Metrics Tracking

```typescript
interface LLMCallStats {
  totalCalls: number;
  successfulCalls: number;
  fallbackCalls: number;
  errorCalls: number;
  successRate: number;
  fallbackRate: number;
  averageResponseTime: number;
  errorBreakdown: Record<string, number>;
}
```

## Implementation Guidelines

### 1. Mock Pattern Detection

Automatic detection of hardcoded patterns:

```typescript
const mockIndicators = [
  "패러프레이즈하여 의미는 유지하되 표현을 다양화한 결과입니다",
  "Math.random() * 0.3 + 0.7", // Mock scoring
  "generateMockResults",
  "mock-001",
  "mock-002", // Mock IDs
];
```

### 2. LLM Response Signatures

Validation of authentic LLM responses:

- Variable response lengths (not template-fixed)
- Processing time > 100ms
- Quality scores with natural variation
- Proper metadata structure

### 3. Session Tracking

```typescript
// All LLM calls must include session tracking:
const result = await LLMCallManager.callWithRetry(
  sessionId,
  async () => anthropicClient.generateText(prompt),
  "contextual_description",
);
```

## Code Review Checklist

### Before Merging

- [ ] All LLM calls use LLMCallManager
- [ ] Source tracking implemented properly
- [ ] Error handling covers all categories
- [ ] Session IDs propagated correctly
- [ ] Mock detection patterns updated
- [ ] Health endpoints return valid responses

### Testing Requirements

- [ ] Mock contamination tests pass
- [ ] Error scenarios covered
- [ ] Fallback mechanisms validated
- [ ] Performance regression tests
- [ ] SSR compatibility verified

## Emergency Procedures

### Mock Contamination Detection

1. **Immediate**: Check `/api/maintain` for contamination risk
2. **Investigate**: Review recent deployments and API configurations
3. **Mitigate**: Enable strict mode and verify API keys
4. **Monitor**: Watch fallback rates and error patterns

### API Failure Response

1. **Categorize**: Determine error type (auth/network/rate_limit)
2. **Alert**: Send appropriate notifications based on severity
3. **Fallback**: Engage appropriate fallback mechanisms
4. **Recovery**: Monitor for service restoration

## Future Enhancements

### Planned Features

- Automated mock contamination scanning
- Enhanced LLM response quality scoring
- Cross-session call correlation
- Performance optimization recommendations

### Integration Points

- CI/CD pipeline integration for contamination checks
- Real-time dashboard for LLM health monitoring
- Alert system integration (Slack/Discord/Email)

## References

- **GPT Advisory Integration**: Reflects comprehensive reliability improvements
- **No-Mock Policy**: Zero tolerance for unidentified mock data
- **Observability Standards**: Full audit trail requirements
- **Performance Guidelines**: Response time and error rate thresholds

---

**Last Updated**: 2025-09-29
**Version**: 1.0
**Maintained By**: Development Team
**Review Cycle**: Monthly
