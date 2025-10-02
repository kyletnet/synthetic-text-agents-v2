# LLM I/O Convention

**Version**: 1.0.0
**Last Updated**: 2025-10-02
**Status**: MANDATORY for all LLM wrapper scripts

## 📋 Purpose

This document establishes strict conventions for all scripts that interact with LLM APIs to prevent JSON parsing failures and ensure reliable system operation.

## 🎯 Core Principle

**STDOUT is sacred for JSON responses only. All human-readable logs MUST go to STDERR.**

## ✅ Requirements

### 1. Stream Separation

| Stream | Purpose | Content |
|--------|---------|---------|
| **stdout** | JSON responses ONLY | `{"id": "...", "content": [...]}` |
| **stderr** | All logging | `[OK] API call successful` |

### 2. Bash Wrapper Scripts

All bash scripts that call LLM APIs (e.g., `anthropic_client.sh`, `openai_wrapper.sh`) MUST:

```bash
# ✅ CORRECT: All logs to stderr
ok()   { printf "\033[32m[OK]\033[0m %s\n" "$*" >&2; }
step() { printf "\033[36m[STEP]\033[0m %s\n" "$*" >&2; }
warn() { printf "\033[33m[WARN]\033[0m %s\n" "$*" >&2; }
fail() { printf "\033[31m[FAIL]\033[0m %s\n" "$*" >&2; }

# ❌ WRONG: Logs to stdout
ok()   { printf "\033[32m[OK]\033[0m %s\n" "$*"; }
```

### 3. TypeScript Adapters

All TypeScript adapters that spawn bash wrappers MUST:

```typescript
// ✅ CORRECT: Parse stdout for JSON, stderr for diagnostics
child.stdout.on("data", (data) => {
  stdout += data.toString();  // JSON only
});

child.stderr.on("data", (data) => {
  stderr += data.toString();  // Logs, errors
});

// Extract JSON from stdout
const jsonStart = stdout.indexOf("{");
const response = JSON.parse(stdout.substring(jsonStart, jsonEnd));
```

### 4. Response Format

LLM responses on stdout MUST be:
- Valid JSON
- No ANSI color codes
- No log prefixes
- No trailing text after JSON

```bash
# ✅ CORRECT stdout
{"id":"msg_123","content":[{"type":"text","text":"Hello"}]}

# ❌ WRONG stdout
[OK] API call successful
{"id":"msg_123","content":[{"type":"text","text":"Hello"}]}
Response completed
```

## 🔍 Validation

### Pre-commit Hook

All bash wrapper scripts MUST pass:

```bash
# Check that logging functions redirect to stderr
grep -E 'printf.*\$\*"[^>]' tools/*.sh && exit 1
```

### Runtime Validation

TypeScript adapters SHOULD validate JSON before parsing:

```typescript
function validateLLMResponse(stdout: string): boolean {
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return false;

  try {
    JSON.parse(jsonMatch[0]);
    return true;
  } catch {
    return false;
  }
}
```

## 📁 Affected Files

All files that interact with LLM APIs:

- ✅ `tools/anthropic_client.sh` - Fixed 2025-10-02
- ✅ `tools/load_env_v3.sh` - Fixed 2025-10-02
- ⚠️ `tools/openai_wrapper.sh` - TODO: Verify compliance
- ⚠️ `src/clients/anthropicAdapter.ts` - Compliant
- ⚠️ Future LLM integrations - MUST follow this convention

## 🚨 Common Mistakes

### Mistake 1: Debugging prints to stdout

```bash
# ❌ WRONG
echo "Calling API..."  # Goes to stdout!

# ✅ CORRECT
echo "Calling API..." >&2
# or
step "Calling API..."  # Already redirects to stderr
```

### Mistake 2: Source scripts with stdout logging

```bash
# If sourced script has stdout logging, it pollutes parent's stdout
source ./helper.sh  # ❌ helper.sh MUST also follow convention
```

### Mistake 3: Not handling partial JSON

```typescript
// ❌ WRONG: Assumes entire stdout is JSON
const response = JSON.parse(stdout);

// ✅ CORRECT: Extract JSON from mixed output
const jsonStart = stdout.indexOf("{");
const jsonEnd = findMatchingBrace(stdout, jsonStart);
const response = JSON.parse(stdout.substring(jsonStart, jsonEnd));
```

## 🛡️ Testing

### Manual Test

```bash
# Should output ONLY JSON to stdout
echo '{"model":"claude-3-5-sonnet-latest","max_tokens":50,"messages":[{"role":"user","content":"Hi"}]}' \
  | bash tools/anthropic_client.sh --chat 2>/dev/null

# Should output logs to stderr
echo '{"model":"claude-3-5-sonnet-latest","max_tokens":50,"messages":[{"role":"user","content":"Hi"}]}' \
  | bash tools/anthropic_client.sh --chat 2>&1 >/dev/null | grep -E "\[OK\]|\[STEP\]"
```

### Automated Test

```typescript
// scripts/validate-llm-io.ts
async function testWrapperCompliance(wrapperPath: string) {
  const result = await executeWrapper(testPayload);

  // stdout should be valid JSON only
  assert(isValidJSON(result.stdout), "stdout must be JSON only");

  // stderr can contain logs
  assert(!containsANSI(result.stdout), "stdout must not have ANSI codes");
}
```

## 📚 References

- **Root Cause**: JSON parse error from ANSI logs in stdout
- **Resolution**: PR #XXX - Redirect all bash logs to stderr
- **Related**: `DEVELOPMENT_STANDARDS.md` - Logging conventions

## ⚡ Quick Checklist

Before committing any LLM wrapper script:

- [ ] All `printf`/`echo` in logging functions have `>&2`
- [ ] No bare `echo` statements (use logging functions)
- [ ] Sourced scripts also follow convention
- [ ] Tested with `2>/dev/null` - stdout is valid JSON
- [ ] Tested with `2>&1 >/dev/null` - stderr has logs

---

**Enforcement**: This convention is MANDATORY. CI will reject commits that violate it.
