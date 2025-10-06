---
description: Run comprehensive system diagnostics and quality checks (Step 1 of 4-step workflow)
argument-hint: none
allowed-tools: Bash(npm run status:*), Bash(/inspect)
---

# /inspect - Comprehensive System Diagnosis

**Step 1 of 4-step Quality Workflow**

Run full system diagnostics and classify issues into auto-fixable vs manual-approval-needed.

## Usage

```bash
/inspect          # Via bash script
npm run status    # Via npm (same command)
```

## What it does

**Single Source of Truth - Creates comprehensive diagnosis:**

1. **Code Quality Checks**

   - TypeScript compilation errors
   - ESLint warnings/errors
   - Prettier formatting issues

2. **System Health**

   - Test execution status
   - Security audit
   - Component documentation

3. **Technical Debt**

   - Workarounds detection (TODO/FIXME/HACK)
   - Refactoring queue items

4. **Classification**
   - Auto-fixable items → for `/maintain`
   - Manual approval needed → for `/fix`

## Output

- Console report with health score (0-100)
- Cached results: `reports/inspection-results.json` (TTL: 5 min)
- Next steps guidance

## Next Steps

```bash
/inspect   → /maintain → /fix → /ship
```

**IMPORTANT**: Always run `/inspect` first before `/maintain` or `/fix`!

_Last updated: 2025-10-01_
