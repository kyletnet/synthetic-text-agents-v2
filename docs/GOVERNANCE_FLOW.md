# Governance Flow - System Control & Visibility

## Purpose

This document explains how the governance system controls, tracks, and explains all tool execution in the system.

**Key Principle:** Every tool execution is either controlled or documented. No blind spots.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Governance System                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Type System (tool-mode.ts)                               │
│     - analyze: Read-only operations                          │
│     - transform: Write operations                            │
│                                                               │
│  2. Enforcement (governance-enforcer.ts)                     │
│     - Scans all *-engine.ts files                            │
│     - Checks @tool-mode declarations                         │
│     - Verifies governance integration                        │
│                                                               │
│  3. Logging (governance-logger.ts)                           │
│     - Records all enforcement decisions                      │
│     - Tracks allowed/blocked/error                           │
│     - JSONL append-only audit trail                          │
│                                                               │
│  4. Mapping (generate-tool-map.ts)                           │
│     - Commands → Engines relationship                        │
│     - Engines → Files → Policies                             │
│     - System visibility map                                  │
│                                                               │
│  5. Explanation (explain-governance.ts)                      │
│     - Natural language policy explanation                    │
│     - Actionable fix instructions                            │
│     - Rationale for decisions                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow Diagram

### Tool Execution Flow

```
User Command
     ↓
Package.json Script
     ↓
Engine File (*-engine.ts)
     ↓
@tool-mode Declaration Check
     ├─ analyze → Auto-exempt from governance
     │            ↓
     │         Execute Directly
     │            ↓
     │         Log: allowed (auto-exempt)
     │
     └─ transform → Governance Required
                ↓
         Check Governance Integration
                ├─ Missing import → BLOCK
                ├─ Missing call → BLOCK
                ├─ Missing property → BLOCK
                │        ↓
                │   Log: blocked (violations)
                │        ↓
                │   User sees error + fix instructions
                │
                └─ All checks pass → ALLOW
                         ↓
                    Execute with Governance
                         ↓
                    Log: allowed (governance-compliant)
```

---

## Components

### 1. Type System (`tool-mode.ts`)

**Purpose:** Structural classification of tools by operational impact

**Design Philosophy:**

- No hardcoded exemption lists
- Mode drives behavior automatically
- Extensible by declaration, not by code change

**Declaration:**

```typescript
// @tool-mode: analyze
// @tool-description: Brief description of what this tool does
```

**Modes:**

- `analyze`: Read-only (reports, scans, validation) → Auto-exempt
- `transform`: Write operations (fixes, refactors, builds) → Governance required

---

### 2. Enforcement (`governance-enforcer.ts`)

**When it runs:**

- `npm run validate` (manual)
- Pre-commit hook (automatic)
- CI pipeline (automatic)

**What it checks:**

1. Tool has `@tool-mode` declaration
2. If `analyze`: Log as allowed, skip governance checks
3. If `transform`: Verify governance integration
   - Has `GovernanceRunner` or `wrapWithGovernance` import
   - Has `executeWithGovernance()` or `wrapWithGovernance()` call
   - Has `private governance` property (if using GovernanceRunner directly)

**Output:**

- Console report (passed/failed)
- JSONL log entry for each tool
- Exit code 0 (pass) or 1 (fail)

---

### 3. Logging (`governance-logger.ts`)

**Log Location:** `reports/governance/enforcement-log.jsonl`

**Entry Format:**

```json
{
  "timestamp": "2025-10-04T18:08:09.248Z",
  "tool": "radar-engine.ts",
  "mode": "analyze",
  "result": "allowed",
  "reason": "Analysis tool - read-only operations, no governance required",
  "policy": "auto-exempt"
}
```

**Why JSONL:**

- Append-only (never corrupts)
- Streamable (can process while writing)
- Searchable (grep/jq/awk friendly)
- Analyzable (can build metrics)

**Use Cases:**

