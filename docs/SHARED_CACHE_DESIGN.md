# Shared Cache/Snapshot Design

## Problem Statement (GPT Feedback)

Current workflow has redundancy:

- `/validate`, `/audit`, `/ship` each run independent checks
- Same diagnostics (TypeScript, ESLint, tests) executed multiple times
- No shared state = inconsistent results + wasted time

Example: `/ship` runs 8 steps, each potentially re-running `tsc --noEmit`

## Solution: Unified Inspection Cache

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   User Triggers                      │
│   /inspect --deep   │   /inspect   │   /ship        │
└──────────┬──────────┴──────┬───────┴────────┬───────┘
           │                 │                │
           ▼                 ▼                ▼
    ┌─────────────────────────────────────────────┐
    │     InspectionCache (30-min TTL)            │
    │  reports/inspection-results.json            │
    │                                             │
    │  - TypeScript errors                        │
    │  - ESLint warnings/errors                   │
    │  - Test results                             │
    │  - Architecture violations                  │
    │  - Security issues                          │
    │  - Manual approval items                    │
    └─────────────────────────────────────────────┘
           │                 │                │
           ▼                 ▼                ▼
    ┌──────────┐      ┌──────────┐    ┌──────────┐
    │  /maintain│      │   /fix   │    │ /validate│
    │  (reads)  │      │ (reads)  │    │ (reads)  │
    └──────────┘      └──────────┘    └──────────┘
```

### Key Principles

1. **Single Source of Truth**: `/inspect` generates, others consume
2. **Cache Invalidation**: 30-minute TTL (configurable)
3. **Fail-Fast**: Commands enforce `/inspect` first
4. **Idempotency**: Same cache → same results

## Implementation Status

### ✅ Already Implemented

- `InspectionCache` class (scripts/lib/inspection-cache.ts)
- `/inspect` generates `inspection-results.json`
- `/fix` enforces `/inspect` first via `enforceInspectFirst()`
- `/maintain` reads from cache

### 🚧 Needs Integration

#### `/ship` Integration

**Current (Redundant)**:

```bash
/ship runs:
  1. design:validate → runs tsc
  2. validate → runs tsc again
  3. verify → runs tsc again
  ...
```

**Proposed (Efficient)**:

```bash
/ship runs:
  0. Check cache (if fresh → use, else run /inspect)
  1. design:validate → read cache
  2. validate → read cache
  3. verify → read cache
  ...
```

#### `/validate` Integration

**Current**:

```typescript
// validate-unified.ts
execSync("tsc --noEmit"); // Direct execution
```

**Proposed**:

```typescript
// validate-unified.ts
const cache = new InspectionCache();
cache.enforceInspectFirst("validate");
const results = cache.read();
// Use results.typeScriptErrors instead of re-running
```

#### `/audit` Integration

Similar pattern:

```typescript
const cache = new InspectionCache();
cache.enforceInspectFirst("audit");
const results = cache.read();
// Analyze results.manualApprovalNeeded, etc.
```

## Migration Plan

### Phase 1: Non-Breaking Changes (This Week)

- [x] Add cache enforcement to `/fix` (done)
- [ ] Add cache enforcement to `/validate`
- [ ] Add cache enforcement to `/audit`
- [ ] Update `/ship` to check cache first

### Phase 2: Full Integration (Next Week)

- [ ] Remove direct `execSync("tsc")` calls
- [ ] Centralize diagnostics in `/inspect`
- [ ] Performance benchmark (expect 50-70% faster)

### Phase 3: Cache Warmth Tracking (Future)

- [ ] Add `--force-refresh` flag to `/inspect`
- [ ] Track cache hit/miss rates
- [ ] Auto-refresh if source files changed

## Benefits

### Time Savings

- **Before**: `/ship` takes ~8 minutes (8 steps × ~1 min each)
- **After**: `/ship` takes ~3 minutes (1 inspect + 7 cached reads)
- **Savings**: ~60% faster

### Consistency

- **Before**: Each step might see different state (files changed mid-run)
- **After**: All steps see same snapshot (atomic view)

### Developer Experience

- **Before**: "Why is it checking TypeScript again?"
- **After**: "One check, multiple consumers"

## Configuration

### Cache TTL

```json
// quality-policy.json (future)
{
  "inspectionCache": {
    "ttlMinutes": 30,
    "invalidateOnFileChange": true,
    "warmCacheOnStartup": false
  }
}
```

### Feature Flags

```bash
# Force cache refresh
FORCE_INSPECT=1 npm run ship

# Skip cache enforcement (debug only)
SKIP_CACHE_ENFORCEMENT=1 npm run fix
```

## Trade-offs

### Pros

✅ 60% faster workflow
✅ Consistent results across commands
✅ Single source of truth
✅ Clear separation: generate vs. consume

### Cons

⚠️ Cache staleness risk (mitigated by 30-min TTL)
⚠️ Requires discipline (/inspect must run first)
⚠️ Initial migration effort (~4 hours)

## References

- **Implementation**: `scripts/lib/inspection-cache.ts`
- **Schema**: `scripts/lib/inspection-schema.ts`
- **Usage Examples**: `scripts/fix-engine.ts`, `scripts/maintain-engine.ts`
