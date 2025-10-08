# Runbook: LLM Timeout / Rate Limit

**Scenario**: LLM API 타임아웃 (>10s) 또는 Rate Limit 초과
**Severity**: P1 (High)
**Owner**: Platform Team
**Last Updated**: 2025-10-09

---

## Detection

### Symptoms
- Event: `llm.timeout` OR `llm.rate_limit`
- Alert: Slack #alerts + PagerDuty
- Threshold: 5회/분 이상
- Monitoring: `reports/metrics/llm-latency.json`

### Metrics
```bash
# Check recent LLM call latency
cat reports/metrics/llm-latency.json | jq '.[] | select(.latency_ms > 10000)'

# Check rate limit errors
grep "rate_limit" logs/app.log | tail -20
```

---

## Immediate Response (< 5min)

### Step 1: Assess Impact
```bash
# Check affected tenants
cat reports/metrics/llm-errors.json | jq '.tenants'

# Check failure rate
cat reports/metrics/llm-errors.json | jq '.failure_rate'
```

### Step 2: Enable Fallback Mode
```typescript
// Automatic fallback (already implemented)
// ModelRouter.gracefulDegrade() triggers:

1. Cached response (if available)
2. Exponential backoff (1s, 2s, 4s, 8s)
3. Router switch to alternative model
4. Operator set reduction
```

### Step 3: Verify Fallback
```bash
# Check cache hit rate
cat reports/cache/stats.json | jq '.hit_rate'

# Check alternative model usage
cat reports/metrics/model-router.json | jq '.fallback_count'
```

---

## Recovery Steps (< 30min)

### Step 1: Identify Root Cause

**LLM Timeout**:
```bash
# Check LLM provider status
curl https://status.anthropic.com/api/v2/status.json

# Check network latency
ping api.anthropic.com

# Check local network
traceroute api.anthropic.com
```

**Rate Limit**:
```bash
# Check current usage
cat reports/metrics/llm-usage.json | jq '.calls_per_minute'

# Check quota
cat reports/metrics/llm-usage.json | jq '.quota_remaining'
```

### Step 2: Apply Fix

**If Timeout** (Provider issue):
```bash
# Switch to alternative model
export FALLBACK_MODEL="claude-3-sonnet-20240229"
npm run runtime:restart
```

**If Rate Limit** (Usage spike):
```bash
# Reduce concurrent calls
export MAX_CONCURRENT_CALLS=5  # Default: 10
npm run runtime:restart

# Enable aggressive caching
export CACHE_TTL=7200  # 2 hours
```

### Step 3: Verify Fix
```bash
# Monitor for 15 minutes
watch -n 10 'cat reports/metrics/llm-latency.json | jq ".p95_latency_ms"'

# Expected: p95 < 3000ms
```

---

## Rollback Procedure

### If Fallback Causes Issues

```bash
# 1. Restore original model
export FALLBACK_MODEL=""
npm run runtime:restart

# 2. Freeze processing
export PROCESSING_MODE="freeze"

# 3. Manual mode (admin approval required)
export MANUAL_MODE=true
npm run runtime:restart
```

---

## Post-Incident Actions (< 24h)

### Step 1: Root Cause Analysis
```bash
# Generate RCA report
npm run reports:rca -- --incident llm_timeout_$(date +%Y%m%d)

# Output: reports/rca/llm_timeout_YYYYMMDD.md
```

### Step 2: Update Monitoring
```typescript
// Add stricter thresholds
// config/monitoring.ts
export const LLM_MONITORING = {
  timeout_threshold: 8000,  // Reduced from 10000ms
  rate_limit_threshold: 3,  // Reduced from 5
  alert_window: 60          // 1 minute
};
```

### Step 3: Improve Resilience
```bash
# 1. Increase cache TTL
# 2. Add more fallback models
# 3. Implement circuit breaker
```

---

## Validation Checklist

- [ ] Response delivered (cached or fallback)
- [ ] Cost within budget (<120% of baseline)
- [ ] No cascade failures (other services operational)
- [ ] p95 latency < 3s (after recovery)
- [ ] Error rate < 1% (after recovery)

---

## Prevention Measures

### Short-term (1 week)
1. Increase cache hit rate target (50% → 70%)
2. Add circuit breaker for LLM calls
3. Implement request queuing

### Long-term (1 month)
1. Multi-provider routing (Anthropic + OpenAI)
2. On-premise model deployment (fallback)
3. Predictive rate limiting

---

## Related Runbooks
- `ROUTER_FAILURE.md` - Model router 장애
- `GRACEFUL_DEGRADATION.md` - 성능 저하 모드

---

## Contact Information
- **Slack**: #platform-alerts
- **PagerDuty**: Platform Team (primary)
- **Escalation**: CTO (if > 1h downtime)

---

**Status**: ✅ Active
**Test Schedule**: Monthly (1st Monday)
**Last Test**: 2025-09-15
**Next Test**: 2025-11-01
