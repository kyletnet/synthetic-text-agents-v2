# FE WIRING RUNBOOK — Frontend Integration & Operations

## Overview
This runbook explains how to run the fe-web Next.js frontend, configure backend providers, and understand the data flow between UI and engine.

## Quick Start

### Installation
```bash
# From root directory
cd apps/fe-web
npm install

# Or using workspace commands
pnpm --filter fe-web install
npm --workspace apps/fe-web install
```

### Running the App
```bash
# Development mode (runs on localhost:3001)
pnpm --filter fe-web dev
npm --workspace apps/fe-web run dev

# Or from fe-web directory
cd apps/fe-web && npm run dev
```

### Building for Production
```bash
pnpm --filter fe-web build
npm --workspace apps/fe-web run build
```

## Backend Provider Configuration

The frontend supports 3 backend modes controlled by `RUN_PROVIDER` environment variable:

### MOCK (Default)
Returns mock data for development and testing.
```bash
RUN_PROVIDER=MOCK pnpm --filter fe-web dev
```

Behavior:
- Loads `docs/TEMPLATES/expected_run_result.json` if available
- Falls back to synthesized mock data
- Always succeeds, ~0ms latency
- Good for UI development and testing

### CLI
Spawns the engine CLI process to generate real results.
```bash
RUN_PROVIDER=CLI pnpm --filter fe-web dev
```

Behavior:
- Tries `node ./dist/cli/main.js --json` first
- Falls back to `npm run demo` if first fails
- 20s timeout, then fallback to MOCK
- Real engine execution with actual QA generation

Requirements:
- Engine must be built (`npm run build`)
- CLI must accept JSON input on stdin
- CLI must output valid JSON result on stdout

### ENGINE_HTTP (Stub)
Placeholder for future HTTP backend.
```bash
RUN_PROVIDER=ENGINE_HTTP pnpm --filter fe-web dev
```

Currently returns mock data with TODO warnings.

## Data Flow & Contract

### Request Flow
1. UI state → `buildRunRequest()` → `RunRequest`
2. POST `/api/run` → Provider logic → `RunResult` 
3. Results displayed in UI → Links to logs/decisions

### Key Mappings (per FLAGS_WIRING.md)

#### Feature Flags
- `feature.searchLite`: A toggle (beta, default OFF)
- `feature.guardianProfiles`: B selector (always true)
- `feature.autoTagging`: C internal (always true) 
- `feature.difficultyDistribution`: D internal (always true)
- `feature.styleGuard`: E toggle + rules file
- `feature.mode`: F tabs (explore/exploit)

#### Guardian Profiles
- `default`: minScore=7.0, maxLatency=2000ms
- `strict`: minScore=7.5, maxLatency=2000ms  
- `fast`: minScore=7.0, maxLatency=1800ms

#### Preset Mappings
- **Strict**: strict profile, exploit mode, styleGuard=ON, citeRequired=true
- **Default**: default profile, exploit mode, styleGuard=ON
- **Fast**: fast profile, explore mode, styleGuard=OFF

## UI Components & TestIDs

### Inputs Panel
- `btn-run`: Main execution button
- `toggle-style-guard`: Style Guard on/off
- `select-guardian`: Guardian Profile selector
- `tab-mode-explore`: Explore mode tab

### Results Panel  
- `chip-tag-hallucination`: Issue tag chips
- Metrics table: passRate, avgScore, avgLatency, vetoedPct
- Sample table with status/score/latency

### Inspector Panel
- `btn-rerun`: Rerun with feedback
- `btn-rollback`: Rollback to previous state
- Auto-tagging suggestions (max 2)
- Feedback textarea
- Change impact summary

## Persistence & Session Management

### Local Storage
- Session config auto-saved to `synthetic-agents-session` key
- Persists: mode, guardianProfileId, searchLite, strategyOverrides, feedback

### Import/Export
- Export: Downloads JSON file with current session config
- Import: Loads session config from JSON file
- Format matches `docs/TEMPLATES/session_config_example.json`

## Request Logging

All requests logged to `outputs/fe_requests.log` as single-line JSON:
```json
{"ts":"2025-08-30T10:30:00.000Z","flags":{"feature.searchLite":false},"profileId":"default","mode":"exploit","provider":"MOCK","ok":true,"latencyMs":50}
```

## Results & Links Integration

When engine returns results:

### Run Logs
- Link: `run_result.links.runLogPath`
- Example: `docs/RUN_LOGS/2025-08-30_run-001.md`
- Contains detailed execution trace

### Decision Cards  
- Link: `run_result.links.decisionPath`
- Example: `docs/LEDGER/dec-20250830-001.md`
- Contains HITL feedback and strategy changes

### Suggested Tags (C feature)
- Max 2 tags from autoTagging
- Displayed as clickable chips in Inspector panel
- Examples: "hallucination", "too_easy", "format_issue"

## Known Limitations

### CLI Provider Limitations
- Requires engine to be built and working
- No real-time progress updates
- 20s hard timeout
- Fallback to MOCK on any failure
- CLI must output parseable JSON on stdout

### UI Limitations  
- No real-time generation progress
- Limited error handling/retry logic
- Style rules file upload doesn't validate YAML
- Session export/import doesn't validate schema

### Missing Features
- No ENGINE_HTTP implementation
- No real autoTagging mapping (C feature)
- No real difficulty distribution display (D feature)
- No real change impact calculation

## Troubleshooting

### CLI Provider Not Working
1. Check engine build: `npm run build` in root
2. Test CLI directly: `node dist/cli/main.js --json`
3. Check file permissions and paths
4. Review console logs for spawn errors
5. Falls back to MOCK automatically

### Session Not Persisting
1. Check browser localStorage enabled
2. Clear localStorage and refresh
3. Check JSON format in session export

### Missing Results
1. Verify RUN_PROVIDER setting
2. Check API route responses in Network tab
3. Review request logging in `outputs/fe_requests.log`

## Development Notes

### Adding New Providers
1. Add case in `/api/run/route.ts`
2. Implement provider function
3. Update documentation
4. Add environment variable

### Adding New Features
1. Follow FLAGS_WIRING.md exposure rules
2. Add testIDs per FE_MVP_SPEC.md
3. Update session config schema
4. Add persistence support

### Testing Locally
```bash
# Test different providers
RUN_PROVIDER=MOCK npm run dev
RUN_PROVIDER=CLI npm run dev

# Check request logs
tail -f outputs/fe_requests.log

# Test session import/export
# Export config → modify → import → verify
```