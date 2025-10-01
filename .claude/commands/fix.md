---
description: Interactive fix engine for manual-approval items (Step 3 of 4-step workflow)
argument-hint: none
allowed-tools: Bash(npm run fix:*)
---

# /fix - Interactive Fix Engine

**Step 3 of 4-step Quality Workflow**

Review and fix items that require manual approval (TypeScript errors, workarounds, refactoring).

## Usage

```bash
/fix              # Via bash script
npm run fix       # Via npm (same command)
```

## What it does

**Handles manual-approval items from inspection cache:**

1. **TypeScript Errors**
   - Compilation errors
   - Type mismatches
   - Import issues

2. **Technical Debt**
   - TODO markers (144 items)
   - FIXME comments
   - HACK workarounds

3. **Refactoring Queue**
   - Code quality improvements
   - Architecture improvements
   - Performance optimizations

4. **Documentation Gaps**
   - Missing component docs
   - Outdated documentation

## Interactive Mode

For each issue:
- Shows context and impact
- Prompts for approval (y/n)
- Applies fix if approved
- Skips if declined

## Prerequisites

**MUST run first:**

```bash
/inspect          # Creates diagnosis cache
/maintain         # Completes auto-fixes
```

## Output

```
⚠️  Manual Approval Needed: 144 items

1. 🔴 Workaround in src/core/BaseAgent.ts:45
   → Remove TODO and implement proper error handling
   Approve? [y/n]:
```

## Next Steps

```bash
/inspect   → /maintain → /fix → /ship
```

**IMPORTANT**: All fixes require explicit user approval!

_Last updated: 2025-10-01_