- Audit trail for compliance
- Debugging governance decisions
- Analytics on tool usage
- Impact analysis for policy changes

---

### 4. Tool Relationship Map (`tool-map.json`)

**Generated by:** `npx tsx scripts/generate-tool-map.ts`

**Contents:**

```json
{
  "metadata": {
    "totalCommands": 215,
    "totalEngines": 30,
    "analyzeEngines": 12,
    "transformEngines": 18
  },
  "commands": {
    "/inspect": {
      "script": "tsx scripts/inspection-engine.ts",
      "engine": "inspection-engine",
      "mode": "analyze",
      "description": "System diagnostics..."
    }
  },
  "engines": {
    "inspection-engine": {
      "path": "scripts/inspection-engine.ts",
      "mode": "analyze",
      "requiresGovernance": false,
      "usedByCommands": ["/inspect", "status"]
    }
  },
  "policies": {
    "toolModePolicy": {
      "analyze": ["inspection-engine", "radar-engine", ...],
      "transform": ["maintain-engine", "fix-engine", ...]
    },
    "riskDomains": [...]
  }
}
```

**Use Cases:**

- Impact analysis: "What tools use this engine?"
- Policy planning: "Which commands will be affected by this rule?"
- Onboarding: "How does the system work?"
- Debugging: "Why is this command blocked?"

---

### 5. Policy Explainer

**Usage:**

```bash
npm run explain:governance              # All tools
npm run explain:governance --blocked-only  # Only blocked tools
```

**Output Example:**

```
❌ Blocked Tools (1):

1. my-new-engine.ts
   Mode: transform
   Reason: Governance violations: 2 issue(s)
   Violations:
      🔴 [CRITICAL] Transform tool missing import: GovernanceRunner or wrapWithGovernance
      🔴 [CRITICAL] Transform tool missing call: executeWithGovernance() or wrapWithGovernance()

   📖 How to fix:
      1. Import governance wrapper:
         import { wrapWithGovernance } from './lib/governance/engine-governance-template.js';
      2. Wrap main execution:
         wrapWithGovernance({ name: "tool-name", type: "..." }, async () => {
           // your logic here
         });

   📚 Documentation:
      - docs/GOVERNANCE_PHILOSOPHY.md
      - scripts/lib/governance/tool-mode.ts
```

---

## Policy Rules

### Current Policies (from `governance-rules.json`)

```json
{
  "toolModePolicy": {
    "enabled": true,
    "description": "Type-based governance enforcement - analyze vs transform",
    "modes": {
      "analyze": {
        "requiresGovernance": false,
        "description": "Read-only operations (reports, scans, validation)",
        "examples": ["radar-engine", "gaps-engine", "validate-engine"]
      },
      "transform": {
        "requiresGovernance": true,
        "description": "Write operations (fixes, refactors, builds)",
        "examples": ["maintain-engine", "fix-engine", "refactor-engine"]
      }
    },
    "enforcement": {
      "strategy": "type-based",
      "noExemptionList": true,
      "autoDetect": true,
      "marker": "@tool-mode:"
    }
  }
}
```

### Design Philosophy

**Why type-based enforcement:**

- No hardcoded exemption lists to maintain
- New tools automatically get correct treatment
- Policy is explicit in code (`@tool-mode` declaration)
- Scalable to hundreds of tools

**Why analyze tools don't need governance:**

- Read-only operations have no side effects
- Cannot break system or corrupt data
- Can be run safely at any time
- Performance-sensitive (no governance overhead)

**Why transform tools require governance:**

- Write operations have consequences
- Need snapshot/rollback capability
- Need approval workflows for critical changes
- Need audit trail for compliance

---

## Operational Workflows

### Adding a New Tool

#### For Analyze Tools (Reports, Scans):

