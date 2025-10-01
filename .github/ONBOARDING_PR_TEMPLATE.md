# 🚀 GAP Scanner Onboarding

Welcome to the GAP Prevention System! This PR will guide you through setting up and understanding the system.

---

## 📋 What is GAP Scanner?

GAP Scanner is a **proactive quality assurance tool** that automatically detects and prevents system inconsistencies:

- 🛡️ **Prevents issues** before they reach production
- 📚 **Ensures documentation** stays in sync with code
- 🔄 **Automates quality checks** in your workflow
- 🎯 **Enforces governance** rules automatically

---

## 🎯 Your Onboarding Tasks

Complete these tasks to familiarize yourself with the system:

### ✅ Task 1: Run Your First Scan

```bash
# Run GAP scanner (shadow mode - won't fail)
npm run gap:scan

# Review the results
cat reports/gap-scan-results.json
```

**Expected output**: Summary of any gaps detected in the codebase

---

### ✅ Task 2: View Configuration

```bash
# Show current configuration
npm run gap:config -- show

# List all available checks
npm run gap:config -- list
```

**Expected output**: Overview of 8 GAP checks and current settings

---

### ✅ Task 3: Test Auto-Fix (if applicable)

```bash
# Auto-fix P2 gaps (safe)
npm run gap:scan -- --auto-fix

# Review what was fixed
git diff
```

**Expected output**: Automatic fixes for governance inconsistencies

---

### ✅ Task 4: Backup & Restore

```bash
# Create a backup
npm run gap:backup -- create "My first backup"

# List backups
npm run gap:backup -- list

# (Optional) Restore from backup
npm run gap:backup -- restore .gaprc/backup.<timestamp>.json
```

**Expected output**: Backup created and listed

---

### ✅ Task 5: Understand Metrics

```bash
# Generate daily metrics report
npm run gap:scan:metrics -- --report=daily

# Compare with previous period
npm run gap:scan:metrics -- --compare
```

**Expected output**: Metrics dashboard showing gap trends

---

### ✅ Task 6: Explore PR Bot (CI/CD)

The PR bot automatically comments on pull requests with scan results.

**To test locally**:

```bash
# Generate PR comment (without posting)
npm run gap:pr-bot -- post
```

**Expected output**: Markdown comment preview in console

---

## 🎓 Understanding the System

### Operating Modes

| Mode         | Behavior                   | When to Use            |
| ------------ | -------------------------- | ---------------------- |
| **shadow**   | Detects gaps, doesn't fail | Week 1-2 (observation) |
| **enforce**  | Fails on P0/P1 gaps        | Week 4+ (full rollout) |
| **disabled** | Scanner off                | Emergency only         |

### Severity Levels

| Level  | Meaning                    | Action                      |
| ------ | -------------------------- | --------------------------- |
| **P0** | Critical - system broken   | **Must fix immediately**    |
| **P1** | High - major feature issue | **Should fix before merge** |
| **P2** | Medium - minor issue       | **Nice to fix**             |

### 8 Core Checks

1. **CLI Documentation** (P1) - All commands documented
2. **Governance Sync** (P0) - Code matches governance rules
3. **PII Masking** (P0) - Logger has PII protection
4. **Test Coverage** (P1) - New features have tests
5. **Doc Cross-Refs** (P2) - Documents reference each other
6. **Agent E2E** (P1) - Full agent chain tested
7. **Doc Lifecycle** (P2) - Deprecated docs tracked
8. **Deprecated Refs** (P1) - No references to old docs

---

## 🛠️ Common Commands

```bash
# Daily workflow
npm run gap:scan                          # Run scan
npm run gap:config -- validate            # Validate config
npm run gap:backup -- create "reason"     # Create backup

# Configuration
npm run gap:config -- enable <check-id>   # Enable check
npm run gap:config -- disable <check-id>  # Disable check
npm run gap:config -- mode enforce        # Set mode

# Metrics & reporting
npm run gap:scan:metrics -- --report=weekly  # Weekly report
npm run gap:scan:metrics -- --export=csv     # Export CSV

# CI/CD integration
npm run gap:pr-bot -- post                # Post to PR
```

---

## 📚 Documentation

**Core Guides**:

- [GAP Scanner Guide](../docs/GAP_SCANNER_GUIDE.md) - Complete usage guide
- [Command Guide](../docs/COMMAND_GUIDE.md) - All commands reference
- [Workflow Guide](../docs/COMMAND_WORKFLOW_GUIDE.md) - 4-step workflow

**Configuration**:

- [.gaprc.json](../.gaprc.json) - Main configuration
- [.gapignore](../.gapignore) - Ignore patterns
- [Schema](../schema/gaprc.schema.json) - JSON Schema for validation

---

## 🎮 Gamification: Earn Your Badge!

Complete all tasks above to earn the **GAP Scanner Expert** badge! 🏆

**Checklist**:

- [ ] Task 1: First scan completed
- [ ] Task 2: Configuration reviewed
- [ ] Task 3: Auto-fix tested
- [ ] Task 4: Backup created
- [ ] Task 5: Metrics explored
- [ ] Task 6: PR bot tested

Once complete, comment on this PR: `@bot gap-onboarding-complete`

---

## 🚦 Next Steps

### Week 1-2: Shadow Mode (You are here)

- ✅ Observe gap detection
- ✅ Tune false positives
- ✅ Learn the system

### Week 3: Opt-In Enforcement

- 🔄 Join enforcement team (optional)
- 🔄 Fix P0/P1 gaps proactively

### Week 4: Full Rollout

- 🚀 System enforces all commits
- 🚀 Pre-commit hook active
- 🚀 Automated PR comments

---

## ❓ FAQ

**Q: Will this block my commits?**
A: Not in Shadow mode (Week 1-2). You'll see warnings only.

**Q: What if I get false positives?**
A: Add to `.gapignore` or disable the check temporarily.

**Q: How do I disable temporarily?**

```bash
npm run gap:config -- disable <check-id>
```

**Q: Can I rollback changes?**
A: Yes! All config changes create automatic backups.

**Q: Who do I ask for help?**
A: Check #gap-scanner on Slack or open a GitHub issue.

---

## 🎉 Welcome Aboard!

You're now part of the GAP Prevention System!

**Your contribution to code quality starts today.** 🚀

---

_Generated for GAP Scanner Onboarding • [Learn More](../docs/GAP_SCANNER_GUIDE.md)_