```typescript
#!/usr/bin/env tsx

// @tool-mode: analyze
// @tool-description: Brief description of what this does

/**
 * My New Analyzer
 */

// No governance wrapper needed
async function main() {
  // Your analysis logic
  console.log("Analysis results...");
}

main();
```

#### For Transform Tools (Fixes, Builds):

```typescript
#!/usr/bin/env tsx

// @tool-mode: transform
// @tool-description: Brief description of what this does

import { wrapWithGovernance } from "./lib/governance/engine-governance-template.js";

/**
 * My New Transformer
 */

wrapWithGovernance(
  {
    name: "my-new-tool",
    type: "transform",
    description: "What this tool does",
  },
  async () => {
    // Your transformation logic
    console.log("Making changes...");
  },
);
```

### Checking Governance Status

```bash
npm run validate                        # Run full validation
npm run explain:governance              # See all enforcement decisions
npx tsx scripts/generate-tool-map.ts   # Regenerate tool map
```

### Debugging Blocked Tools

1. **Run explainer:**

   ```bash
   npm run explain:governance --blocked-only
   ```

2. **Check log for details:**

   ```bash
   cat reports/governance/enforcement-log.jsonl | jq 'select(.result == "blocked")'
   ```

3. **View tool map:**

   ```bash
   cat reports/governance/tool-map.json | jq '.engines["my-tool"]'
   ```

4. **Apply fix instructions from explainer**

5. **Re-validate:**
   ```bash
   npm run validate
   ```

---

## Metrics & Analytics

### Available Data Sources

1. **Enforcement Log** (`enforcement-log.jsonl`)

   - All governance decisions
   - Timestamp, tool, mode, result, violations
   - Append-only, never modified

2. **Tool Map** (`tool-map.json`)

   - System structure snapshot
   - Commands → Engines → Policies
   - Regenerate on demand

3. **Governance Rules** (`governance-rules.json`)
   - Policy definitions
   - Risk domains, deprecated files
   - Single source of truth

### Example Queries

**Count blocked tools:**

```bash
cat reports/governance/enforcement-log.jsonl | jq -s 'map(select(.result == "blocked")) | length'
```

**List all analyze tools:**

```bash
cat reports/governance/tool-map.json | jq '.policies.toolModePolicy.analyze[]'
```

**Find tools using a specific engine:**

```bash
cat reports/governance/tool-map.json | jq '.engines["inspection-engine"].usedByCommands'
```

---

## Extension Points

### Adding New Policies

1. **Define in `governance-rules.json`:**

   ```json
   {
     "newPolicy": {
       "enabled": true,
       "description": "What this policy does",
       "enforcement": { ... }
     }
   }
   ```

2. **Implement in enforcer:**

   - Add check in `GovernanceEnforcer.checkFile()`
   - Log result in `GovernanceLogger`

3. **Document in explainer:**
   - Add fix instructions in `explain-governance.ts`
   - Update this flow document

### Adding New Tool Modes

Current: `analyze`, `transform`

To add `hybrid` or other modes:

1. **Update `tool-mode.ts`:**

   ```typescript
   export type ToolMode = "analyze" | "transform" | "hybrid";
   ```

2. **Update enforcement logic in `governance-enforcer.ts`**

3. **Update `governance-rules.json` policy definitions**

4. **Document in this file**

---

## Troubleshooting

### "Governance violations found"

**Cause:** Tool is missing `@tool-mode` or governance integration

**Fix:** Run `npm run explain:governance --blocked-only` and follow instructions

### "Cache expired"

**Cause:** Inspection results are older than TTL

**Fix:** Run `npm run status` to refresh

### "No enforcement log found"

**Cause:** Validation hasn't run yet

**Fix:** Run `npm run validate`

---

## References

- **Implementation:** `scripts/lib/governance/`
- **Policies:** `governance-rules.json`
- **Philosophy:** `docs/GOVERNANCE_PHILOSOPHY.md`
- **Examples:** All `*-engine.ts` files with `@tool-mode` declarations
